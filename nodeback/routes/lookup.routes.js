const express = require('express');
const pool = require('../db');
const {
  requireAuth,
  requireActivated,
  requireEditor,
  requireAdmin
} = require('../middleware/actionHandler');

const router = express.Router();

function parseId(param) {
  const id = Number(param);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function handleGet(table, res) {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${table} ORDER BY name ASC`);
    res.json({ [table]: rows });
  } catch (e) {
    console.error(`[DB ERROR] GET /${table}`, e);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
}

router.get('/categories', requireAuth, requireActivated, (req, res) => handleGet('categories', res));

router.post('/categories', requireAuth, requireActivated, requireEditor, async (req, res) => {
  const { name, description = '' } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Name erforderlich' });

  try {
    const { rows } = await pool.query(
      'INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *',
      [name.trim(), description]
    );
    res.status(201).json({ category: rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

router.patch('/categories/:id', requireAuth, requireActivated, requireEditor, async (req, res) => {
  const id = parseId(req.params.id);
  const { name, description } = req.body;
  if (!id) return res.status(400).json({ error: 'Ungültige ID' });

  try {
    const { rows } = await pool.query(
      'UPDATE categories SET name = COALESCE($1, name), description = COALESCE($2, description) WHERE id = $3 RETURNING *',
      [name, description, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Nicht gefunden' });
    res.json({ category: rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

router.delete('/categories/:id', requireAuth, requireActivated, requireAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  try {
    const { rowCount } = await pool.query('DELETE FROM categories WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Nicht gefunden' });
    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: 'Datenbankfehler - Eventuell wird die Kategorie noch verwendet' });
  }
});

router.get('/statuses', requireAuth, requireActivated, (req, res) => handleGet('statuses', res));

router.post('/statuses', requireAuth, requireActivated, requireEditor, async (req, res) => {
  const { name, description = '' } = req.body || {};
  try {
    const { rows } = await pool.query('INSERT INTO statuses (name, description) VALUES ($1, $2) RETURNING *', [name, description]);
    res.status(201).json({ status: rows[0] });
  } catch (e) { res.status(500).json({ error: 'Datenbankfehler' }); }
});

router.get('/locations', requireAuth, requireActivated, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM locations ORDER BY city ASC');
    res.json({ locations: rows });
  } catch (e) { res.status(500).json({ error: 'Datenbankfehler' }); }
});

router.post('/locations', requireAuth, requireActivated, requireEditor, async (req, res) => {
  const { city, address, houseNumber, room } = req.body || {};
  if (!city || !address) return res.status(400).json({ error: 'Stadt und Adresse erforderlich' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO locations (city, address, "houseNumber", room) VALUES ($1, $2, $3, $4) RETURNING *',
      [city, address, houseNumber, room]
    );
    res.status(201).json({ location: rows[0] });
  } catch (e) { res.status(500).json({ error: 'Datenbankfehler' }); }
});

router.get('/network-environments', requireAuth, requireActivated, (req, res) => handleGet('network_environments', res));

router.post('/network-environments', requireAuth, requireActivated, requireEditor, async (req, res) => {
  const { name } = req.body || {};
  try {
    const { rows } = await pool.query('INSERT INTO network_environments (name) VALUES ($1) RETURNING *', [name]);
    res.status(201).json({ networkEnvironment: rows[0] });
  } catch (e) { res.status(500).json({ error: 'Datenbankfehler' }); }
});

module.exports = router;