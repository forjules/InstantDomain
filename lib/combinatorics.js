/**
 * Combinatorics Engine for Instant Domain Name Generator.
 * Generates high-intent domain variations including exact TLDs,
 * popular action prefixes, and modern tech suffixes.
 */

// Popular TLDs to test for the exact keyword, including newly added .pw, .sh, .ro
const PRIMARY_TLDS = [
  'com',
  'io',
  'ai',
  'co',
  'pw',
  'sh',
  'ro',
  'dev',
  'app',
  'net',
  'org',
  'xyz',
  'tech',
  'me',
  'so',
  'space',
  'site'
];

// Industry presets for contextual domain generation
export const INDUSTRY_PRESETS = {
  ai: {
    prefixes: ['ai', 'meta', 'deep', 'hyper', 'neuro', 'smart', 'cog'],
    suffixes: ['ai', 'bot', 'mind', 'intel', 'brain', 'agent', 'model', 'lab', 'net']
  },
  tech: {
    prefixes: ['dev', 'code', 'stack', 'cloud', 'cyber', 'nano', 'open'],
    suffixes: ['hq', 'hub', 'lab', 'base', 'stack', 'flow', 'io', 'box', 'api', 'zone']
  },
  creative: {
    prefixes: ['art', 'pixel', 'neo', 'vivid', 'pure', 'studio'],
    suffixes: ['craft', 'studio', 'forge', 'space', 'canvas', 'design', 'wave', 'pulse']
  },
  commerce: {
    prefixes: ['shop', 'pay', 'buy', 'trade', 'deal', 'market'],
    suffixes: ['store', 'shop', 'cart', 'pay', 'market', 'club', 'goods']
  },
  minimal: {
    prefixes: ['get', 'try', 'use', 'go', 'hey', 'join', 'my', 'the'],
    suffixes: ['ly', 'ify', 'app', 'now', 'link', 'up']
  }
};

// Default startup and project prefixes
const PREFIXES = [
  'get',
  'try',
  'use',
  'go',
  'hey',
  'join',
  'my',
  'the',
  'meet',
  'run'
];

// Modern startup and project suffixes
const SUFFIXES = [
  'app',
  'hq',
  'hub',
  'lab',
  'box',
  'io',
  'now',
  'site',
  'flow',
  'stack',
  'base',
  'api',
  'zone',
  'link'
];

// Secondary TLDs for prefix/suffix combinations
const SECONDARY_TLDS = ['com', 'io', 'ai', 'co'];

/**
 * Cleans user input into a valid domain label.
 * @param {string} raw
 * @returns {string}
 */
export function sanitizeKeyword(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .toLowerCase()
    .trim()
    .replace(/https?:\/\//g, '')
    .replace(/www\./g, '')
    .replace(/[^a-z0-9-]/g, '') // remove spaces and special characters
    .replace(/^-+|-+$/g, '');   // remove leading and trailing hyphens
}

/**
 * Generates an array of domain candidates for the given keyword.
 * Order matters: exact matches first, then popular prefixes/suffixes.
 *
 * @param {string} rawKeyword
 * @param {number} [maxCount=40]
 * @returns {Array<{ domain: string, base: string, tld: string, category: string }>}
 */
export function generateVariations(rawKeyword, maxCount = 40) {
  const kw = sanitizeKeyword(rawKeyword);
  if (!kw || kw.length < 1) return [];

  const candidates = [];
  const seen = new Set();

  function add(domain, base, tld, category) {
    if (!seen.has(domain)) {
      seen.add(domain);
      candidates.push({ domain, base, tld, category });
    }
  }

  // 1. Exact matches with primary TLDs
  for (const tld of PRIMARY_TLDS) {
    add(`${kw}.${tld}`, kw, tld, 'exact');
  }

  // 2. Popular action prefixes with .com
  for (const prefix of PREFIXES) {
    const base = `${prefix}${kw}`;
    add(`${base}.com`, base, 'com', 'prefix');
  }

  // 3. Modern suffixes with .com
  for (const suffix of SUFFIXES) {
    const base = `${kw}${suffix}`;
    add(`${base}.com`, base, 'com', 'suffix');
  }

  // 4. Action prefixes with .io and .ai
  for (const prefix of PREFIXES.slice(0, 5)) {
    const base = `${prefix}${kw}`;
    for (const tld of ['io', 'ai', 'co']) {
      add(`${base}.${tld}`, base, tld, 'prefix');
    }
  }

  // 5. Suffixes with .io and .ai
  for (const suffix of SUFFIXES.slice(0, 5)) {
    const base = `${kw}${suffix}`;
    for (const tld of ['io', 'ai', 'co']) {
      add(`${base}.${tld}`, base, tld, 'suffix');
    }
  }

  return candidates.slice(0, maxCount);
}

/**
 * Advanced combinatorics generator for the Generator page.
 * Combines multiple keywords, industry presets, custom prefixes/suffixes,
 * compound blends, and target TLDs.
 *
 * @param {Object} options
 * @param {string|string[]} options.keywords - One or more raw keywords
 * @param {string|string[]} [options.tlds] - Target TLDs (e.g. ['com', 'io', 'pw', 'sh', 'ro'])
 * @param {string} [options.industry='all'] - Industry preset ('all', 'ai', 'tech', 'creative', 'commerce', 'minimal')
 * @param {boolean} [options.includePrefixes=true]
 * @param {boolean} [options.includeSuffixes=true]
 * @param {boolean} [options.includeBlends=true]
 * @param {boolean} [options.includeHyphens=false]
 * @param {string|string[]} [options.customPrefixes]
 * @param {string|string[]} [options.customSuffixes]
 * @param {number} [options.maxLength=0] - Max character length of domain name (excluding TLD)
 * @param {number} [options.maxCount=60]
 * @returns {Array<{ domain: string, base: string, tld: string, category: string }>}
 */
export function generateAdvancedCombinations(options = {}) {
  const rawKws = Array.isArray(options.keywords) 
    ? options.keywords 
    : String(options.keywords || '').split(/[,;\s]+/);
  
  const keywords = [...new Set(rawKws.map(sanitizeKeyword).filter(k => k.length > 0))];
  if (keywords.length === 0) return [];

  // Parse target TLDs
  let rawTlds = options.tlds;
  if (typeof rawTlds === 'string') {
    rawTlds = rawTlds.split(/[,;\s]+/);
  }
  let tlds = Array.isArray(rawTlds) && rawTlds.length > 0
    ? [...new Set(rawTlds.map(t => t.replace(/^\./, '').trim().toLowerCase()).filter(Boolean))]
    : ['com', 'io', 'ai', 'co', 'pw', 'sh', 'ro'];

  // Industry affixes
  const industry = options.industry || 'all';
  const preset = INDUSTRY_PRESETS[industry] || null;

  // Custom affixes
  const parseAffixes = (input) => {
    if (!input) return [];
    const list = Array.isArray(input) ? input : String(input).split(/[,;\s]+/);
    return list.map(sanitizeKeyword).filter(Boolean);
  };

  const customPrefixes = parseAffixes(options.customPrefixes);
  const customSuffixes = parseAffixes(options.customSuffixes);

  // Combine prefixes
  let activePrefixes = [];
  if (preset) {
    activePrefixes.push(...preset.prefixes);
  } else {
    activePrefixes.push(...PREFIXES);
  }
  activePrefixes.push(...customPrefixes);
  activePrefixes = [...new Set(activePrefixes)];

  // Combine suffixes
  let activeSuffixes = [];
  if (preset) {
    activeSuffixes.push(...preset.suffixes);
  } else {
    activeSuffixes.push(...SUFFIXES);
  }
  activeSuffixes.push(...customSuffixes);
  activeSuffixes = [...new Set(activeSuffixes)];

  const includePrefixes = options.includePrefixes !== false;
  const includeSuffixes = options.includeSuffixes !== false;
  const includeBlends = options.includeBlends !== false;
  const includeHyphens = Boolean(options.includeHyphens);
  const maxLength = Number(options.maxLength) || 0;
  const maxCount = Number(options.maxCount) || 60;

  const candidates = [];
  const seen = new Set();

  function add(base, tld, category) {
    if (!base || !tld) return;
    if (maxLength > 0 && base.length > maxLength) return;
    const domain = `${base}.${tld}`;
    if (!seen.has(domain)) {
      seen.add(domain);
      candidates.push({ domain, base, tld, category });
    }
  }

  // 1. Exact matches for every keyword across all selected TLDs
  for (const kw of keywords) {
    for (const tld of tlds) {
      add(kw, tld, 'exact');
    }
  }

  // 2. Compound blends between pairs of keywords
  if (includeBlends && keywords.length > 1) {
    for (let i = 0; i < keywords.length; i++) {
      for (let j = 0; j < keywords.length; j++) {
        if (i !== j) {
          const blended = `${keywords[i]}${keywords[j]}`;
          for (const tld of tlds.slice(0, 4)) {
            add(blended, tld, 'blend');
          }
          if (includeHyphens) {
            const hyphenBlended = `${keywords[i]}-${keywords[j]}`;
            for (const tld of tlds.slice(0, 4)) {
              add(hyphenBlended, tld, 'blend');
            }
          }
        }
      }
    }
  }

  // 3. Prefix variations
  if (includePrefixes) {
    for (const kw of keywords) {
      for (const prefix of activePrefixes.slice(0, 8)) {
        const base = `${prefix}${kw}`;
        for (const tld of tlds.slice(0, 3)) {
          add(base, tld, 'prefix');
        }
        if (includeHyphens) {
          const hyphenBase = `${prefix}-${kw}`;
          for (const tld of tlds.slice(0, 3)) {
            add(hyphenBase, tld, 'prefix');
          }
        }
      }
    }
  }

  // 4. Suffix variations
  if (includeSuffixes) {
    for (const kw of keywords) {
      for (const suffix of activeSuffixes.slice(0, 8)) {
        const base = `${kw}${suffix}`;
        for (const tld of tlds.slice(0, 3)) {
          add(base, tld, 'suffix');
        }
        if (includeHyphens) {
          const hyphenBase = `${kw}-${suffix}`;
          for (const tld of tlds.slice(0, 3)) {
            add(hyphenBase, tld, 'suffix');
          }
        }
      }
    }
  }

  return candidates.slice(0, maxCount);
}

