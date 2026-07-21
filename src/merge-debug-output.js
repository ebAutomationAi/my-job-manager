#!/usr/bin/env node

import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DEBUG_OUTPUT_DIR = resolve(__dirname, '../debug-output');

const SOURCES = ['infojobs', 'indeed', 'manpower', 'adecco', 'randstad'];

async function mergeDebugOutput() {
  console.log('\n📋 Merging debug output files...\n');

  const merged = {};

  for (const source of SOURCES) {
    const filePath = resolve(DEBUG_OUTPUT_DIR, `${source}.json`);
    try {
      const content = await readFile(filePath, 'utf-8');
      merged[source] = JSON.parse(content);
      console.log(`✅ Loaded ${source}.json`);
    } catch (error) {
      console.warn(`⚠ Could not read ${source}.json: ${error.message}`);
      merged[source] = null;
    }
  }

  const outputPath = resolve(DEBUG_OUTPUT_DIR, 'combined-debug.json');
  await writeFile(outputPath, JSON.stringify(merged, null, 2), 'utf-8');

  console.log(`\n✅ Combined output saved to debug-output/combined-debug.json\n`);
}

mergeDebugOutput().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
