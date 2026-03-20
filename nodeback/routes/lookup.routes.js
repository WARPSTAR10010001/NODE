const express = require('express');
const pool = require('../db');
const {
  requireAuth,
  requireActivated,
  requireEditor,
  requireAdmin,
} = require('../middleware/actionHandler');

const router = express.Router();

function parseId(param) {
  const id = Number(param);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizeText(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function handleGet(table, key, orderBy, res) {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${table} ORDER BY ${orderBy} ASC`);
    return res.json({ [key]: rows });
  } catch (error) {
    console.error(`[DB ERROR] GET /${table}`, error);
    return res.status(500).json({ error: 'Stammdaten konnten nicht geladen werden.' });
  }
}

router.get('/categories', requireAuth, requireActivated, (_req, res) =>
  handleGet('categories', 'categories', 'name', res)
);

router.post('/categories', requireAuth, requireActivated, requireEditor, async (req, res) => {
  const name = normalizeText(req.body?.name);
  const description = normalizeText(req.body?.description) || '';

  if (!name) {
    return res.status(400).json({ error: 'name ist erforderlich.' });
  }

  try {
    const { rows } = await pool.query(
      'INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    return res.status(201).json({ category: rows[0] });
  } catch (error) {
    console.error('[DB ERROR] POST /categories', error);
    return res.status(500).json({ error: 'Kategorie konnte nicht gespeichert werden.' });
  }
});

router.patch('/categories/:id', requireAuth, requireActivated, requireEditor, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Ungueltige Kategorien-ID.' });

  const name = req.body && Object.prototype.hasOwnProperty.call(req.body, 'name')
    ? normalizeText(req.body.name)
    : undefined;
  const description = req.body && Object.prototype.hasOwnProperty.call(req.body, 'description')
    ? normalizeText(req.body.description)
    : undefined;

  if (name === undefined && description === undefined) {
    return res.status(400).json({ error: 'Keine Felder zum Aktualisieren uebergeben.' });
  }

  try {
    const { rows } = await pool.query(
      'UPDATE categories SET name = COALESCE($1, name), description = COALESCE($2, description) WHERE id = $3 RETURNING *',
      [name, description, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Kategorie nicht gefunden.' });
    return res.json({ category: rows[0] });
  } catch (error) {
    console.error('[DB ERROR] PATCH /categories/:id', error);
    return res.status(500).json({ error: 'Kategorie konnte nicht aktualisiert werden.' });
  }
});

router.delete('/categories/:id', requireAuth, requireActivated, requireAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Ungueltige Kategorien-ID.' });

  try {
    const { rowCount } = await pool.query('DELETE FROM categories WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Kategorie nicht gefunden.' });
    return res.json({ deleted: true });
  } catch (error) {
    console.error('[DB ERROR] DELETE /categories/:id', error);
    return res.status(409).json({ error: 'Kategorie kann nicht geloescht werden, solange sie noch verwendet wird.' });
  }
});

router.get('/statuses', requireAuth, requireActivated, (_req, res) =>
  handleGet('statuses', 'statuses', 'name', res)
);

router.post('/statuses', requireAuth, requireActivated, requireEditor, async (req, res) => {
  const name = normalizeText(req.body?.name);
  const description = normalizeText(req.body?.description) || '';

  if (!name) {
    return res.status(400).json({ error: 'name ist erforderlich.' });
  }

  try {
    const { rows } = await pool.query(
      'INSERT INTO statuses (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    return res.status(201).json({ status: rows[0] });
  } catch (error) {
    console.error('[DB ERROR] POST /statuses', error);
    return res.status(500).json({ error: 'Status konnte nicht gespeichert werden.' });
  }
});

router.patch('/statuses/:id', requireAuth, requireActivated, requireEditor, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Ungueltige Status-ID.' });

  const name = req.body && Object.prototype.hasOwnProperty.call(req.body, 'name')
    ? normalizeText(req.body.name)
    : undefined;
  const description = req.body && Object.prototype.hasOwnProperty.call(req.body, 'description')
    ? normalizeText(req.body.description)
    : undefined;

  if (name === undefined && description === undefined) {
    return res.status(400).json({ error: 'Keine Felder zum Aktualisieren uebergeben.' });
  }

  try {
    const { rows } = await pool.query(
      'UPDATE statuses SET name = COALESCE($1, name), description = COALESCE($2, description) WHERE id = $3 RETURNING *',
      [name, description, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Status nicht gefunden.' });
    return res.json({ status: rows[0] });
  } catch (error) {
    console.error('[DB ERROR] PATCH /statuses/:id', error);
    return res.status(500).json({ error: 'Status konnte nicht aktualisiert werden.' });
  }
});

router.delete('/statuses/:id', requireAuth, requireActivated, requireAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Ungueltige Status-ID.' });

  try {
    const { rowCount } = await pool.query('DELETE FROM statuses WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Status nicht gefunden.' });
    return res.json({ deleted: true });
  } catch (error) {
    console.error('[DB ERROR] DELETE /statuses/:id', error);
    return res.status(409).json({ error: 'Status kann nicht geloescht werden, solange er noch verwendet wird.' });
  }
});

router.get('/locations', requireAuth, requireActivated, async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM locations ORDER BY city ASC, address ASC');
    return res.json({ locations: rows });
  } catch (error) {
    console.error('[DB ERROR] GET /locations', error);
    return res.status(500).json({ error: 'Standorte konnten nicht geladen werden.' });
  }
});

router.post('/locations', requireAuth, requireActivated, requireEditor, async (req, res) => {
  const city = normalizeText(req.body?.city);
  const address = normalizeText(req.body?.address);
  const houseNumber = normalizeText(req.body?.houseNumber);
  const room = normalizeText(req.body?.room);

  if (!city || !address) {
    return res.status(400).json({ error: 'city und address sind erforderlich.' });
  }

  try {
    const { rows } = await pool.query(
      'INSERT INTO locations (city, address, "houseNumber", room) VALUES ($1, $2, $3, $4) RETURNING *',
      [city, address, houseNumber, room]
    );
    return res.status(201).json({ location: rows[0] });
  } catch (error) {
    console.error('[DB ERROR] POST /locations', error);
    return res.status(500).json({ error: 'Standort konnte nicht gespeichert werden.' });
  }
});

router.patch('/locations/:id', requireAuth, requireActivated, requireEditor, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Ungueltige Standort-ID.' });

  const city = req.body && Object.prototype.hasOwnProperty.call(req.body, 'city')
    ? normalizeText(req.body.city)
    : undefined;
  const address = req.body && Object.prototype.hasOwnProperty.call(req.body, 'address')
    ? normalizeText(req.body.address)
    : undefined;
  const houseNumber = req.body && Object.prototype.hasOwnProperty.call(req.body, 'houseNumber')
    ? normalizeText(req.body.houseNumber)
    : undefined;
  const room = req.body && Object.prototype.hasOwnProperty.call(req.body, 'room')
    ? normalizeText(req.body.room)
    : undefined;

  if (city === undefined && address === undefined && houseNumber === undefined && room === undefined) {
    return res.status(400).json({ error: 'Keine Felder zum Aktualisieren uebergeben.' });
  }

  try {
    const { rows } = await pool.query(
      'UPDATE locations SET city = COALESCE($1, city), address = COALESCE($2, address), "houseNumber" = COALESCE($3, "houseNumber"), room = COALESCE($4, room) WHERE id = $5 RETURNING *',
      [city, address, houseNumber, room, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Standort nicht gefunden.' });
    return res.json({ location: rows[0] });
  } catch (error) {
    console.error('[DB ERROR] PATCH /locations/:id', error);
    return res.status(500).json({ error: 'Standort konnte nicht aktualisiert werden.' });
  }
});

router.delete('/locations/:id', requireAuth, requireActivated, requireAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Ungueltige Standort-ID.' });

  try {
    const { rowCount } = await pool.query('DELETE FROM locations WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Standort nicht gefunden.' });
    return res.json({ deleted: true });
  } catch (error) {
    console.error('[DB ERROR] DELETE /locations/:id', error);
    return res.status(409).json({ error: 'Standort kann nicht geloescht werden, solange er noch verwendet wird.' });
  }
});

router.get('/depreciations', requireAuth, requireActivated, async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM depreciations ORDER BY time ASC, scale ASC');
    return res.json({ depreciations: rows });
  } catch (error) {
    console.error('[DB ERROR] GET /depreciations', error);
    return res.status(500).json({ error: 'Abschreibungen konnten nicht geladen werden.' });
  }
});

router.get('/network-environments', requireAuth, requireActivated, async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM network_environments ORDER BY name ASC');
    return res.json({ networkEnvironments: rows, network_environments: rows });
  } catch (error) {
    console.error('[DB ERROR] GET /network-environments', error);
    return res.status(500).json({ error: 'Netzwerkumgebungen konnten nicht geladen werden.' });
  }
});

router.post('/network-environments', requireAuth, requireActivated, requireEditor, async (req, res) => {
  const name = normalizeText(req.body?.name);

  if (!name) {
    return res.status(400).json({ error: 'name ist erforderlich.' });
  }

  try {
    const { rows } = await pool.query(
      'INSERT INTO network_environments (name) VALUES ($1) RETURNING *',
      [name]
    );
    return res.status(201).json({ networkEnvironment: rows[0] });
  } catch (error) {
    console.error('[DB ERROR] POST /network-environments', error);
    return res.status(500).json({ error: 'Netzwerkumgebung konnte nicht gespeichert werden.' });
  }
});

router.patch('/network-environments/:id', requireAuth, requireActivated, requireEditor, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Ungueltige Netzwerkumgebungs-ID.' });

  const name = req.body && Object.prototype.hasOwnProperty.call(req.body, 'name')
    ? normalizeText(req.body.name)
    : undefined;

  if (name === undefined) {
    return res.status(400).json({ error: 'Keine Felder zum Aktualisieren uebergeben.' });
  }

  try {
    const { rows } = await pool.query(
      'UPDATE network_environments SET name = COALESCE($1, name) WHERE id = $2 RETURNING *',
      [name, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Netzwerkumgebung nicht gefunden.' });
    return res.json({ networkEnvironment: rows[0] });
  } catch (error) {
    console.error('[DB ERROR] PATCH /network-environments/:id', error);
    return res.status(500).json({ error: 'Netzwerkumgebung konnte nicht aktualisiert werden.' });
  }
});

router.delete('/network-environments/:id', requireAuth, requireActivated, requireAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Ungueltige Netzwerkumgebungs-ID.' });

  try {
    const { rowCount } = await pool.query('DELETE FROM network_environments WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Netzwerkumgebung nicht gefunden.' });
    return res.json({ deleted: true });
  } catch (error) {
    console.error('[DB ERROR] DELETE /network-environments/:id', error);
    return res.status(409).json({ error: 'Netzwerkumgebung kann nicht geloescht werden, solange sie noch verwendet wird.' });
  }
});

module.exports = router;
