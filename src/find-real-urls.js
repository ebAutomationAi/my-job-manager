#!/usr/bin/env node

import { chromium } from 'playwright';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acceptCookies(page) {
  const cookieSelectors = [
    'button[id*="accept"]',
    'button[id*="cookie"]',
    'button[class*="accept"]',
    'button[class*="cookie"]',
    'button[class*="consent"]',
    'button[id*="consent"]',
    '#onetrust-accept-btn-handler',
    '#acceptAllButton',
    '.cookie-accept',
    '[data-testid*="cookie"] button',
    'button:has-text("Aceptar")',
    'button:has-text("Aceptar todas")',
    'button:has-text("Aceptar todo")',
    'button:has-text("Accept")',
    'button:has-text("Accept all")',
    'button:has-text("Permitir")',
    'button:has-text("Permitir todas")',
  ];

  for (const selector of cookieSelectors) {
    try {
      const btn = await page.$(selector);
      if (btn) {
        await btn.click();
        await page.waitForTimeout(1500);
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

async function searchInfojobs(page) {
  try {
    console.log('\n🔍 Infojobs: Navigating to homepage...');
    await page.goto('https://www.infojobs.net', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(2000);

    console.log('   Handling cookie consent...');
    await acceptCookies(page);

    console.log('   Finding and filling search form...');
    const keywordInput = await page.$('input[name="keyword"]');
    if (!keywordInput) {
      console.log('   ❌ Keyword input not found');
      return null;
    }

    await keywordInput.click();
    await page.keyboard.type('recepcionista', { delay: 50 });

    const locationInputs = await page.$$('input[type="text"]');
    let locationInput = null;
    for (const input of locationInputs) {
      const placeholder = await input.getAttribute('placeholder');
      if (placeholder && placeholder.toLowerCase().includes('ubicación')) {
        locationInput = input;
        break;
      }
    }

    if (locationInput) {
      await locationInput.click();
      await page.keyboard.press('Control+A');
      await page.keyboard.type('Barcelona', { delay: 50 });
    }

    console.log('   Clicking search button...');
    const searchButton = await page.$('button:has-text("Buscar"), button[type="submit"]');
    if (searchButton) {
      await searchButton.click();
    } else {
      await page.keyboard.press('Enter');
    }

    await delay(4000);
    const finalUrl = page.url();
    console.log(`✅ INFOJOBS_URL: ${finalUrl}`);
    return finalUrl;
  } catch (error) {
    console.log(`❌ ERROR infojobs: ${error.message}`);
    return null;
  }
}

async function searchManpower(page) {
  try {
    console.log('\n🔍 Manpower: Navigating to homepage...');
    await page.goto('https://www.manpower.es', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(2000);

    console.log('   Handling cookie consent...');
    await acceptCookies(page);

    console.log('   Finding and filling search form...');
    const searchInput = await page.$('input[name="searchJobText"]');
    if (!searchInput) {
      console.log('   ❌ Search input not found');
      return null;
    }

    await searchInput.click();
    await page.keyboard.type('recepcionista', { delay: 50 });

    const locationInputs = await page.$$('input[type="text"]');
    let locationInput = null;
    for (const input of locationInputs) {
      const placeholder = await input.getAttribute('placeholder');
      if (placeholder && placeholder.toLowerCase().includes('ciudad')) {
        locationInput = input;
        break;
      }
    }

    if (locationInput) {
      await locationInput.click();
      await page.keyboard.press('Control+A');
      await page.keyboard.type('Barcelona', { delay: 50 });
    }

    console.log('   Clicking search button...');
    const searchButton = await page.$('button[type="submit"], button:has-text("Buscar")');
    if (searchButton) {
      await searchButton.click();
    } else {
      await page.keyboard.press('Enter');
    }

    await delay(4000);
    const finalUrl = page.url();
    console.log(`✅ MANPOWER_URL: ${finalUrl}`);
    return finalUrl;
  } catch (error) {
    console.log(`❌ ERROR manpower: ${error.message}`);
    return null;
  }
}

async function searchAdecco(page) {
  try {
    console.log('\n🔍 Adecco: Navigating to homepage...');
    await page.goto('https://www.adecco.es', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(2000);

    console.log('   Handling cookie consent...');
    await acceptCookies(page);

    console.log('   Finding and filling search form...');
    const inputs = await page.$$('input[type="text"]');
    let jobInput = null;
    let locationInput = null;

    for (const input of inputs) {
      const placeholder = await input.getAttribute('placeholder');
      const name = await input.getAttribute('name');

      if (placeholder || name) {
        const attrStr = (placeholder || name || '').toLowerCase();
        if (attrStr.includes('empleo') || attrStr.includes('puesto') || attrStr.includes('trabajo')) {
          jobInput = input;
        } else if (attrStr.includes('ubicación') || attrStr.includes('ciudad') || attrStr.includes('localidad')) {
          locationInput = input;
        }
      }
    }

    if (jobInput) {
      await jobInput.click();
      await page.keyboard.type('recepcionista', { delay: 50 });
    }

    if (locationInput) {
      await locationInput.click();
      await page.keyboard.type('Barcelona', { delay: 50 });
    }

    console.log('   Clicking search button...');
    const searchButton = await page.$('button[type="submit"], button:has-text("Buscar")');
    if (searchButton) {
      await searchButton.click();
    } else {
      await page.keyboard.press('Enter');
    }

    await delay(4000);
    const finalUrl = page.url();
    console.log(`✅ ADECCO_URL: ${finalUrl}`);
    return finalUrl;
  } catch (error) {
    console.log(`❌ ERROR adecco: ${error.message}`);
    return null;
  }
}

async function searchRandstad(page) {
  try {
    console.log('\n🔍 Randstad: Navigating to homepage...');
    await page.goto('https://www.randstad.es', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(2000);

    console.log('   Handling cookie consent...');
    await acceptCookies(page);

    console.log('   Finding and filling search form...');
    const inputs = await page.$$('input[type="text"]');
    let jobInput = null;
    let locationInput = null;

    for (const input of inputs) {
      const placeholder = await input.getAttribute('placeholder');
      const name = await input.getAttribute('name');

      if (placeholder || name) {
        const attrStr = (placeholder || name || '').toLowerCase();
        if (attrStr.includes('empleo') || attrStr.includes('puesto') || attrStr.includes('trabajo')) {
          jobInput = input;
        } else if (attrStr.includes('ubicación') || attrStr.includes('ciudad') || attrStr.includes('localidad')) {
          locationInput = input;
        }
      }
    }

    if (jobInput) {
      await jobInput.click();
      await page.keyboard.type('recepcionista', { delay: 50 });
    }

    if (locationInput) {
      await locationInput.click();
      await page.keyboard.type('Barcelona', { delay: 50 });
    }

    console.log('   Clicking search button...');
    const searchButton = await page.$('button[type="submit"], button:has-text("Buscar")');
    if (searchButton) {
      await searchButton.click();
    } else {
      await page.keyboard.press('Enter');
    }

    await delay(4000);
    const finalUrl = page.url();
    console.log(`✅ RANDSTAD_URL: ${finalUrl}`);
    return finalUrl;
  } catch (error) {
    console.log(`❌ ERROR randstad: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('\n📋 Finding Real URLs After Manual Search (keyword: recepcionista, location: Barcelona)\n');
  console.log('='.repeat(70));

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: USER_AGENT,
  });

  const urls = {};

  const page1 = await context.newPage();
  urls.infojobs = await searchInfojobs(page1);
  await page1.close();
  await delay(3000);

  const page2 = await context.newPage();
  urls.manpower = await searchManpower(page2);
  await page2.close();
  await delay(3000);

  const page3 = await context.newPage();
  urls.adecco = await searchAdecco(page3);
  await page3.close();
  await delay(3000);

  const page4 = await context.newPage();
  urls.randstad = await searchRandstad(page4);
  await page4.close();

  await context.close();
  await browser.close();

  console.log('\n' + '='.repeat(70));
  console.log('\n📋 SUMMARY — Real URLs:\n');
  console.log('Infojobs:');
  console.log(`  ${urls.infojobs || 'FAILED'}\n`);
  console.log('Manpower:');
  console.log(`  ${urls.manpower || 'FAILED'}\n`);
  console.log('Adecco:');
  console.log(`  ${urls.adecco || 'FAILED'}\n`);
  console.log('Randstad:');
  console.log(`  ${urls.randstad || 'FAILED'}\n`);

  console.log('='.repeat(70));
  console.log('');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
