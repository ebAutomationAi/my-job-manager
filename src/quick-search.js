#!/usr/bin/env node

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import pLimit from 'p-limit';
import BaseScraper from './scrapers/base-scraper.js';
import store from './store.js';
import { matchOffer } from './matcher.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CONFIG_PATH = resolve(__dirname, '../config/search-config.json');
const PROFILES_PATH = resolve(__dirname, '../config/profiles.json');
const ETT_LIST_PATH = resolve(__dirname, '../config/ett-list.json');

const INCREMENTAL = process.argv.includes('--incremental');

const EXTRACTORS = {
  infojobs: {
    container: '.ij-OfferList-offerCardItem',
    title:     'h2.ij-OfferCardContent-description-title a span, h2 a span, h2 a',
    company:   '[class*="company"], [class*="employer"], [class*="empresa"]',
    url:       'h2.ij-OfferCardContent-description-title a',
    published: '[class*="date"]',
  },

  manpower: {
    container: '.job-search-result.card',
    title:     'h2.title, h2.title.manpower, h2, h3',
    company:   '[class*="company"], [class*="employer"]',
    url:       'h2 a',
    published: 'div.date',
  },
  adecco: {
    container: 'article',
    title:     'p.large.text-01.mb0, h2, h3, p[class*="title"]',
    company:   '[class*="company"], [class*="empresa"], [class*="employer"]',
    url:       'a[href]',
    published: 'div.small.text-01',
  },
  randstad: {
    container: 'article, [class*="offer-item"], [class*="job-item"], .rand-job-card, div[class*="job"]',
    title:     'h2, h3, a[class*="title"], [class*="job-title"]',
    company:   '[class*="company"], [class*="employer"]',
    url:       'a[href*="/oferta-empleo/"], a[href*="/viewjob"], a[href]',
    published: null,
  },
};

function loadConfig() {
  try {
    const configData = readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(configData);
  } catch (error) {
    console.warn(`Config not found, using defaults`);
    return {
      concurrency: 2,
      delayBetweenRequests: 2000,
      headless: true,
      timeout: 30000,
      maxResultsPerSource: 50,
    };
  }
}

function loadProfiles() {
  try {
    const profilesData = readFileSync(PROFILES_PATH, 'utf-8');
    return JSON.parse(profilesData);
  } catch (error) {
    console.warn(`Profiles not found`);
    return { RCP: { keywords: [] } };
  }
}

function loadEttList() {
  try {
    const ettData = readFileSync(ETT_LIST_PATH, 'utf-8');
    const allSources = JSON.parse(ettData);
    const activeIds = ['manpower', 'adecco', 'infojobs'];
        return allSources.filter((source) => activeIds.includes(source.id) && source.enabled !== false);
  } catch (error) {
    console.warn(`ETT list not found`);
    return [];
  }
}

function getSourceUrl(source) {
  if (INCREMENTAL && source.url_incremental) {
    return source.url_incremental;
  }
  return source.url;
}

function buildUrl(sourceUrl, keyword) {
  if (sourceUrl.includes('randstad.es')) {
    const slug = keyword.toLowerCase().trim().replace(/\s+/g, '-');
    return sourceUrl.replace('KEYWORD', slug);
  }
  return sourceUrl.replace('KEYWORD', encodeURIComponent(keyword));
}

function normalizeUrl(url, sourceId) {
  try {
    // Handle protocol-relative URLs (//www.infojobs.net/...)
    if (url.startsWith('//')) {
      url = 'https:' + url;
    }
    const u = new URL(url);
    if (sourceId === 'infojobs') {
      if (!u.hostname.includes('infojobs.net')) return null;
      // Keep only origin + pathname, strip tracking params
      return 'https://www.infojobs.net' + u.pathname.split('?')[0];
    }
    return u.origin + u.pathname;
  } catch {
    return null;
  }
}

function parsePublishedAt(rawText, sourceId) {
  if (!rawText || typeof rawText !== 'string') return null;

  const text = rawText.trim();

  // src/quick-search.js — reemplazo bloque líneas 131-140
  if (sourceId === 'infojobs') {
    const now = new Date();
    if (/hoy|ahora/i.test(text)) return now.toISOString().split('T')[0];
    if (/ayer/i.test(text)) {
      const d = new Date(now); d.setDate(d.getDate() - 1);
      return d.toISOString().split('T')[0];
    }
    const mHours = text.match(/Hace\s+(\d+)\s*h/i);
    if (mHours) return now.toISOString().split('T')[0];
    const mDays = text.match(/Hace\s+(\d+)\s*d/i);
    if (mDays) {
      const d = new Date(now); d.setDate(d.getDate() - parseInt(mDays[1]));
      return d.toISOString().split('T')[0];
    }
    const mWeeks = text.match(/Hace\s+(\d+)\s*seman/i);
    if (mWeeks) {
      const d = new Date(now); d.setDate(d.getDate() - parseInt(mWeeks[1]) * 7);
      return d.toISOString().split('T')[0];
    }
  }
  if (sourceId === 'adecco') {
    // Format: "Publicado hace 4 día(s)"
    const match = text.match(/hace\s+(\d+)\s+día/i);
    if (match) {
      const daysAgo = parseInt(match[1]);
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      return date.toISOString().split('T')[0];
    }
  }

  if (sourceId === 'manpower') {
    // Format: "17/07/2026" (DD/MM/YYYY)
    const match = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (match) {
      const [, day, month, year] = match;
      return `${year}-${month}-${day}`;
    }
  }

  return null;
}

async function extractOffersFromPage(page, sourceId) {
  const extractor = EXTRACTORS[sourceId];
  if (!extractor) {
    console.warn(`[${sourceId}] No extractor defined — skipping`);
    return [];
  }

  const containers = await page.$$(extractor.container);
  const offers = [];

  for (const el of containers) {
    try {
      const title = await el.$eval(
        extractor.title,
        n => n.innerText?.trim().substring(0, 200) ?? ''
      ).catch(() => '');

      const url = await el.$eval(
        extractor.url,
        n => n.href ?? ''
      ).catch(() => '');

      const company = await el.$eval(
        extractor.company,
        n => n.innerText?.trim().substring(0, 100) ?? ''
      ).catch(() => '');

      let publishedRaw = '';
      if (extractor.published) {
        publishedRaw = await el.$eval(
          extractor.published,
          n => n.innerText?.trim() ?? ''
        ).catch(() => '');
      }

      const normalizedUrl = normalizeUrl(url, sourceId);
      if (!title || !normalizedUrl || !normalizedUrl.startsWith('http')) continue;

      const publishedAt = parsePublishedAt(publishedRaw, sourceId);
      offers.push({ title, url: normalizedUrl, company, published_at: publishedAt });
    } catch {
      continue;
    }
  }

  return offers;
}

async function fetchDescription(currentPage, url) {
  let page = null;
  try {
    const browser = currentPage.context().browser();
    if (!browser || browser.isConnected() === false) return '';
    page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    const text = await page.$eval('main', el => el.innerText).catch(() => '');
    return text.substring(0, 2000);
  } catch {
    return '';
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

async function scrapeSource(source, keyword, config) {
  const scraper = new BaseScraper(keyword);

  try {
    await scraper.initialize();

    const searchUrl = buildUrl(getSourceUrl(source), keyword);

    await scraper.page.goto(searchUrl, {
      waitUntil: 'domcontentloaded',
      timeout: config.timeout || 30000,
    });

    await scraper.acceptCookies();

    if (source.id === 'randstad') {
      await scraper.page.waitForSelector(
        'article, [class*="offer-item"], [class*="job-item"]',
        { timeout: 10000 }
      ).catch(() => {});
    } else if (source.id === 'infojobs') {
      await scraper.page.waitForSelector('.ij-OfferList-offerCardItem', { timeout: 15000 }).catch(() => {});
      await scraper.page.waitForTimeout(2000);
    } else {
      await scraper.page.waitForTimeout(2000);
    }

    // Adecco: requires click-per-article interaction to get direct URLs
    if (source.id === 'adecco') {
      await scraper.page.evaluate(() => {
        document.querySelectorAll('#onetrust-consent-sdk, .onetrust-pc-dark-filter').forEach(el => el.remove());
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      });

      const articleCount = await scraper.page.$$eval('article', els => els.length);
      const adeccoOffers = [];

      for (let i = 0; i < articleCount; i++) {
        await scraper.page.evaluate((idx) => {
          const buttons = document.querySelectorAll('article [role="button"]');
          if (buttons[idx]) buttons[idx].click();
        }, i);

        await scraper.page.waitForTimeout(800);

        const title = await scraper.page.$$eval(
          'article p.large.text-01.mb0',
          (els, idx) => els[idx]?.innerText?.trim() || '',
          i
        );

        const url = await scraper.page.$eval(
          'a.static_jobdetailpage_url',
          a => a.href
        ).catch(() => '');

        if (title && url) adeccoOffers.push({ title, url, company: 'Adecco' });
      }

      let savedCount = 0;
      for (const rawOffer of adeccoOffers) {
        const title = rawOffer.title;
        const offer = {
          title,
          description: rawOffer.company || '',
          url: rawOffer.url,
          ett_id: source.id,
          ett_name: source.name,
          keyword_used: keyword,
          source: source.id,
        };
        const matchResult = matchOffer(offer);
        if (matchResult.is_relevant)  {
          const saved = store.save({
            ...offer,
            score_ECB: matchResult.score_ECB,
            score_RCP: matchResult.score_RCP,
            matched_profile: matchResult.matched_profile,
          });
          if (saved) savedCount++;
        }
      }

      console.log(`[adecco] keyword='${keyword}' → ${adeccoOffers.length} offers found, ${savedCount} saved`);
      return savedCount;
    }

    const rawOffers = await extractOffersFromPage(scraper.page, source.id);

    let savedCount = 0;

    for (const rawOffer of rawOffers) {
      const title = rawOffer.title;

      let description = rawOffer.company || '';
      if (source.id === 'manpower' && rawOffer.url) {
        description = await fetchDescription(scraper.page, rawOffer.url) || rawOffer.company || '';
        await new Promise(r => setTimeout(r, 1500));
      }

      const offer = {
        title: title,
        description: description,
        url: rawOffer.url,
        published_at: rawOffer.published_at || null,
        ett_id: source.id,
        ett_name: source.name,
        keyword_used: keyword,
        source: source.id,
      };

      const matchResult = matchOffer(offer);

      if (matchResult.is_relevant) {
        const offerToSave = {
          ...offer,
          score_ECB: matchResult.score_ECB,
          score_RCP: matchResult.score_RCP,
          matched_profile: matchResult.matched_profile,
        };

        const saved = store.save(offerToSave);
        if (saved) {
          savedCount++;
        }
      }
    }

    console.log(`[${source.id}] keyword='${keyword}' → ${rawOffers.length} offers found, ${savedCount} saved`);

    return savedCount;
  } catch (error) {
    console.error(`[${source.id}] error for keyword='${keyword}': ${error.message}`);
    return 0;
  } finally {
    await scraper.close();
  }
}

async function main() {
  const modeLabel = INCREMENTAL ? '🔄 Modo incremental: últimos 7 días' : '📦 Modo completo: todas las ofertas';
  console.log(`\n📋 Quick Search\n${modeLabel}\n`);

  const config = loadConfig();
  const profiles = loadProfiles();
  const sources = loadEttList();
  const keywords = [
    ...(profiles.RCP?.keywords || []),
    ...(profiles.ECB?.keywords || []),
  ];
  console.log(`⚙️ Config: concurrency=${config.concurrency}, delay=${config.delayBetweenRequests}ms`);
  console.log(`🔑 Keywords: ${keywords.length}`);
  console.log(`📡 Sources: ${sources.length}`);
  console.log(`=`.repeat(60));

  const limit = pLimit(config.concurrency || 2);
  let totalSaved = 0;
  let taskIndex = 0;
  const totalTasks = keywords.length * sources.length;

  const tasks = [];

  for (const keyword of keywords) {
    for (const source of sources) {
      const task = limit(async () => {
        taskIndex++;
        const progress = `[${taskIndex}/${totalTasks}]`;
        console.log(`${progress} Scraping ${source.id} for '${keyword}'...`);

        const saved = await scrapeSource(source, keyword, config);
        totalSaved += saved;

        await new Promise((resolve) => setTimeout(resolve, config.delayBetweenRequests || 2000));
        return saved;
      });

      tasks.push(task);
    }
  }

  await Promise.all(tasks);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Total offers saved: ${totalSaved}\n`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
