import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CONFIG_PATH = resolve(__dirname, '../config/search-config.json');

class Store {
  constructor() {
    this.db = null;
    this.config = this.loadConfig();
    this.initialize();
  }

  loadConfig() {
    try {
      const configData = readFileSync(CONFIG_PATH, 'utf-8');
      return JSON.parse(configData);
    } catch (error) {
      console.warn(`Config file not found at ${CONFIG_PATH}, using defaults`);
      return {
        output: {
          db_path: resolve(__dirname, '../offers.db'),
        },
      };
    }
  }

  initialize() {
    const dbPath = this.config.output?.db_path || resolve(__dirname, '../offers.db');
    this.db = new Database(dbPath);

    this.db.pragma('journal_mode = WAL');

    this.createTables();
  }

  createTables() {
    const createOffersTable = `
      CREATE TABLE IF NOT EXISTS offers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ett_id TEXT,
        ett_name TEXT,
        title TEXT,
        description TEXT,
        url TEXT,
        date_posted TEXT,
        published_at TEXT,
        scraped_at TEXT,
        keyword_used TEXT,
        score_ECB INTEGER DEFAULT 0,
        score_RCP INTEGER DEFAULT 0,
        matched_profile TEXT,
        seen INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        ai_summary TEXT,
        ai_requirements TEXT,
        ai_salary TEXT,
        ai_modality TEXT,
        ai_profile TEXT,
        ai_score INTEGER,
        ai_reason TEXT,
        reviewed_at TEXT
      )
    `;

    this.db.exec(createOffersTable);

    const createIndexStmt = `
      CREATE INDEX IF NOT EXISTS idx_offers_title_ett_id_url
      ON offers(title, ett_id, url)
    `;
    this.db.exec(createIndexStmt);

    const createProfileIndexStmt = `
      CREATE INDEX IF NOT EXISTS idx_offers_profile_scraped
      ON offers(matched_profile, scraped_at DESC)
    `;
    this.db.exec(createProfileIndexStmt);
  }

  isNew(offer) {
    const stmt = this.db.prepare(`
      SELECT id FROM offers
      WHERE ett_id = ? AND url = ?
      LIMIT 1
    `);
    const result = stmt.get(offer.ett_id || '', offer.url || '');
    return !result;
  }

  save(offer) {
    if (!this.isNew(offer)) {
      return null;
    }

    const stmt = this.db.prepare(`
      INSERT INTO offers (
        ett_id, ett_name, title, description, url, date_posted,
        scraped_at, keyword_used, score_ECB, score_RCP, matched_profile, seen, published_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      offer.ett_id || null,
      offer.ett_name || null,
      offer.title || '',
      offer.description || '',
      offer.url || '',
      offer.date_posted || null,
      offer.scraped_at || new Date().toISOString(),
      offer.keyword_used || '',
      offer.score_ECB || 0,
      offer.score_RCP || 0,
      offer.matched_profile || null,
      offer.seen || 0,
      offer.published_at || null
    );

    return info.lastInsertRowid;
  }

  getByProfile(profileId, minScore = 0) {
    const stmt = this.db.prepare(`
      SELECT * FROM offers
      WHERE matched_profile = ? AND (score_ECB >= ? OR score_RCP >= ?)
      ORDER BY scraped_at DESC
    `);

    return stmt.all(profileId, minScore, minScore);
  }

  markSeen(id) {
    const stmt = this.db.prepare(`
      UPDATE offers SET seen = 1 WHERE id = ?
    `);

    const info = stmt.run(id);
    return info.changes > 0;
  }

  getOfferById(id) {
    const stmt = this.db.prepare(`
      SELECT * FROM offers WHERE id = ?
    `);

    return stmt.get(id);
  }

  getUnseenCount() {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM offers WHERE seen = 0
    `);

    const result = stmt.get();
    return result.count;
  }

  getAllOffers(limit = 100, offset = 0) {
    const stmt = this.db.prepare(`
      SELECT * FROM offers ORDER BY scraped_at DESC LIMIT ? OFFSET ?
    `);

    return stmt.all(limit, offset);
  }

  deleteOffer(id) {
    const stmt = this.db.prepare(`
      DELETE FROM offers WHERE id = ?
    `);

    const info = stmt.run(id);
    return info.changes > 0;
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

const store = new Store();

export default store;
