const express = require('express');
const cors    = require('cors');
const bcrypt  = require('bcryptjs');
const { Pool } = require('pg');

const app  = express();
const port = process.env.PORT || 3001;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(cors());
app.use(express.json());

// ── Health ────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'user-service' }));

// ── CREATE user ───────────────────────────────────────────
app.post('/users', async (req, res) => {
  const { name, email, password, plan = 'free' } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'name, email and password are required' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password, plan)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, plan, created_at`,
      [name, email, hash, plan]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── READ all users ────────────────────────────────────────
app.get('/users', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, plan, created_at, updated_at FROM users ORDER BY id'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── READ single user ──────────────────────────────────────
app.get('/users/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, plan, created_at, updated_at FROM users WHERE id = $1',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── UPDATE user ───────────────────────────────────────────
app.put('/users/:id', async (req, res) => {
  const { name, email, plan } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE users
       SET name  = COALESCE($1, name),
           email = COALESCE($2, email),
           plan  = COALESCE($3, plan)
       WHERE id = $4
       RETURNING id, name, email, plan, created_at, updated_at`,
      [name, email, plan, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE user ───────────────────────────────────────────
app.delete('/users/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'User not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => console.log(`✅ user-service listening on :${port}`));
