import Database from 'better-sqlite3';

const db = new Database('./offers.db');
const total = db.prepare('SELECT COUNT(*) as n FROM offers').get().n;
const enriched = db.prepare('SELECT COUNT(*) as n FROM offers WHERE ai_score IS NOT NULL').get().n;
const discarded = db.prepare('SELECT COUNT(*) as n FROM offers WHERE status = \'descartada\'').get().n;
const pending = db.prepare('SELECT COUNT(*) as n FROM offers WHERE ai_score IS NULL').get().n;
console.log({total, enriched, discarded, pending});
db.close();
