# CLAUDE.md — Agent context for my-job-manager

> This file is the authoritative context for Claude Code operating on this project.
> Read it fully before executing any command or writing any code.
> Language rule: Claude Code always responds in English. All prompts to Claude Code are in English.

---

## Project identity

**Name:** my-job-manager  
**Path (Windows):** `C:\My-proyectos\my-job-manager`  
**Path (WSL):** `/mnt/c/My-proyectos/my-job-manager`  
**Purpose:** Automated job scraper for ETTs and employment portals in Barcelona, Spain.  
**Runtime:** Node.js ≥ 18, ES modules (`"type": "module"` in package.json).  
**Status:** ✅ READY TO RUN (all 45 audit checks passed)

---

## Active profiles

### RCP (urgent)
Target roles: recepcionista, administrativo, atención al cliente, auxiliar administrativo, back office,
vigilante seguridad, conserje, teleoperador inbound, dependiente, cajero.

Night-shift keywords (priority):
recepcionista nocturno, botones nocturno, room service nocturno, limpiador nocturno,
supervisor limpieza nocturna, teleoperador nocturno, customer service nocturno,
telefonista nocturno, conserje nocturno, tecnico mantenimiento nocturno,
repartidor nocturno, mensajero nocturno.

Active filters: Barcelona city only · immediate availability · night shift 22:00–06:00 accepted.

Exclusions (hard-reject any offer containing these terms):
mozo, almacen, carga, descarga, carretilla, carretillero, peon, construccion, obra,
VTC, conductor, chofer, camion, camionero, trabajo en altura, soldador,
electricista obra, preparador de pedidos.

### ECB (low urgency)
Target roles: formador IT, formador IA, MCP, Python, Docker, FUNDAE, certificados de profesionalidad,
instructor técnico, formador técnico.

---

## Verified source URLs

Replace `KEYWORD` literally with the URL-encoded search term.

```
Randstad:  https://www.randstad.es/candidatos/ofertas-empleo/p-barcelona/c-barcelona/q-KEYWORD/
Indeed:    https://es.indeed.com/jobs?q=KEYWORD&l=Barcelona&fromage=3
Manpower:  https://www.manpower.es/es/buscar-trabajo?page=1&searchKeyword=KEYWORD&latitude=41.3874374&longitude=2.1686496&place=Barcelona,+España
Adecco:    https://www.adecco.com/es-es/ofertas-trabajo?jobTitle=KEYWORD&jobLocation=Barcelona,+España&radius=20
Infojobs:  https://www.infojobs.net/jobsearch/search-results/list.xhtml?keyword=KEYWORD&provinceIds=9&sortBy=RELEVANCE&countryIds=17&sinceDate=ANY
```

These URLs have been verified by manual navigation and tested with Playwright. Do not alter query parameters without explicit instruction.

---

## File map

```
config/
  ett-list.json          15 ETTs with URLs (filtered to 5 active)
  profiles.json          Keywords for ECB and RCP profiles (22 RCP + 8 ECB)
  search-config.json     Runtime parameters (concurrency=2, delays=2000ms, timeout=30000ms)

src/
  scrapers/
    base-scraper.js      Playwright base class with acceptCookies() method (13 selectors)
  store.js               SQLite layer (better-sqlite3, synchronous)
  matcher.js             Offer scoring against RCP/ECB profiles
  quick-search.js        Main scraper: 5 sources × RCP keywords with pLimit concurrency
  debug-selectors.js     DOM diagnostic tool (outputs JSON per source)
  find-real-urls.js      Captures real URLs via browser interaction (headless: false)

offers.db                SQLite database (created by src/store.js at runtime, stores matched offers)
package.json
README.md
CLAUDE.md                (this file)
```

---

## Architecture (implemented)

```
quick-search.js
    ├── load config (concurrency, delays, timeout)
    ├── load profiles (RCP keywords: 22 total)
    ├── load sources (5 active ETTs: randstad, indeed, manpower, adecco, infojobs)
    │
    └─→ for each keyword (22) × source (5) [pLimit concurrency=2]:
            │
            ├── new BaseScraper(keyword)
            │
            ├── scraper.initialize()
            │   └── chromium.launch({ headless: true })
            │
            ├── scraper.page.goto(url_with_keyword, { waitUntil: 'domcontentloaded' })
            │
            ├── scraper.acceptCookies()
            │   └── try 13 different selectors to dismiss cookie popups
            │
            ├── extractOffersFromPage(page)
            │   └── querySelectorAll(5 generic selectors) → deduplicate by title+url
            │
            ├── for each offer:
            │   ├── matchOffer(offer) → { score_ECB, score_RCP, matched_profile }
            │   └── store.save(offer + match result) → jobs.db
            │
            ├── console.log("[source] keyword='X' → N found, M saved")
            │
            └── scraper.close() + wait delayBetweenRequests
```

---

## Tech stack constraints

| Concern | Rule |
|---|---|
| Module system | ES modules only. Never use `require()` or `module.exports`. All imports must include `.js` extension. |
| SQLite | `better-sqlite3` is synchronous. Never use `await` on DB calls. `db.prepare().run()` is the pattern. |
| Browser | Playwright with Chromium. `acceptCookies()` must be called before any DOM extraction. |
| Concurrency | `p-limit` controls parallel requests. Default limit: 2 (configured in search-config.json). |
| Cookies | Every scraper must call `acceptCookies()` after page.goto() and before extracting data. |
| URL template | Use the string `KEYWORD` as a literal placeholder in ett-list.json; each scraper interpolates it. |
| Imports | All imports must use full file extensions: `import x from './x.js'`. Bare imports fail in Node.js ES modules. |
| Extraction | Use generic selectors (article, [class*="offer"], [class*="job"], [class*="card"], li[class*="result"]) + deduplication. CSS specificity changes per portal; hardcoding fails. |

---

## Current status

🔄 **FUNCTIONAL BUT NOT PERSISTING** (as of 2026-07-17)

Diagnostic findings:
- ✅ Extraction working: All 5 sources extracting offers correctly with normalized URLs
- ✅ Matching working: 100% of Infojobs offers match RCP profile (score_RCP ≥ 1, is_relevant=true)
- ⚠️ Persistence broken: store.save() rejecting all offers as duplicates due to database path configuration
- ⚠️ Database path: src/store.js line 31 uses `offers.db` but no explicit path in search-config.json

**Root cause:** store.js isNew() queries empty/uninitialized database, so all offers appear as duplicates.

**Next step:** Configure database path explicitly in search-config.json or verify offers.db persistence, then re-run scraper.

---

## Database schema

File: `offers.db` (SQLite, created by `src/store.js` on first run in project root).

```sql
CREATE TABLE IF NOT EXISTS offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ett_id TEXT,
  ett_name TEXT,
  title TEXT,
  description TEXT,
  url TEXT,
  date_posted TEXT,
  scraped_at TEXT,
  keyword_used TEXT,
  score_ECB INTEGER DEFAULT 0,
  score_RCP INTEGER DEFAULT 0,
  matched_profile TEXT,
  seen INTEGER DEFAULT 0
);
```

Indexes created for performance:
- `idx_offers_title_ett_id_url` — deduplication lookups
- `idx_offers_profile_scraped` — getByProfile() queries

---

## Execution environment

| Layer | Detail |
|---|---|
| Dev OS | Windows 11 Pro + WSL2 Ubuntu |
| Node | v22.14.0 (ES modules native) |
| Shell | All commands run inside WSL2 Ubuntu or Windows terminal |
| Working directory | `C:\My-proyectos\my-job-manager` |
| Production target | Orange Pi 5 Max — ARM64/aarch64, RK3588, Ubuntu, Docker |

**ARM64 rule:** Before proposing any Docker image or binary for production deployment,
verify ARM64 compatibility with:
```bash
docker manifest inspect <image> | grep architecture
```

---

## Command reference

```bash
# Run main scraper (READY)
node src/quick-search.js

# Diagnose DOM per source (for troubleshooting)
node src/debug-selectors.js

# Merge debug output into single JSON
node src/merge-debug-output.js

# Capture real URLs for dynamic portals
node src/find-real-urls.js

# Install Playwright browser (first time)
npx playwright install chromium

# Validate Playwright
npx playwright --version
```

---

## Coding rules for Claude Code

1. **Complete blocks only.** Never truncate with `// rest of code` or equivalent.
2. **Block header comment:** every code block starts with a comment: name, path, type (new / full replacement / replacement lines X–Y).
3. **No invented information.** If a selector, URL, or parameter is unknown, output a TODO comment and explain what to verify.
4. **No unsolicited changes.** Only modify what the current task requires. Do not refactor or add features beyond scope.
5. **If the only output needed is terminal commands,** output them directly with no prose wrapper.
6. **One confirmation question maximum** — at the end of the output block, never inline.
7. **Test assumptions before asserting.** If a package version or API signature is uncertain, flag it explicitly.
8. **Always use `.js` extension in imports.** Bare imports like `'./store'` will fail in Node.js ES modules.

---

## Pending work (ordered by priority)

| # | Task | Status |
|---|---|---|
| 1 | Fix database persistence: verify offers.db is created and readable | 🔴 CRITICAL |
| 2 | Confirm store.save() successfully inserts matched offers | 🔄 Next |
| 3 | Run full scraper and verify offers are persisted to database | ⏳ After fix |
| 4 | Debug remaining URL quality issues (Randstad 0%, Infojobs hostname validation) | ⏳ After persistence |
| 5 | Enable ECB profile in matching logic | ⏳ |
| 6 | Add remaining 10 ETTs from `ett-list.json` | ⏳ |
| 7 | Build export / report output (CLI table or HTML) | ⏳ |
| 8 | Docker packaging for Orange Pi 5 Max (ARM64) | ⏳ |
| 9 | Automated scheduling (cron / systemd timer) | ⏳ |
