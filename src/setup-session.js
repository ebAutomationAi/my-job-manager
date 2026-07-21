#!/usr/bin/env node

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SESSIONS_DIR = resolve(__dirname, '../sessions');

const LOGIN_URLS = {
  infojobs: 'https://www.infojobs.net/login',
  adecco: 'https://www.adecco.es/login',
  manpower: 'https://www.manpower.es/login',
  indeed: 'https://es.indeed.com/account/login'
};

async function main() {
  const ettName = process.argv[2];

  if (!ettName) {
    console.error('Usage: node setup-session.js <ett_name>');
    console.error('Available ETTs: ' + Object.keys(LOGIN_URLS).join(', '));
    process.exit(1);
  }

  const loginUrl = LOGIN_URLS[ettName] || 'about:blank';

  mkdirSync(SESSIONS_DIR, { recursive: true });

  let browser;
  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log(`Opening ${ettName} login page...`);
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const readline = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\nLog in manually in the browser window.');
    console.log('When done, press ENTER to save session...');

    await new Promise(resolve => {
      readline.question('', () => {
        readline.close();
        resolve();
      });
    });

    const storageState = await context.storageState();
    const sessionPath = resolve(SESSIONS_DIR, `${ettName}.json`);
    writeFileSync(sessionPath, JSON.stringify(storageState, null, 2));

    console.log(`✅ Session saved to ${sessionPath}`);

    await browser.close();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    if (browser) await browser.close();
    process.exit(1);
  }
}

main();
