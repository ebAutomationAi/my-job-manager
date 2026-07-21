#!/usr/bin/env node

import Database from 'better-sqlite3';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DB_PATH = resolve(__dirname, '../offers.db');

const db = new Database(DB_PATH);

try {
  const result = db.prepare('DELETE FROM offers').run();
  console.log(`✅ Deleted ${result.changes} offers from database`);

  const count = db.prepare('SELECT COUNT(*) as count FROM offers').get();
  console.log(`✅ Table now contains ${count.count} offers`);
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
} finally {
  db.close();
}
