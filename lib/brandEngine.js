/**
 * Brand Identity & Semantic Generator Engine
 * 
 * Generates innovative business brand names from user keywords:
 * 1. Neologisms / Brandable Suffix Morphing (e.g. host -> hostia, hosters, hostix, hostify)
 * 2. Letter Shuffling & Pronounceable Anagrams (e.g. host -> soth, sothing, tosh, toshify)
 * 3. Semantic Meaning Expansion (e.g. host -> havenly, nodex, nestara, dockify)
 * 4. Compound Blends & Portmanteaus
 */

import { sanitizeKeyword } from './combinatorics.js';

// Modern startup and business morpheme suffixes
const BRAND_SUFFIXES = [
  'ia',    // hostia, cloudia
  'ers',   // hosters, flowers
  'ify',   // hostify, nodify
  'ix',    // hostix, scalix
  'ex',    // hostex, nodex
  'ium',   // hostium, nodium
  'ara',   // hostara, nestara
  'aro',   // hostaro, flowaro
  'ova',   // hostova, novanova
  'ora',   // hostora, auroral
  'iq',    // hostiq, pulseiq
  'ly',    // hostly, havenly
  'io',    // hostio, nestio
  'zen',   // hostzen, datazen
  'on',    // hoston, proton
  'ist',   // hostist, codist
  'ive',   // hostive, reactve
  'ana',   // hostana
  'ica',   // hostica, logica
  'oid',   // hostoid
  'ing',   // sothing, hosting
  'able',  // hostable
  'gen',   // hostgen
  'verse', // hostverse
  'sy',    // hostsy, craftsy
  'so'     // hostso
];

// Curated Semantic Root Associations for common business/startup topics
const CURATED_SEMANTICS = {
  host: ['server', 'haven', 'nest', 'node', 'lodge', 'anchor', 'harbor', 'portal', 'sanctuary', 'dock', 'keeper', 'cluster', 'core'],
  cloud: ['sky', 'strato', 'ether', 'aero', 'vapor', 'mist', 'drift', 'aura', 'float', 'breeze', 'stream'],
  code: ['script', 'logic', 'byte', 'syntax', 'kernel', 'algo', 'binary', 'craft', 'forge', 'stack', 'dev'],
  flow: ['stream', 'drift', 'wave', 'surge', 'pulse', 'glide', 'current', 'tide', 'flux', 'motion'],
  nexus: ['hub', 'core', 'center', 'link', 'bond', 'node', 'junction', 'pivot', 'axis', 'focal'],
  data: ['metric', 'signal', 'stat', 'tensor', 'vector', 'index', 'pulse', 'stream', 'pulse', 'graph'],
  sec: ['shield', 'vault', 'guard', 'fort', 'ward', 'helm', 'lock', 'safe', 'defense', 'sentry'],
  audio: ['wave', 'sonic', 'tempo', 'echo', 'tone', 'beat', 'tune', 'acoustic', 'voice', 'sound'],
  pay: ['cash', 'mint', 'coin', 'vault', 'credit', 'ledger', 'fund', 'wallet', 'flow'],
  ai: ['intel', 'neural', 'mind', 'cog', 'synapse', 'neuro', 'smart', 'agent', 'model', 'brain'],
  shop: ['store', 'market', 'cart', 'bazaar', 'trade', 'goods', 'deal', 'boutique', 'club'],
  craft: ['forge', 'make', 'art', 'build', 'create', 'form', 'mold', 'shape', 'guild'],
  fast: ['rapid', 'swift', 'quick', 'fleet', 'hyper', 'turbo', 'flash', 'speed', 'rush'],
  link: ['bridge', 'bond', 'knot', 'chain', 'tie', 'loop', 'mesh', 'sync', 'wire']
};

/**
 * Fetch semantic associations using Datamuse API with local fallback
 * @param {string} keyword
 * @returns {Promise<string[]>}
 */
export async function getSemanticRelatives(keyword) {
  const clean = sanitizeKeyword(keyword);
  if (!clean) return [];

  const results = new Set();

  // Check curated semantics first
  if (CURATED_SEMANTICS[clean]) {
    CURATED_SEMANTICS[clean].forEach(w => results.add(w));
  }

  // Also query partial key matches
  for (const [key, relatives] of Object.entries(CURATED_SEMANTICS)) {
    if (clean.includes(key) || key.includes(clean)) {
      relatives.slice(0, 5).forEach(w => results.add(w));
    }
  }

  // Attempt fast Datamuse API query with a strict 1.2s timeout
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);

    const res = await fetch(`https://api.datamuse.com/words?ml=${encodeURIComponent(clean)}&max=15`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'BrandGenerator/1.0' }
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        for (const item of data) {
          const word = item.word.toLowerCase().trim();
          // Filter for single-word nouns/adjectives (3-8 letters)
          if (/^[a-z]{3,8}$/.test(word) && word !== clean) {
            results.add(word);
          }
        }
      }
    }
  } catch (err) {
    // Network/timeout error: fallback gracefully to curated dictionary
  }

  return Array.from(results).slice(0, 10);
}

/**
 * 1. Neologisms & Suffix Morphing
 * Examples: host -> hostia, hosters, hostix, hostify, hostara, hoston
 */
export function generateNeologisms(word) {
  const base = sanitizeKeyword(word);
  if (!base || base.length < 2) return [];

  const results = [];
  const root = base.replace(/[aeiou]+$/, ''); // strip trailing vowels (e.g. pulse -> puls)

  for (const suffix of BRAND_SUFFIXES) {
    // Literal append (e.g. host + ia = hostia, host + ers = hosters)
    results.push({
      name: `${base}${suffix}`,
      style: 'neologism',
      formula: `${base} + -${suffix}`
    });

    // Root append if base ends with vowel (e.g. scale + ix = scalix)
    if (root.length >= 3 && root !== base) {
      results.push({
        name: `${root}${suffix}`,
        style: 'neologism',
        formula: `${root} + -${suffix}`
      });
    }
  }

  return results;
}

/**
 * 2. Letter Shuffling & Pronounceable Anagrams
 * 
 * Reorganizes consonants and syllables while maintaining pronounceability.
 * E.g. host (h-o-s-t) -> soth, sothing, tosh, toshify, shot, sothex.
 */
export function generateShuffledNames(word) {
  const base = sanitizeKeyword(word);
  if (!base || base.length < 3 || base.length > 8) return [];

  const results = [];
  const seenRoots = new Set([base]);

  function addShuffledVariant(rootName, formula) {
    if (!rootName || rootName.length < 3 || seenRoots.has(rootName)) return;
    // Check basic pronounceability: cannot have 3 consonants in a row (unless common clusters like str, sch)
    if (/[bcdfghjklmnpqrstvwxyz]{4,}/.test(rootName)) return;
    if (/^[bcdfghjklmnpqrstvwxyz]{3}/.test(rootName)) return;

    seenRoots.add(rootName);
    results.push({
      name: rootName,
      style: 'shuffled',
      formula: formula || `Shuffled letters of ${base}`
    });

    // Morph the shuffled root with high-affinity suffixes (e.g. soth -> sothing, sothia, sothers)
    for (const s of ['ing', 'ia', 'ers', 'ify', 'ex', 'ix', 'ly', 'io']) {
      results.push({
        name: `${rootName}${s}`,
        style: 'shuffled',
        formula: `${rootName} + -${s}`
      });
    }
  }

  const chars = base.split('');

  // Pattern A: 4-letter words with C1-V1-C2-C3 (e.g. h-o-s-t)
  if (base.length === 4) {
    const [c1, v1, c2, c3] = chars;
    const isVowel = (ch) => 'aeiouy'.includes(ch);

    if (!isVowel(c1) && isVowel(v1) && !isVowel(c2) && !isVowel(c3)) {
      // Form 1: C2-V1-C3-C1 => s-o-t-h ('soth')
      addShuffledVariant(`${c2}${v1}${c3}${c1}`, `Inverted anagram of ${base} (${c2}${v1}${c3}${c1})`);
      // Form 2: C3-V1-C2-C1 => t-o-s-h ('tosh')
      addShuffledVariant(`${c3}${v1}${c2}${c1}`, `Reversed onset (${c3}${v1}${c2}${c1})`);
      // Form 3: C2-C1-V1-C3 => s-h-o-t ('shot')
      addShuffledVariant(`${c2}${c1}${v1}${c3}`, `Blend (${c2}${c1}${v1}${c3})`);
    }
  }

  // Pattern B: 3-letter words (C1-V1-C2 -> C2-V1-C1) e.g. cat -> tac, net -> ten
  if (base.length === 3) {
    const [c1, v1, c2] = chars;
    if (!'aeiou'.includes(c1) && 'aeiou'.includes(v1) && !'aeiou'.includes(c2)) {
      addShuffledVariant(`${c2}${v1}${c1}`, `Reverse of ${base}`);
    }
  }

  // Pattern C: Syllable reversal (e.g. cloudflow -> flowcloud) or split in half
  if (base.length >= 5) {
    const mid = Math.floor(base.length / 2);
    const p1 = base.slice(0, mid);
    const p2 = base.slice(mid);
    addShuffledVariant(`${p2}${p1}`, `Syllable inverted: ${p2} + ${p1}`);
  }

  return results;
}

/**
 * 3. Semantic Meaning Brand Expansion
 * 
 * Takes semantic relatives of keyword (e.g. host -> haven, server, node)
 * and generates brandable business names from those concepts.
 */
export async function generateSemanticNames(word) {
  const clean = sanitizeKeyword(word);
  if (!clean) return [];

  const relatives = await getSemanticRelatives(clean);
  const results = [];

  for (const rel of relatives) {
    // Add relative with brand suffixes (e.g. haven -> havenly, havenia; node -> nodex)
    const morphs = generateNeologisms(rel);
    for (const m of morphs.slice(0, 4)) {
      results.push({
        name: m.name,
        style: 'semantic',
        formula: `Meaning: ${clean} → ${rel} + ${m.formula.split('+')[1]?.trim() || ''}`,
        originWord: rel
      });
    }

    // Direct relative as root
    results.push({
      name: rel,
      style: 'semantic',
      formula: `Related meaning: ${rel}`,
      originWord: rel
    });
  }

  return results;
}

/**
 * Main Brand Domain Generation Orchestrator
 * 
 * @param {Object} options
 * @param {string|string[]} options.keywords - Seed keywords (e.g. 'host' or ['host', 'cloud'])
 * @param {string|string[]} [options.tlds] - Target TLDs (e.g. ['com', 'io', 'ai', 'pw', 'sh', 'ro'])
 * @param {string} [options.brandStyle='all'] - 'all' | 'neologism' | 'shuffled' | 'semantic' | 'compound'
 * @param {string} [options.industry='all'] - Industry context
 * @param {number} [options.maxCount=60] - Max total domains to return
 * @returns {Promise<Array<{ domain: string, base: string, tld: string, category: string, formula: string }>>}
/**
 * Generates compound fusions, portmanteaus, and blends from multiple keywords.
 * E.g. ['cloud', 'host', 'best', 'analytics', 'smart'] ->
 * cloudhost, smarthost, hostlytics, smartlytics, besthost, cloudhostia, smarthosting...
 */
export function generateMultiKeywordBlends(keywords) {
  if (!keywords || keywords.length < 2) return [];

  const blends = [];
  const seen = new Set();

  function add(name, formula) {
    if (!name || name.length < 3 || name.length > 18 || seen.has(name)) return;
    seen.add(name);
    blends.push({
      name,
      style: 'compound',
      formula
    });
  }

  // 1. Direct Pairwise compounds & Portmanteaus
  for (let i = 0; i < keywords.length; i++) {
    for (let j = 0; j < keywords.length; j++) {
      if (i !== j) {
        const w1 = keywords[i];
        const w2 = keywords[j];

        // Direct compound (e.g. cloudhost, smarthost, besthost)
        add(`${w1}${w2}`, `${w1} + ${w2}`);

        // Portmanteau: analytics special blending (smartlytics, hostlytics, cloudlytics)
        if (w2 === 'analytics' || w2.includes('analytic')) {
          add(`${w1}lytics`, `${w1} + -lytics`);
          add(`${w1}alytics`, `${w1} + -alytics`);
        } else if (w1 === 'analytics') {
          add(`analy${w2}`, `analy- + ${w2}`);
        }

        // Overlap fusion (if w1 ends with letter w2 starts with, e.g. best + tech = bestech)
        if (w1[w1.length - 1] === w2[0]) {
          add(`${w1}${w2.slice(1)}`, `${w1} ⨝ ${w2}`);
        }

        // Short syllable fusion (first 3-4 chars of w1 + w2, e.g. clouhost)
        if (w1.length >= 4 && w2.length >= 3) {
          add(`${w1.slice(0, 3)}${w2}`, `${w1.slice(0, 3)}- + ${w2}`);
        }

        // Compound with brandable suffixes (cloudhostia, smarthosting, besthostix)
        const combined = `${w1}${w2}`;
        if (combined.length <= 11) {
          for (const s of ['ia', 'ing', 'ix', 'ly', 'io', 'ers']) {
            add(`${combined}${s}`, `${w1}${w2} + -${s}`);
          }
        }
      }
    }
  }

  // 2. Multi-word blends (3 keywords, e.g. bestcloudhost, smartcloudhost)
  if (keywords.length >= 3) {
    for (let i = 0; i < Math.min(keywords.length, 3); i++) {
      for (let j = 0; j < Math.min(keywords.length, 3); j++) {
        for (let k = 0; k < Math.min(keywords.length, 3); k++) {
          if (i !== j && j !== k && i !== k) {
            const triple = `${keywords[i]}${keywords[j]}${keywords[k]}`;
            if (triple.length <= 15) {
              add(triple, `${keywords[i]} + ${keywords[j]} + ${keywords[k]}`);
            }
          }
        }
      }
    }
  }

  return blends;
}

/**
 * Main Brand Domain Generation Orchestrator
 * 
 * @param {Object} options
 * @param {string|string[]} options.keywords - Seed keywords (e.g. 'host' or ['host', 'cloud'])
 * @param {string|string[]} [options.tlds] - Target TLDs (e.g. ['com', 'io', 'ai', 'pw', 'sh', 'ro'])
 * @param {string} [options.brandStyle='all'] - 'all' | 'neologism' | 'shuffled' | 'semantic' | 'compound'
 * @param {string} [options.industry='all'] - Industry context
 * @param {number} [options.maxCount=60] - Max total domains to return
 * @returns {Promise<Array<{ domain: string, base: string, tld: string, category: string, formula: string }>>}
 */
export async function generateBrandDomains(options = {}) {
  const rawKws = Array.isArray(options.keywords) 
    ? options.keywords 
    : String(options.keywords || '').split(/[,;\s]+/);
  
  const keywords = [...new Set(rawKws.map(sanitizeKeyword).filter(Boolean))];
  if (keywords.length === 0) return [];

  // Parse TLDs
  let rawTlds = options.tlds;
  if (typeof rawTlds === 'string') rawTlds = rawTlds.split(/[,;\s]+/);
  let tlds = Array.isArray(rawTlds) && rawTlds.length > 0
    ? [...new Set(rawTlds.map(t => t.replace(/^\./, '').trim().toLowerCase()).filter(Boolean))]
    : ['com', 'io', 'ai', 'co', 'pw', 'sh', 'ro'];

  const brandStyle = options.brandStyle || 'all';
  // Allow more domain slots when multiple keywords are given
  const requestedMax = Number(options.maxCount) || 60;
  const maxCount = keywords.length > 2 ? Math.max(requestedMax, 75) : requestedMax;

  // 1. Generate identity pools FOR EACH KEYWORD INDIVIDUALLY
  const perKeywordPools = new Map();

  for (const kw of keywords) {
    const kwPool = [];
    const seenKwBrands = new Set();

    function addKwBrand(brand) {
      if (!brand || !brand.name) return;
      const name = brand.name.toLowerCase().trim();
      if (name.length < 3 || name.length > 16 || seenKwBrands.has(name)) return;
      seenKwBrands.add(name);
      kwPool.push(brand);
    }

    const neos = (brandStyle === 'all' || brandStyle === 'neologism') ? generateNeologisms(kw) : [];
    const shuffled = (brandStyle === 'all' || brandStyle === 'shuffled') ? generateShuffledNames(kw) : [];
    const sem = (brandStyle === 'all' || brandStyle === 'semantic') ? await generateSemanticNames(kw) : [];

    // Interleave this keyword's own styles
    const maxStyleLen = Math.max(neos.length, shuffled.length, sem.length);
    for (let i = 0; i < maxStyleLen; i++) {
      if (i < neos.length) addKwBrand(neos[i]);
      if (i < shuffled.length) addKwBrand(shuffled[i]);
      if (i < sem.length) addKwBrand(sem[i]);
    }

    perKeywordPools.set(kw, kwPool);
  }

  // 2. Generate multi-keyword compound & fusion blends
  const compoundBlends = (keywords.length > 1 && (brandStyle === 'all' || brandStyle === 'compound'))
    ? generateMultiKeywordBlends(keywords)
    : [];

  // 3. Round-robin interleave across ALL keywords + compound blends
  const orderedBrands = [];
  const globalSeenNames = new Set();

  function addGlobalBrand(brand) {
    if (!brand || !brand.name) return;
    const name = brand.name.toLowerCase().trim();
    if (globalSeenNames.has(name)) return;
    globalSeenNames.add(name);
    orderedBrands.push(brand);
  }

  const maxKwLen = Math.max(...Array.from(perKeywordPools.values()).map(p => p.length), 0);
  let compoundIndex = 0;

  for (let step = 0; step < maxKwLen; step++) {
    // A. One brand from each keyword in round-robin order
    for (const kw of keywords) {
      const pool = perKeywordPools.get(kw);
      if (pool && step < pool.length) {
        addGlobalBrand(pool[step]);
      }
    }

    // B. Multi-keyword compound blends in each cycle
    if (compoundBlends.length > 0 && compoundIndex < compoundBlends.length) {
      addGlobalBrand(compoundBlends[compoundIndex++]);
      if (compoundIndex < compoundBlends.length) {
        addGlobalBrand(compoundBlends[compoundIndex++]);
      }
    }
  }

  // 4. Smart TLD Distribution:
  // Instead of attaching all 7 TLDs to brand #1 before brand #2,
  // distribute TLDs in passes so every brand gets top TLDs first!
  const domainResults = [];
  const seenDomains = new Set();

  function tryAddDomain(brand, tld) {
    const domain = `${brand.name}.${tld}`;
    if (!seenDomains.has(domain)) {
      seenDomains.add(domain);
      domainResults.push({
        domain,
        base: brand.name,
        tld,
        category: brand.style,
        formula: brand.formula || brand.style
      });
      return true;
    }
    return false;
  }

  // Pass 1: Pair each brand with primary TLD (e.g. .com)
  for (const brand of orderedBrands) {
    tryAddDomain(brand, tlds[0]);
    if (domainResults.length >= maxCount) return domainResults;
  }

  // Pass 2: Pair each brand with second TLD (e.g. .io or .ai)
  if (tlds.length > 1) {
    for (const brand of orderedBrands) {
      tryAddDomain(brand, tlds[1]);
      if (domainResults.length >= maxCount) return domainResults;
    }
  }

  // Pass 3: Pair each brand with third TLD
  if (tlds.length > 2) {
    for (const brand of orderedBrands) {
      tryAddDomain(brand, tlds[2]);
      if (domainResults.length >= maxCount) return domainResults;
    }
  }

  // Pass 4: Pair remaining TLDs (.pw, .sh, .ro, etc.)
  for (let t = 3; t < tlds.length; t++) {
    for (const brand of orderedBrands) {
      tryAddDomain(brand, tlds[t]);
      if (domainResults.length >= maxCount) return domainResults;
    }
  }

  return domainResults;
}
