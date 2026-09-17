/**
 * Instant Domain Generator Controller
 * 
 * Manages multi-keyword tag input, formula configurations,
 * TLD selections (.pw, .sh, .ro, .com, etc.), and real-time SSE streaming.
 */

// DOM Elements
const keywordInput = document.getElementById('keywordInput');
const tagsList = document.getElementById('tagsList');
const tagsContainer = document.getElementById('tagsContainer');
const brandStyleGrid = document.getElementById('brandStyleGrid');

const tldGrid = document.getElementById('tldGrid');
const tldSelectAll = document.getElementById('tldSelectAll');
const tldSelectPopular = document.getElementById('tldSelectPopular');
const tldClearAll = document.getElementById('tldClearAll');

const generateBtn = document.getElementById('generateBtn');
const genSpinner = document.getElementById('genSpinner');
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

const toast = document.getElementById('toast');

// State: default to 'host' so user can see hostia, hosters, soth, sothing immediately
let keywords = ['host'];
let activeBrandStyle = 'all';
let currentEventSource = null;

// Telemetry
let totalChecked = 0;
let totalAvailable = 0;
let totalTaken = 0;
let latencySum = 0;

// Client Cache: Map<string, Array<item>>
const generatorCache = new Map();

/**
 * Toast Notification
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
 * Copy domain to clipboard
 */
window.copyDomain = async function(domain, buttonEl) {
  try {
    await navigator.clipboard.writeText(domain);
    showToast(`Copied ${domain} to clipboard!`);
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
 * Render keyword tags inside input container
 */
function renderTags() {
  tagsList.innerHTML = '';
  keywords.forEach((kw, index) => {
    const tag = document.createElement('span');
    tag.className = 'keyword-tag';
    tag.innerHTML = `
      <span>${escapeHtml(kw)}</span>
      <button type="button" class="tag-remove" data-index="${index}" title="Remove">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;
    tagsList.appendChild(tag);
  });
}

function addKeyword(raw) {
  if (!raw) return;
  const parts = raw.split(/[,;\s]+/);
  parts.forEach(part => {
    const clean = part.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
    if (clean && !keywords.includes(clean)) {
      keywords.push(clean);
    }
  });
  renderTags();
  keywordInput.value = '';
}

function removeKeyword(index) {
  keywords.splice(index, 1);
  renderTags();
}

/**
 * Reset results and counters
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

  availableList.querySelectorAll('.domain-card').forEach(el => el.remove());
  takenList.querySelectorAll('.domain-card').forEach(el => el.remove());

  availableEmpty.classList.remove('hidden');
  takenEmpty.classList.remove('hidden');
}

/**
 * Update metrics counter
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

  const avg = Math.round(latencySum / totalChecked);
  metricSpeed.textContent = `${avg}ms`;
}

function formatCategoryBadge(category, formula) {
  let label = category || 'brand';
  let svgIcon = '';
  if (category === 'neologism') {
    label = 'Neologism';
    svgIcon = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>';
  } else if (category === 'shuffled') {
    label = 'Shuffled';
    svgIcon = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line></svg>';
  } else if (category === 'semantic') {
    label = 'Semantic';
    svgIcon = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M12 2a7 7 0 0 0-7 7c0 2.5 1.5 4.5 3 6h8c1.5-1.5 3-3.5 3-6a7 7 0 0 0-7-7z"></path></svg>';
  } else if (category === 'compound') {
    label = 'Compound';
    svgIcon = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>';
  } else {
    svgIcon = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>';
  }

  const formulaTip = formula ? `title="${escapeHtml(formula)}"` : '';
  const formulaSub = formula ? `<span class="badge-formula-text">${escapeHtml(formula)}</span>` : '';

  return `<span class="badge badge-tag badge-${escapeHtml(category || 'brand')}" ${formulaTip}>${svgIcon}<span>${label}</span>${formulaSub ? '&bull; ' + formulaSub : ''}</span>`;
}

/**
 * Create Available Domain Card
 */
function createAvailableCard(item) {
  const card = document.createElement('div');
  card.className = 'domain-card available-card';
  card.dataset.tld = item.tld || '';
  card.dataset.domain = item.domain;

  const parts = item.domain.split('.');
  const baseName = parts[0];
  const tldPart = parts.slice(1).join('.');

  const tierBadge = item.tier === 1 
    ? `<span class="badge badge-tier" title="Cloudflare DoH">Tier 1 DoH</span>`
    : `<span class="badge badge-tier tier-rdap" title="Authoritative RDAP Verification">Tier 2 RDAP</span>`;

  const porkbunUrl = `https://porkbun.com/checkout/search?q=${encodeURIComponent(item.domain)}`;
  const categoryBadge = formatCategoryBadge(item.category, item.formula);

  card.innerHTML = `
    <div class="card-left">
      <div class="domain-name-row">
        <span class="domain-name">${escapeHtml(baseName)}.<span class="domain-tld">${escapeHtml(tldPart)}</span></span>
        ${categoryBadge}
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
      <a href="${porkbunUrl}" target="_blank" rel="noopener noreferrer" class="btn-action btn-buy" title="Register Domain">
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
 * Create Taken Domain Card
 */
function createTakenCard(item) {
  const card = document.createElement('div');
  card.className = 'domain-card taken-card';
  card.dataset.tld = item.tld || '';
  card.dataset.domain = item.domain;

  const parts = item.domain.split('.');
  const baseName = parts[0];
  const tldPart = parts.slice(1).join('.');

  const tierBadge = item.tier === 1
    ? `<span class="badge badge-tier" title="Resolved in DNS via DoH">DoH Record</span>`
    : `<span class="badge badge-tier tier-rdap" title="Parked via RDAP">Parked / RDAP</span>`;

  const visitUrl = `http://${item.domain}`;
  const whoisUrl = `https://whois.domaintools.com/${encodeURIComponent(item.domain)}`;
  const categoryBadge = formatCategoryBadge(item.category, item.formula);

  card.innerHTML = `
    <div class="card-left">
      <div class="domain-name-row">
        <span class="domain-name">${escapeHtml(baseName)}.<span class="domain-tld">${escapeHtml(tldPart)}</span></span>
        ${categoryBadge}
      </div>
      <div class="card-meta-row">
        ${tierBadge}
        <span class="badge badge-speed font-mono">${item.latencyMs || 15}ms</span>
      </div>
    </div>
    <div class="card-right">
      <a href="${visitUrl}" target="_blank" rel="noopener noreferrer" class="btn-action" title="Visit site">
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
 * Append domain result
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
  genSpinner.classList.add('hidden');
  generateBtn.disabled = false;
  streamStatus.classList.remove('streaming');
  statusText.textContent = 'Ready';
}

/**
 * Build request query parameters from form state
 */
function getSelectedTlds() {
  const activeBtns = tldGrid.querySelectorAll('.tld-toggle-btn.active');
  return Array.from(activeBtns).map(btn => btn.dataset.tld);
}

function buildGeneratorParams() {
  // If user has text in input field, add it as a keyword first
  if (keywordInput.value.trim()) {
    addKeyword(keywordInput.value.trim());
  }

  const selectedTlds = getSelectedTlds();
  return {
    keywords: keywords.join(','),
    tlds: selectedTlds.join(','),
    brandStyle: activeBrandStyle,
    maxCount: 60
  };
}

/**
 * Start generator stream
 */
function startGeneratorStream() {
  const params = buildGeneratorParams();
  if (keywords.length === 0) {
    showToast('Please enter at least one keyword!');
    keywordInput.focus();
    return;
  }

  if (!params.tlds) {
    showToast('Please select at least one TLD!');
    return;
  }

  abortActiveStream();
  resetResultsView();

  const cacheKey = JSON.stringify(params);
  if (generatorCache.has(cacheKey)) {
    const cachedItems = generatorCache.get(cacheKey);
    statusText.textContent = 'Instant (Cached)';
    for (const item of cachedItems) {
      appendDomainResult(item);
    }
    return;
  }

  // Update UI to streaming state
  genSpinner.classList.remove('hidden');
  generateBtn.disabled = true;
  streamStatus.classList.add('streaming');
  statusText.textContent = 'Generating & Checking...';

  const collectedResults = [];

  // Build query string
  const queryParts = [];
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== '') {
      queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
    }
  }

  const url = `/api/stream-generator?${queryParts.join('&')}`;
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
      console.error('Failed to parse generator event:', err);
    }
  };

  evtSource.addEventListener('meta', (e) => {
    try {
      const meta = JSON.parse(e.data);
      statusText.textContent = `Checking ${meta.total} variations...`;
    } catch (err) {}
  });

  evtSource.addEventListener('done', () => {
    generatorCache.set(cacheKey, collectedResults);
    abortActiveStream();
    statusText.textContent = `Done (${collectedResults.length} domains)`;
  });

  evtSource.onerror = (err) => {
    if (evtSource.readyState === EventSource.CLOSED) {
      abortActiveStream();
    } else {
      console.warn('Generator SSE stream ended:', err);
      abortActiveStream();
      statusText.textContent = 'Complete';
    }
  };
}

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

// Keyword input listeners (Enter or comma to add tag)
keywordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    addKeyword(keywordInput.value);
  } else if (e.key === 'Backspace' && !keywordInput.value && keywords.length > 0) {
    removeKeyword(keywords.length - 1);
  }
});

keywordInput.addEventListener('blur', () => {
  if (keywordInput.value.trim()) {
    addKeyword(keywordInput.value);
  }
});

// Remove keyword tag click
tagsList.addEventListener('click', (e) => {
  const btn = e.target.closest('.tag-remove');
  if (btn) {
    const idx = parseInt(btn.dataset.index, 10);
    removeKeyword(idx);
  }
});

// Focus tag input on container click
tagsContainer.addEventListener('click', (e) => {
  if (e.target !== keywordInput && !e.target.closest('.tag-remove')) {
    keywordInput.focus();
  }
});

// Quick preset sample buttons
document.querySelectorAll('.keyword-sample-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    keywords = [];
    addKeyword(btn.dataset.keywords);
  });
});

// Brand creation style selection
brandStyleGrid.addEventListener('click', (e) => {
  const chip = e.target.closest('.vibe-chip');
  if (!chip) return;
  brandStyleGrid.querySelectorAll('.vibe-chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  activeBrandStyle = chip.dataset.style;
});

// TLD toggle buttons
tldGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('.tld-toggle-btn');
  if (!btn) return;
  btn.classList.toggle('active');
});

// TLD quick actions
tldSelectAll.addEventListener('click', () => {
  tldGrid.querySelectorAll('.tld-toggle-btn').forEach(btn => btn.classList.add('active'));
});

tldSelectPopular.addEventListener('click', () => {
  const popular = ['com', 'io', 'ai', 'co', 'pw', 'sh', 'ro'];
  tldGrid.querySelectorAll('.tld-toggle-btn').forEach(btn => {
    if (popular.includes(btn.dataset.tld)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
});

tldClearAll.addEventListener('click', () => {
  tldGrid.querySelectorAll('.tld-toggle-btn').forEach(btn => btn.classList.remove('active'));
});

// Generate button
generateBtn.addEventListener('click', () => {
  startGeneratorStream();
});

// Initial Setup
renderTags();
