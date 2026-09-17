/**
 * Two-Tier Domain Availability Checker
 * 
 * Pipeline:
 * - Tier 1 (Ultra-fast ~15ms): Cloudflare DNS-over-HTTPS (DoH).
 *   Queries for NS or A records. If DNS records exist, domain is TAKEN.
 * - Tier 2 (Fallback ~200ms): RDAP query (via rdap.org).
 *   If Tier 1 is NXDOMAIN / no records, check registry RDAP.
 *   - HTTP 404 -> AVAILABLE (definitively unregistered).
 *   - HTTP 200 -> TAKEN (registered, parked or without active nameservers).
 */

const DOH_ENDPOINT = 'https://cloudflare-dns.com/dns-query';
const RDAP_BASE = 'https://rdap.org/domain';

// In-memory cache for recent domain checks (5 minutes TTL)
const domainCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCached(domain) {
  const item = domainCache.get(domain);
  if (!item) return null;
  if (Date.now() - item.timestamp > CACHE_TTL_MS) {
    domainCache.delete(domain);
    return null;
  }
  return item.data;
}

function setCached(domain, data) {
  // Prune cache if it grows too large (> 10000 entries)
  if (domainCache.size > 10000) {
    const oldestKey = domainCache.keys().next().value;
    domainCache.delete(oldestKey);
  }
  domainCache.set(domain, { timestamp: Date.now(), data });
}

/**
 * Queries Cloudflare DNS-over-HTTPS (DoH) for a specific record type.
 * @param {string} domain 
 * @param {string} type 'NS' | 'A'
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ status: number, hasAnswer: boolean, answers: any[] }>}
 */
async function queryDoH(domain, type = 'NS', signal) {
  const url = `${DOH_ENDPOINT}?name=${encodeURIComponent(domain)}&type=${type}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'accept': 'application/dns-json',
      'User-Agent': 'DomainChecker-DoH/1.0'
    },
    signal
  });

  if (!response.ok) {
    throw new Error(`DoH query failed with HTTP ${response.status}`);
  }

  const json = await response.json();
  const hasAnswer = Array.isArray(json.Answer) && json.Answer.length > 0;
  return {
    status: json.Status, // 0 = NOERROR, 3 = NXDOMAIN
    hasAnswer,
    answers: json.Answer || []
  };
}

/**
 * Tier 1: Check Cloudflare DoH for NS and A records.
 * Returns { taken: true, latencyMs } if DNS records exist.
 * Otherwise returns { taken: false, status: number, latencyMs }.
 */
async function checkTier1DoH(domain, signal) {
  const start = performance.now();
  
  // First query NS records (nameservers indicate active domain delegation)
  const nsResult = await queryDoH(domain, 'NS', signal);
  if (nsResult.hasAnswer) {
    return {
      isTaken: true,
      tier: 1,
      method: 'doh-ns',
      latencyMs: Math.round(performance.now() - start)
    };
  }

  // If no NS records found, double check A records (direct host record)
  // Only check if status wasn't already NXDOMAIN (3)
  if (nsResult.status === 0) {
    const aResult = await queryDoH(domain, 'A', signal);
    if (aResult.hasAnswer) {
      return {
        isTaken: true,
        tier: 1,
        method: 'doh-a',
        latencyMs: Math.round(performance.now() - start)
      };
    }
  }

  return {
    isTaken: false,
    dohStatus: nsResult.status,
    latencyMs: Math.round(performance.now() - start)
  };
}

/**
 * Tier 2: Check RDAP fallback for NXDOMAIN or inactive DNS domains.
 * RDAP queries the authoritative registry.
 * - HTTP 404 => Definitely UNREGISTERED / AVAILABLE.
 * - HTTP 200 => REGISTERED (e.g. parked, inactive nameservers).
 */
async function checkTier2RDAP(domain, signal) {
  const start = performance.now();
  const url = `${RDAP_BASE}/${encodeURIComponent(domain)}`;

  // Allow max 2.5s for RDAP response
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 2500);

  // Combine outer signal with timeout signal
  const combinedSignal = signal 
    ? AbortSignal.any([signal, timeoutController.signal])
    : timeoutController.signal;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/rdap+json, application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      redirect: 'follow',
      signal: combinedSignal
    });

    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - start);

    if (response.status === 404) {
      // Registry reports domain does not exist -> AVAILABLE!
      return {
        isAvailable: true,
        tier: 2,
        method: 'rdap-404',
        confidence: 'high',
        latencyMs
      };
    }

    if (response.status === 200) {
      // Registry has registration record -> TAKEN
      return {
        isAvailable: false,
        tier: 2,
        method: 'rdap-200',
        confidence: 'high',
        latencyMs
      };
    }

    // Any other HTTP code (e.g. 429 rate limit or 503)
    return {
      isAvailable: true, // Optimistically available since NXDOMAIN in DNS
      tier: 2,
      method: `rdap-http-${response.status}`,
      confidence: 'medium',
      latencyMs
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - start);
    
    // If request was aborted by client disconnect, rethrow
    if (signal?.aborted) {
      throw err;
    }

    // On RDAP timeout or network failure, NXDOMAIN strongly suggests availability
    return {
      isAvailable: true,
      tier: 2,
      method: 'rdap-timeout-fallback',
      confidence: 'medium',
      latencyMs
    };
  }
}

/**
 * Main availability check pipeline for a single domain.
 * 
 * @param {string} domain 
 * @param {AbortSignal} [signal] 
 * @returns {Promise<{
 *   domain: string,
 *   available: boolean,
 *   tier: number,
 *   method: string,
 *   confidence: string,
 *   latencyMs: number,
 *   fromCache?: boolean
 * }>}
 */
export async function checkDomainAvailability(domain, signal) {
  // Check cache first
  const cached = getCached(domain);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  const overallStart = performance.now();

  try {
    // ----------------------------------------------------
    // Tier 1: Cloudflare DNS-over-HTTPS (DoH) (~15ms)
    // ----------------------------------------------------
    const tier1 = await checkTier1DoH(domain, signal);

    if (tier1.isTaken) {
      const result = {
        domain,
        available: false,
        tier: 1,
        method: tier1.method,
        confidence: 'high',
        latencyMs: Math.round(performance.now() - overallStart)
      };
      setCached(domain, result);
      return result;
    }

    // ----------------------------------------------------
    // Tier 2: RDAP Fallback (~200ms)
    // Only invoked when Tier 1 returned no active DNS records
    // ----------------------------------------------------
    const tier2 = await checkTier2RDAP(domain, signal);
    const totalLatency = Math.round(performance.now() - overallStart);

    const result = {
      domain,
      available: tier2.isAvailable,
      tier: 2,
      method: tier2.method,
      confidence: tier2.confidence,
      latencyMs: totalLatency
    };

    setCached(domain, result);
    return result;

  } catch (error) {
    if (signal?.aborted) {
      throw error; // Let cancellation bubble up
    }

    // Fail-safe default: don't crash stream on isolated domain error
    return {
      domain,
      available: false,
      tier: 0,
      method: 'error',
      confidence: 'none',
      error: error.message,
      latencyMs: Math.round(performance.now() - overallStart)
    };
  }
}
