# my-job-manager

Automated job scraper and AI enrichment dashboard for ETT portals in Barcelona.

## What it does

- Scrapes job offers from Infojobs, Adecco and Manpower using Playwright
- Evaluates each offer against a candidate profile using Groq LLaMA 3.3
- Auto-discards offers with score below 7 (wrong shift, wrong location, physical work)
- Shows only relevant offers in a real-time dashboard

## Stack

- Node.js + ES Modules
- Playwright (scraping)
- SQLite + better-sqlite3 (storage)
- Groq API / LLaMA 3.3 70B (AI enrichment)
- Express (dashboard API)
- Vanilla JS dashboard (no framework)

## Setup

```bash
npm install
npx playwright install chromium
cp .env.example .env
# Add your Groq API key to .env
```

## Usage

```bash
# Start dashboard
npm run server

# Scrape all sources
node src/quick-search.js

# Scrape last 7 days only
node src/quick-search.js --incremental
```

## Architecture

Playwright scraper → SQLite DB → Groq LLaMA 3.3 → Express API → Dashboard

## Candidate profile (configurable)

Edit `config/profiles.json` to change keywords and scoring criteria.
Edit `src/server.js` userPrompt to change the AI evaluation logic.
