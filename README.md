# Instant Domain Name Search & Generator ⚡

A high-performance, real-time domain search and generation engine inspired by `instantdomainsearch.com`. Designed for sub-50ms visual updates with a two-tier DNS/RDAP resolution pipeline, Server-Sent Events (SSE), and a clean dark-mode UI.

---

## 🌟 Pages & Architecture

### 1. ⚡ Search Page (`/search` or `/`)
- **Instant Debounced Search**: 250ms debounce threshold to prevent flooding while typing.
- **Auto-cancellation**: Inflight streams automatically aborted when the user continues typing.
- **Two-Column Dynamic Display**:
  - **Available (Emerald Green)**: Direct Porkbun & Namecheap checkout links, one-click domain copying, TLD badges.
  - **Taken (Muted Slate)**: Resolution tier badges, external site visit link, WHOIS lookup link.
- **Supported TLDs**: `.com`, `.io`, `.ai`, `.co`, **`.pw`**, **`.sh`**, **`.ro`**, `.dev`, `.app`, `.net`, `.org`, `.xyz`, etc.
- **Quick Filters**: Instant client-side TLD filter chips without re-fetching.

### 2. ✨ Generator Page (`/generator`)
- **Multi-Keyword Tag Input**: Enter multiple keywords (e.g. `cloud, flow, pulse`).
- **Industry & Vibe Presets**:
  - `🌐 All Vibes`
  - `🤖 AI & Intelligence` (`ai`, `bot`, `mind`, `intel`, `brain`, `agent`, `model`, `lab`)
  - `💻 Tech & SaaS` (`dev`, `stack`, `hq`, `hub`, `flow`, `io`, `box`, `api`)
  - `🎨 Creative & Design` (`craft`, `studio`, `forge`, `space`, `canvas`, `design`)
  - `🛒 Commerce & Pay` (`store`, `shop`, `cart`, `pay`, `market`, `deal`)
  - `⚡ Minimal & Action` (`get`, `try`, `use`, `go`, `hey`, `join`, `ly`, `ify`)
- **Generation Formulas**:
  - Action Prefixes (`get-`, `try-`, `use-`)
  - Modern Tech Suffixes (`-hub`, `-lab`, `-flow`, `-base`)
  - Compound Word Mixer (`kw1 + kw2`, e.g., `cloudflow`, `flowcloud`)
  - Hyphenated variations (`kw1-kw2`)
- **Custom Affixes**: Add your own custom prefixes and suffixes.
- **Target TLD Selector**: Toggle any combination of TLDs, with prominent **`.pw`**, **`.sh`**, **`.ro`**, `.com`, `.io`, `.ai`, `.co`.
- **Live Streamed Availability**: Streams results via SSE directly into Available and Taken columns with live telemetry metrics.

---

## 🚀 Two-Tier Resolution Pipeline

1. **Tier 1 (Cloudflare DNS-over-HTTPS ~15ms)**:
   - Queries `https://cloudflare-dns.com/dns-query` for `NS` and `A` records (`accept: application/dns-json`).
   - If DNS records exist $\rightarrow$ domain is **TAKEN**.
2. **Tier 2 (Authoritative RDAP Fallback ~200ms)**:
   - Triggered only when DNS returns `NXDOMAIN` (Status 3) or no DNS answers.
   - Queries `https://rdap.org/domain/{domain}`.
   - `HTTP 404` $\rightarrow$ confirmed **AVAILABLE** (unregistered).
   - `HTTP 200` $\rightarrow$ confirmed **TAKEN** (registered, parked or inactive nameservers).
3. **Concurrency Limiting (`p-limit`)**: Batches 25 concurrent connections per stream.
4. **Zero-Latency In-Memory Caching**: 5-minute TTL cache on backend and client-side Map cache.

---

## 🏁 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run automated tests
npm test

# 3. Start the server
npm start
```

Access the pages in your browser:
- **Search Page**: [http://localhost:3000/search](http://localhost:3000/search)
- **Generator Page**: [http://localhost:3000/generator](http://localhost:3000/generator)

---

## 📡 API Endpoints

### 1. `GET /api/stream-domains?keyword=<term>`
Opens an SSE stream returning variations for a single search keyword.

### 2. `GET /api/stream-generator`
Opens an SSE stream generating and checking combinations based on user parameters.
**Query Parameters:**
- `keywords`: Comma-separated list of keywords (e.g. `cloud,flow`)
- `tlds`: Comma-separated list of target TLDs (e.g. `pw,sh,ro,ai,com`)
- `industry`: `ai`, `tech`, `creative`, `commerce`, `minimal`, `all`
- `includePrefixes`: `true` | `false`
- `includeSuffixes`: `true` | `false`
- `includeBlends`: `true` | `false`
- `includeHyphens`: `true` | `false`
- `customPrefixes`: Comma-separated custom prefixes
- `customSuffixes`: Comma-separated custom suffixes
- `maxCount`: Max variations to check (default: 60)
