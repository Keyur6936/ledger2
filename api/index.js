// api/index.js — Ledger Backend API
// Handles expenses and income CRUD, connected to PostgreSQL (Neon)

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================================
// DATABASE CONNECTION
// Uses DATABASE_URL from environment (set in Vercel dashboard)
// ============================================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // required for Neon
});

// ============================================================
// INIT — Create tables if they don't exist
// Called automatically on first request
// ============================================================
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL DEFAULT 'default',
      amount     NUMERIC(12,2) NOT NULL,
      category   TEXT NOT NULL,
      notes      TEXT DEFAULT '',
      date       DATE NOT NULL,
      month      TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS income (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL DEFAULT 'default',
      amount     NUMERIC(12,2) NOT NULL,
      source     TEXT NOT NULL,
      notes      TEXT DEFAULT '',
      date       DATE NOT NULL,
      month      TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}
initDB().catch(console.error);

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ============================================================
// EXPENSES
// ============================================================

// GET /api/expenses?month=2025-04
// Returns all expenses for a given month, sorted newest first
app.get('/api/expenses', async (req, res) => {
  try {
    const { month = currentMonth() } = req.query;
    const { rows } = await pool.query(
      `SELECT * FROM expenses WHERE month = $1 ORDER BY date DESC, created_at DESC`,
      [month]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/expenses — Add a new expense
app.post('/api/expenses', async (req, res) => {
  try {
    const { id, amount, category, notes, date } = req.body;
    const month = date.slice(0, 7); // "YYYY-MM" from "YYYY-MM-DD"
    const { rows } = await pool.query(
      `INSERT INTO expenses (id, amount, category, notes, date, month)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, amount, category, notes || '', date, month]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/expenses/:id — Update an expense
app.put('/api/expenses/:id', async (req, res) => {
  try {
    const { amount, category, notes, date } = req.body;
    const month = date.slice(0, 7);
    const { rows } = await pool.query(
      `UPDATE expenses SET amount=$1, category=$2, notes=$3, date=$4, month=$5
       WHERE id=$6 RETURNING *`,
      [amount, category, notes || '', date, month, req.params.id]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/expenses/:id
app.delete('/api/expenses/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM expenses WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// INCOME
// ============================================================

// GET /api/income?month=2025-04
app.get('/api/income', async (req, res) => {
  try {
    const { month = currentMonth() } = req.query;
    const { rows } = await pool.query(
      `SELECT * FROM income WHERE month = $1 ORDER BY date DESC, created_at DESC`,
      [month]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/income
app.post('/api/income', async (req, res) => {
  try {
    const { id, amount, source, notes, date } = req.body;
    const month = date.slice(0, 7);
    const { rows } = await pool.query(
      `INSERT INTO income (id, amount, source, notes, date, month)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, amount, source, notes || '', date, month]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/income/:id
app.put('/api/income/:id', async (req, res) => {
  try {
    const { amount, source, notes, date } = req.body;
    const month = date.slice(0, 7);
    const { rows } = await pool.query(
      `UPDATE income SET amount=$1, source=$2, notes=$3, date=$4, month=$5
       WHERE id=$6 RETURNING *`,
      [amount, source, notes || '', date, month, req.params.id]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/income/:id
app.delete('/api/income/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM income WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// HELPER
// ============================================================
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

// ============================================================
// START SERVER (local dev only — Vercel uses serverless)
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Ledger API running on http://localhost:${PORT}`));

module.exports = app;
