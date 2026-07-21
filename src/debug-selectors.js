#!/usr/bin/env node

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DEBUG_OUTPUT_DIR = resolve(__dirname, '../debug-output');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const SOURCES = [
  {
    name: 'infojobs',
    url: 'https://www.infojobs.net/jobsearch/search-results/list.xhtml?keyword=recepcionista+nocturno&provinceIds=9&sortBy=RELEVANCE&countryIds=17&sinceDate=ANY',
  },
  {
    name: 'indeed',
    url: 'https://es.indeed.com/jobs?q=recepcionista+nocturno&l=Barcelona&fromage=3',
  },
  {
    name: 'manpower',
    url: 'https://www.manpower.es/es/buscar-trabajo?page=1&searchKeyword=recepcionista+nocturno&latitude=41.3874374&longitude=2.1686496&place=Barcelona,+España',
  },
  {
    name: 'adecco',
    url: 'https://www.adecco.com/es-es/ofertas-trabajo?jobTitle=recepcionista+nocturno&jobLocation=Barcelona,+España&radius=20',
  },
  {
    name: 'randstad',
    url: 'https://www.randstad.es/candidatos/ofertas-empleo/p-barcelona/c-barcelona/q-recepcionista-nocturno/',
  },
];

async function acceptCookies(page) {
  const selectors = [
    '#didomi-notice-agree-button',
    '#onetrust-accept-btn-handler',
    '#acceptAllButton',
    'button[id*="accept"]',
    'button[class*="accept"]',
    'button[class*="consent"]',
    'button:has-text("Aceptar todas")',
    'button:has-text("Aceptar todo")',
    'button:has-text("Aceptar")',
    'button:has-text("Accept all")',
    'button:has-text("Permitir todas")',
  ];

  for (const sel of selectors) {
    try {
      const btn = await page.$(sel);
      if (btn) {
        await btn.click();
        await page.waitForTimeout(2000);
        return;
      }
    } catch {
      continue;
    }
  }
}

async function extractDiagnostics(page) {
  return page.evaluate(() => {
    const helpers = {
      getHtmlSnippet: (element) => {
        if (!element) return '';
        const clone = element.cloneNode(true);
        return clone.outerHTML.substring(0, 500);
      },

      getFirstElements: (selector, count) => {
        const elements = document.querySelectorAll(selector);
        const results = [];
        for (let i = 0; i < Math.min(count, elements.length); i++) {
          results.push(helpers.getHtmlSnippet(elements[i]));
        }
        return results;
      },

      getUniqueClasses: (elements) => {
        const classSet = new Set();
        for (const el of elements) {
          const classes = el.className.split(/\s+/).filter((c) => c.trim());
          for (const cls of classes) {
            classSet.add(cls);
          }
        }
        return Array.from(classSet).sort();
      },
    };

    const articles = document.querySelectorAll('article');
    const liWithAnchorAndHeading = Array.from(
      document.querySelectorAll('li')
    ).filter((li) => {
      const hasAnchor = li.querySelector('a');
      const hasHeading = li.querySelector('h2, h3');
      return hasAnchor && hasHeading;
    });

    return {
      title: document.title,
      totalAnchors: document.querySelectorAll('a').length,
      totalHeadings: document.querySelectorAll('h2, h3').length,
      firstArticles: helpers.getFirstElements('article', 3),
      firstCards: helpers.getFirstElements('[class*="card"]', 3),
      firstOffers: helpers.getFirstElements('[class*="offer"]', 3),
      firstJobs: helpers.getFirstElements('[class*="job"]', 3),
      articleClasses: helpers.getUniqueClasses(articles),
      liClasses: helpers.getUniqueClasses(liWithAnchorAndHeading),
    };
  });
}

async function debugSource(browser, source) {
  const page = await browser.newPage();

  try {
    console.log(`\n🔍 Debugging ${source.name.toUpperCase()}...`);
    console.log(`   URL: ${source.url}`);

    await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);

    console.log(`   Handling cookie consent...`);
    await acceptCookies(page);

    const diagnostics = await extractDiagnostics(page);

    const outputPath = resolve(DEBUG_OUTPUT_DIR, `${source.name}.json`);
    await writeFile(outputPath, JSON.stringify(diagnostics, null, 2), 'utf-8');

    console.log(`✅ ${source.name.toUpperCase()} — saved to debug-output/${source.name}.json`);

    return diagnostics;
  } catch (error) {
    console.error(`❌ ${source.name.toUpperCase()} — Error: ${error.message}`);
    return null;
  } finally {
    await page.close();
  }
}

async function main() {
  console.log(`\n📋 Debug Selectors - Job Sources (keyword: recepcionista nocturno)\n`);
  console.log('='.repeat(60));

  await mkdir(DEBUG_OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: false,
  });

  const context = await browser.newContext({
    userAgent: USER_AGENT,
  });

  for (const source of SOURCES) {
    await debugSource(await browser.newContext({ userAgent: USER_AGENT }), source);
  }

  await context.close();
  await browser.close();

  console.log('\n' + '='.repeat(60));
  console.log(`\n✅ Diagnostics complete!\n`);
  console.log(`📁 Output directory: debug-output/\n`);
  console.log(`Files created:`);
  for (const source of SOURCES) {
    console.log(`  • ${source.name}.json`);
  }
  console.log('');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
