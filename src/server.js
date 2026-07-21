#!/usr/bin/env node

import express from 'express';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DB_PATH = resolve(__dirname, '../offers.db');
const PROFILES_PATH = resolve(__dirname, '../config/profiles.json');

const app = express();
const PORT = process.env.PORT || 3000;

let db;
let profiles;

// Initialize database
function initializeDatabase() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // Ensure offers table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ett_id TEXT,
      ett_name TEXT,
      title TEXT,
      description TEXT,
      url TEXT,
      date_posted TEXT,
      scraped_at TEXT,
      keyword_used TEXT,
      score_ECB INTEGER DEFAULT 0,
      score_RCP INTEGER DEFAULT 0,
      matched_profile TEXT,
      seen INTEGER DEFAULT 0
    )
  `);

  // Add AI enrichment columns if they don't exist
  const columnNames = db.prepare(`PRAGMA table_info(offers)`).all().map(col => col.name);
  const requiredColumns = {
    published_at: 'TEXT',
    ai_summary: 'TEXT',
    ai_requirements: 'TEXT',
    ai_salary: 'TEXT',
    ai_modality: 'TEXT',
    ai_profile: 'TEXT',
    ai_score: 'INTEGER',
    ai_reason: 'TEXT',
    status: 'TEXT',
    reviewed_at: 'TEXT'
  };

  for (const [colName, colType] of Object.entries(requiredColumns)) {
    if (!columnNames.includes(colName)) {
      const stmt = `ALTER TABLE offers ADD COLUMN ${colName} ${colType}`;
      db.exec(stmt);
      console.log(`Added column: ${colName}`);
    }
  }

  // Initialize status for existing offers
  db.prepare(`UPDATE offers SET status = 'pending' WHERE status IS NULL`).run();

  console.log('Database initialized');
}

// Load profiles
function loadProfiles() {
  try {
    const data = readFileSync(PROFILES_PATH, 'utf-8');
    profiles = JSON.parse(data);
    console.log(`Loaded profiles: ${Object.keys(profiles).join(', ')}`);
  } catch (error) {
    console.warn(`Profiles not found at ${PROFILES_PATH}`);
    profiles = { RCP: { keywords: [] }, ECB: { keywords: [] } };
  }
}

// Async-compatible withDb wrapper
function withDb(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  };
}

// Middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.static(resolve(__dirname, '../public')));
// GET /api/stats
app.get('/api/stats', withDb(async (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as count FROM offers').get();
  const pending = db.prepare('SELECT COUNT(*) as count FROM offers WHERE status = \'pending\'').get();
  const reviewed = db.prepare('SELECT COUNT(*) as count FROM offers WHERE reviewed_at IS NOT NULL').get();
  const unenriched = db.prepare('SELECT COUNT(*) as count FROM offers WHERE ai_summary IS NULL').get();

  res.json({
    total: total.count,
    pending: pending.count,
    reviewed: reviewed.count,
    unenriched: unenriched.count
  });
}));

// GET /api/offers
app.get('/api/offers', withDb(async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  const status = req.query.status || null;
  const profile = req.query.profile || null;

  let query = 'SELECT * FROM offers';
  const params = [];

  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }

  if (profile) {
    query += status ? ' AND matched_profile = ?' : ' WHERE matched_profile = ?';
    params.push(profile);
  }

  query += ' ORDER BY published_at DESC NULLS LAST, id DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const offers = db.prepare(query).all(...params);
  res.json(offers);
}));

// GET /api/offers/grouped
app.get('/api/offers/grouped', withDb(async (req, res) => {
  const status = req.query.status || null;
  const profile = req.query.profile || null;
  const min_score = parseInt(req.query.min_score) || null;
  const search = req.query.search || null;

  let query = 'SELECT id, title, published_at, ai_summary, ai_score, ai_profile, ai_modality, ai_salary, status, url, ett_name FROM offers';
  const params = [];

  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  } else {
    // Default: hide descartadas unless explicitly filtered
    query += ' WHERE COALESCE(status, \'pending\') != \'descartada\'';
  }

  if (profile) {
    query += status ? ' AND matched_profile = ?' : ' WHERE matched_profile = ?';
    params.push(profile);
  }

  if (min_score !== null) {
    query += status || profile ? ' AND ai_score >= ?' : ' WHERE ai_score >= ?';
    params.push(min_score);
  }

  if (search) {
    query += status || profile || min_score !== null ? ' AND title LIKE ?' : ' WHERE title LIKE ?';
    params.push(`%${search}%`);
  }

  query += ' ORDER BY ett_name, published_at DESC NULLS LAST, id DESC';

  const offers = db.prepare(query).all(...params);

  const grouped = {};
  for (const offer of offers) {
    if (!grouped[offer.ett_name]) {
      grouped[offer.ett_name] = { ett_name: offer.ett_name, count: 0, pending_count: 0, offers: [] };
    }
    grouped[offer.ett_name].count++;
    if (offer.status === 'pending') grouped[offer.ett_name].pending_count++;
    grouped[offer.ett_name].offers.push(offer);
  }

  const result = Object.values(grouped);
  res.json(result);
}));

// GET /api/offers/:id
app.get('/api/offers/:id', withDb(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

  const offer = db.prepare('SELECT * FROM offers WHERE id = ?').get(id);
  if (!offer) {
    return res.status(404).json({ error: 'Offer not found' });
  }
  res.json(offer);
}));

// PATCH /api/offers/:id/status
app.patch('/api/offers/:id/status', withDb(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: 'status is required' });
  }

  const result = db.prepare('UPDATE offers SET status = ? WHERE id = ?').run(status, id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Offer not found' });
  }

  res.json({ ok: true });
}));

// GET /api/unenriched
app.get('/api/unenriched', withDb(async (req, res) => {
  const offers = db.prepare('SELECT id FROM offers WHERE ai_summary IS NULL').all();
  res.json(offers);
}));

// POST /api/enrich/:id
app.post('/api/enrich/:id', withDb(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

  const { groq_key } = req.body;
  if (!groq_key) {
    return res.status(400).json({ error: 'groq_key is required' });
  }

  const offer = db.prepare('SELECT * FROM offers WHERE id = ?').get(id);
  if (!offer) {
    return res.status(404).json({ error: 'Offer not found' });
  }

  // Build keywords list from RCP profile only
  const allKeywords = (profiles.RCP?.keywords || []).join(', ');

  const systemPrompt = `Eres un evaluador de ofertas de trabajo ETT para un candidato en Barcelona.
Evalúas EXCLUSIVAMENTE para trabajos nocturnos. Responde SOLO con JSON válido, sin backticks, sin texto adicional.`;

  const userPrompt = `PERFIL DEL CANDIDATO (Kiko):
- 20+ años atención al cliente multinacional, recepción, administración
- Idiomas: italiano (nativo), español (fluido), inglés (conversacional), catalán (básico)
- Habilidades: cierre de caja, auditoría de cobros, gestión de reservas, resolución de incidencias, POS
- Vehículo: moto propia
- Disponibilidad: SOLO turno nocturno
- Ubicación: Barcelona ciudad y L'Hospitalet de Llobregat

ÁRBOL DE DECISIÓN — aplicar EN ESTE ORDEN:

PASO 1 — TURNO:
Si turno de día, mañana, tarde, jornada partida o horario comercial
→ score 1, perfil_afin = "ninguno". STOP.
Si turno NO especificado → score 5, perfil_afin = "ninguno". STOP.
Si turno nocturno confirmado → continuar PASO 2.

PASO 2 — UBICACIÓN:
Extrae la localidad de la descripción Y del slug de la URL (e.g. "/castelldefels/" → Castelldefels).
Si la localidad identificada es distinta a Barcelona ciudad o L'Hospitalet de Llobregat
→ score 1, perfil_afin = "ninguno". STOP.
Si no se puede determinar la localidad → continuar PASO 3.
Si es Barcelona ciudad o L'Hospitalet → continuar PASO 3.

PASO 3 — DESCARTE FÍSICO:
Si requiere trabajo físico pesado, carretilla, carga/descarga,
operario fábrica, titulación sanitaria o habilitación seguridad
→ score 1, perfil_afin = "ninguno". STOP.

Si llega aquí → score 8, perfil_afin = "RCP".

OFERTA A EVALUAR:
Título: ${offer.title}
ETT: ${offer.ett_name}
URL: ${offer.url}
Descripción: ${offer.description}

Devuelve EXCLUSIVAMENTE este JSON:
{
  "resumen": "máximo 2 frases describiendo el puesto y el turno",
  "requisitos": ["req1", "req2", "req3"],
  "salario": "texto del salario o null",
  "modalidad": "presencial|híbrido|remoto|no especificado",
  "perfil_afin": "RCP|ninguno",
  "score": 7,
  "razon_score": "una frase mencionando el turno y por qué encaja o no con el perfil nocturno"
}`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groq_key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        max_tokens: 500,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(response.status).json({ error: error.error?.message || 'Groq API error' });
    }

    const data = await response.json();
    let content = data.choices[0].message.content.trim();

    // Remove markdown code blocks if present
    if (content.startsWith('```')) {
      content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const ai = JSON.parse(content);

    // Validate required fields
    const required = ['resumen', 'requisitos', 'salario', 'modalidad', 'perfil_afin', 'score', 'razon_score'];
    for (const field of required) {
      if (!(field in ai)) {
        return res.status(400).json({ error: `Missing field in Groq response: ${field}` });
      }
    }

    // Save to database
    db.prepare(`
      UPDATE offers SET
        ai_summary = ?,
        ai_requirements = ?,
        ai_salary = ?,
        ai_modality = ?,
        ai_profile = ?,
        ai_score = ?,
        ai_reason = ?,
        status = 'enriched'
      WHERE id = ?
    `).run(
      ai.resumen,
      JSON.stringify(ai.requisitos),
      ai.salario,
      ai.modalidad,
      ai.perfil_afin,
      ai.score,
      ai.razon_score,
      id
    );

    // Auto-discard offers with score <= 6
    if (Number(ai.score) <= 6) {
      db.prepare(
        "UPDATE offers SET status = 'descartada' WHERE id = ?"
      ).run(offer.id);
    }

    res.json({ ok: true, ai });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

// POST /api/open-url
app.post('/api/open-url', withDb(async (req, res) => {
  const { url, ett_name } = req.body;

  if (!url || !url.startsWith('http')) {
    return res.status(400).json({ error: 'Valid URL is required' });
  }

  if (!ett_name) {
    return res.status(400).json({ error: 'ett_name is required' });
  }

  try {
    const browserProcess = spawn(process.execPath, ['src/browser-open.js', url, ett_name], {
      detached: true,
      stdio: 'ignore',
      cwd: process.cwd()
    });

    browserProcess.unref();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

// Health check
app.get('/api/health', (req, res) => {
  res.send('my-job-manager API is running');
});
// Start server
function start() {
  initializeDatabase();
  loadProfiles();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();
