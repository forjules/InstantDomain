/**
 * Instant Domain Generator & Availability Checker
 * Client Application Logic
 * 
 * Features:
 * - 250ms Input Debouncing
 * - SSE EventSource Streaming with Abort / Cancel
 * - Sub-50ms Incremental DOM Append (No Full Re-renders)
 * - In-Memory Keyword Results Cache
 * - Registrar Quick-Buy Links & One-Click Copy
 * - Instant TLD Filter Toggles
 */

// DOM Elements
const searchInput = document.getElementById('searchInput');
const clearBtn = document.getElementById('clearBtn');
const searchSpinner = document.getElementById('searchSpinner');
const streamStatus = document.getElementById('streamStatus');
const statusText = document.getElementById('statusText');

const metricTotal = document.getElementById('metricTotal');
const metricAvailable = document.getElementById('metricAvailable');
const metricTaken = document.getElementById('metricTaken');
const metricSpeed = document.getElementById('metricSpeed');

const availableList = document.getElementById('availableList');
const takenList = document.getElementById('takenList');
const availableEmpty = document.getElementById('availableEmpty');
const takenEmpty = document.getElementById('takenEmpty');
const availableCounter = document.getElementById('availableCounter');
const takenCounter = document.getElementById('takenCounter');

const suggestionsRow = document.getElementById('suggestionsRow');
const filtersRow = document.getElementById('filtersRow');
const toast = document.getElementById('toast');

// State
let debounceTimer = null;
let currentEventSource = null;
let activeFilter = 'all';

// Metrics
let totalChecked = 0;
let totalAvailable = 0;
let totalTaken = 0;
let latencySum = 0;

// Client-side cache: Map<keyword, Array<domainResult>>
const clientResultsCache = new Map();

/**
 * Clean and format keyword
 */
function cleanKeyword(term) {
  if (!term) return '';
  return term.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
}

/**
 * Show temporary toast message
 */
let toastTimeout = null;
function showToast(message) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.add('hidden');
  }, 2200);
}

/**
 * Copy text to clipboard
 */
window.copyDomain = async function(domain, buttonEl) {
  try {
    await navigator.clipboard.writeText(domain);
    showToast(`Copied ${domain} to clipboard!`);
    
    // Quick visual flash on button
    if (buttonEl) {
      const originalSvg = buttonEl.innerHTML;
      buttonEl.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      `;
      setTimeout(() => {
        buttonEl.innerHTML = originalSvg;
      }, 1200);
    }
  } catch (err) {
    showToast(`Domain: ${domain}`);
  }
};

/**
 * Reset UI and metrics before a new search stream
 */
function resetResultsView() {
  totalChecked = 0;
  totalAvailable = 0;
  totalTaken = 0;
  latencySum = 0;

  metricTotal.textContent = '0';
  metricAvailable.textContent = '0';
  metricTaken.textContent = '0';
  metricSpeed.textContent = '-';
  availableCounter.textContent = '0';
  takenCounter.textContent = '0';

  // Clear cards but keep empty placeholder nodes
  availableList.querySelectorAll('.domain-card').forEach(el => el.remove());
  takenList.querySelectorAll('.domain-card').forEach(el => el.remove());

  availableEmpty.classList.remove('hidden');
  takenEmpty.classList.remove('hidden');
}

/**
 * Update telemetry indicators
 */
function updateMetrics(result) {
  totalChecked++;
  if (result.available) {
    totalAvailable++;
  } else {
    totalTaken++;
  }

  if (result.latencyMs) {
    latencySum += result.latencyMs;
  }

  metricTotal.textContent = totalChecked;
  metricAvailable.textContent = totalAvailable;
  metricTaken.textContent = totalTaken;
  availableCounter.textContent = totalAvailable;
  takenCounter.textContent = totalTaken;

  const avgSpeed = Math.round(latencySum / totalChecked);
  metricSpeed.textContent = `${avgSpeed}ms`;
}

/**
 * Constructs the DOM element for an Available domain card
 */
function createAvailableCard(item) {
  const card = document.createElement('div');
  card.className = 'domain-card available-card';
  card.dataset.tld = item.tld || '';
  card.dataset.domain = item.domain;

  if (activeFilter !== 'all' && !matchesFilter(item.tld, activeFilter)) {
    card.classList.add('filter-hidden');
  }

  const parts = item.domain.split('.');
  const baseName = parts[0];
  const tldPart = parts.slice(1).join('.');

  const tierBadge = item.tier === 1 
    ? `<span class="badge badge-tier" title="Resolved via Cloudflare DoH">Tier 1 DoH</span>`
    : `<span class="badge badge-tier tier-rdap" title="Authoritative RDAP Verification">Tier 2 RDAP</span>`;

  const porkbunUrl = `https://porkbun.com/checkout/search?q=${encodeURIComponent(item.domain)}`;
  const namecheapUrl = `https://www.namecheap.com/domains/registration/results/?domain=${encodeURIComponent(item.domain)}`;

  card.innerHTML = `
    <div class="card-left">
      <div class="domain-name-row">
        <span class="domain-name">${escapeHtml(baseName)}.<span class="domain-tld">${escapeHtml(tldPart)}</span></span>
        ${item.category ? `<span class="badge badge-tag">${escapeHtml(item.category)}</span>` : ''}
      </div>
      <div class="card-meta-row">
        ${tierBadge}
        <span class="badge badge-speed font-mono">${item.latencyMs || 15}ms</span>
      </div>
    </div>
    <div class="card-right">
      <button class="btn-action btn-icon-only" onclick="copyDomain('${escapeHtml(item.domain)}', this)" title="Copy domain">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      </button>
      <a href="${porkbunUrl}" target="_blank" rel="noopener noreferrer" class="btn-action btn-buy" title="Register on Porkbun">
        Buy
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
      </a>
    </div>
  `;

  return card;
}

/**
 * Constructs the DOM element for a Taken domain card
 */
function createTakenCard(item) {
  const card = document.createElement('div');
  card.className = 'domain-card taken-card';
  card.dataset.tld = item.tld || '';
  card.dataset.domain = item.domain;

  if (activeFilter !== 'all' && !matchesFilter(item.tld, activeFilter)) {
    card.classList.add('filter-hidden');
  }

  const parts = item.domain.split('.');
  const baseName = parts[0];
  const tldPart = parts.slice(1).join('.');

  const tierBadge = item.tier === 1
    ? `<span class="badge badge-tier" title="Resolved in DNS via Cloudflare DoH">DoH Record</span>`
    : `<span class="badge badge-tier tier-rdap" title="Registered / Parked via RDAP">Parked / RDAP</span>`;

  const visitUrl = `http://${item.domain}`;
  const whoisUrl = `https://whois.domaintools.com/${encodeURIComponent(item.domain)}`;

  card.innerHTML = `
    <div class="card-left">
      <div class="domain-name-row">
        <span class="domain-name">${escapeHtml(baseName)}.<span class="domain-tld">${escapeHtml(tldPart)}</span></span>
        ${item.category ? `<span class="badge badge-tag">${escapeHtml(item.category)}</span>` : ''}
      </div>
      <div class="card-meta-row">
        ${tierBadge}
        <span class="badge badge-speed font-mono">${item.latencyMs || 15}ms</span>
      </div>
    </div>
    <div class="card-right">
      <a href="${visitUrl}" target="_blank" rel="noopener noreferrer" class="btn-action" title="Visit domain">
        Visit
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
      </a>
      <a href="${whoisUrl}" target="_blank" rel="noopener noreferrer" class="btn-action" title="Lookup WHOIS">
        WHOIS
      </a>
    </div>
  `;

  return card;
}

/**
 * Append single domain result directly to its column (sub-50ms operation)
 */
function appendDomainResult(item) {
  if (item.available) {
    availableEmpty.classList.add('hidden');
    const card = createAvailableCard(item);
    availableList.appendChild(card);
  } else {
    takenEmpty.classList.add('hidden');
    const card = createTakenCard(item);
    takenList.appendChild(card);
  }
  updateMetrics(item);
}

/**
 * Abort active SSE connection
 */
function abortActiveStream() {
  if (currentEventSource) {
    currentEventSource.close();
    currentEventSource = null;
  }
  searchSpinner.classList.add('hidden');
  streamStatus.classList.remove('streaming');
  statusText.textContent = 'Ready';
}

/**
 * Start streaming domain checks from backend via SSE
 */
function startSearchStream(keyword) {
  abortActiveStream();
  resetResultsView();

  if (!keyword) {
    statusText.textContent = 'Ready';
    return;
  }

  // Check client in-memory cache first
  if (clientResultsCache.has(keyword)) {
    const cachedItems = clientResultsCache.get(keyword);
    statusText.textContent = 'Instant (Cached)';
    for (const item of cachedItems) {
      appendDomainResult(item);
    }
    return;
  }

  const collectedResults = [];

  // Update UI to streaming state
  searchSpinner.classList.remove('hidden');
  streamStatus.classList.add('streaming');
  statusText.textContent = 'Streaming...';

  // Open Server-Sent Events connection
  const url = `/api/stream-domains?keyword=${encodeURIComponent(keyword)}`;
  const evtSource = new EventSource(url);
  currentEventSource = evtSource;

  evtSource.onmessage = (e) => {
    try {
      const item = JSON.parse(e.data);
      if (item && item.domain) {
        collectedResults.push(item);
        appendDomainResult(item);
      }
    } catch (err) {
      console.error('Failed to parse SSE event data:', err);
    }
  };

  evtSource.addEventListener('meta', (e) => {
    try {
      const meta = JSON.parse(e.data);
      statusText.textContent = `Checking ${meta.total} domains...`;
    } catch (err) {}
  });

  evtSource.addEventListener('done', () => {
    clientResultsCache.set(keyword, collectedResults);
    abortActiveStream();
    statusText.textContent = `Complete (${collectedResults.length})`;
  });

  evtSource.onerror = (err) => {
    // Only report error if connection didn't close normally
    if (evtSource.readyState === EventSource.CLOSED) {
      abortActiveStream();
    } else {
      console.warn('SSE encountered an error:', err);
      abortActiveStream();
      statusText.textContent = 'Done';
    }
  };
}

/**
 * Filter match helper
 */
function matchesFilter(tld, filter) {
  if (filter === 'all') return true;
  if (filter === 'dev') return tld === 'dev' || tld === 'app';
  return tld === filter;
}

/**
 * Apply TLD filter to visible cards
 */
function applyFilter(filter) {
  activeFilter = filter;
  const cards = document.querySelectorAll('.domain-card');
  cards.forEach(card => {
    const tld = card.dataset.tld;
    if (matchesFilter(tld, filter)) {
      card.classList.remove('filter-hidden');
    } else {
      card.classList.add('filter-hidden');
    }
  });
}

/**
 * Escape HTML utility
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* -------------------------------------------------------------
   Event Listeners
------------------------------------------------------------- */

// 250ms Debounced Input Handler
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    const rawValue = e.target.value;
    const cleaned = cleanKeyword(rawValue);

    // Toggle clear button
    if (clearBtn) {
      clearBtn.style.display = rawValue.length > 0 ? 'flex' : 'none';
    }

    // Clear existing debounce timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // 250ms debounce threshold
    debounceTimer = setTimeout(() => {
      startSearchStream(cleaned);
    }, 250);
  });
}

// Clear button click
if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    if (searchInput) {
      searchInput.value = '';
      searchInput.focus();
    }
    clearBtn.style.display = 'none';
    abortActiveStream();
    resetResultsView();
  });
}

// Keyboard shortcuts (Escape clears search)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (searchInput) {
      searchInput.value = '';
    }
    if (clearBtn) {
      clearBtn.style.display = 'none';
    }
    abortActiveStream();
    resetResultsView();
  }
});

// Suggestion chip quick-triggers
if (suggestionsRow) {
  suggestionsRow.addEventListener('click', (e) => {
    const chip = e.target.closest('.suggestion-chip');
    if (!chip) return;
    const term = chip.dataset.term;
    if (term && searchInput) {
      searchInput.value = term;
      if (clearBtn) clearBtn.style.display = 'flex';
      startSearchStream(term);
      searchInput.focus();
    }
  });
}

// Filter chips
if (filtersRow) {
  filtersRow.addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    filtersRow.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    applyFilter(chip.dataset.filter);
  });
}

// Initial Focus
if (searchInput) {
  searchInput.focus();
}
