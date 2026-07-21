#!/usr/bin/env node

import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SESSIONS_DIR = resolve(__dirname, '../sessions');

async function main() {
  const url = process.argv[2];
  const ettName = process.argv[3];

  if (!url || !ettName) {
    console.error('Usage: node browser-open.js <url> <ett_name>');
    process.exit(1);
  }

  let storageState = undefined;
  const sessionPath = resolve(SESSIONS_DIR, `${ettName}.json`);

  if (existsSync(sessionPath)) {
    try {
      const sessionData = readFileSync(sessionPath, 'utf-8');
      storageState = JSON.parse(sessionData);
      console.log(`Loaded session from ${sessionPath}`);
    } catch (error) {
      console.warn(`Failed to load session: ${error.message}`);
    }
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: false });

    const context = await browser.newContext({
      ...(storageState && { storageState })
    });

    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait until the user closes the browser window
    await new Promise((resolve) => {
      context.on('close', resolve);
      browser.on('disconnected', resolve);
    });

    await browser.close().catch(() => {});
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
