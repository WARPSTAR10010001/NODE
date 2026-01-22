const express = require('express');
const pool = require('../db');

const {
  requireAuth,
  requireAdmin,
} = require('../middleware/actionHandler');

const router = express.Router();

function parseRole(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 2) return null;
  return n;
}

router.get('/users/current', requireAuth, async (req, res) => {
  return res.json({ user: req.user });
});

router.get('/users/pending', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, "adGuid", username, role, "createdAt", "lastLogin", "isActivated"
       FROM users
       WHERE "isActivated" = FALSE
       ORDER BY "createdAt" ASC`
    );
    return res.json({ pending: rows });
  } catch (e) {
    console.error('[DB ERROR] /users/pending', e);
    return res.status(500).json({ error: 'Datenbankfehler' });
  }
});

router.patch('/users/:id/activate', requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Ungültige User-ID' });

  const role = req.body?.role === undefined ? null : parseRole(req.body.role);
  if (req.body?.role !== undefined && role === null) {
    return res.status(400).json({ error: 'Ungültige Rolle (0=viewer,1=editor,2=admin)' });
  }

  try {
    const { rows } = await pool.query(
      `
      UPDATE users
      SET "isActivated" = TRUE,
          role = COALESCE($2, role)
      WHERE id = $1
      RETURNING id, "adGuid", username, role, "createdAt", "lastLogin", "isActivated"
      `,
      [id, role]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'User nicht gefunden' });
    return res.json({ user: rows[0] });
  } catch (e) {
    console.error('[DB ERROR] /users/:id/activate', e);
    return res.status(500).json({ error: 'Datenbankfehler' });
  }
});

router.patch('/users/:id/role', requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Ungültige User-ID' });

  const role = parseRole(req.body?.role);
  if (role === null) return res.status(400).json({ error: 'Ungültige Rolle (0=viewer,1=editor,2=admin)' });

  try {
    const { rows } = await pool.query(
      `
      UPDATE users
      SET role = $2
      WHERE id = $1
      RETURNING id, "adGuid", username, role, "createdAt", "lastLogin", "isActivated"
      `,
      [id, role]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'User nicht gefunden' });
    return res.json({ user: rows[0] });
  } catch (e) {
    console.error('[DB ERROR] /users/:id/role', e);
    return res.status(500).json({ error: 'Datenbankfehler' });
  }
});

router.patch('/users/:id/deactivate', requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Ungültige User-ID' });

  try {
    const { rows } = await pool.query(
      `
      UPDATE users
      SET "isActivated" = FALSE
      WHERE id = $1
      RETURNING id, "adGuid", username, role, "createdAt", "lastLogin", "isActivated"
      `,
      [id]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'User nicht gefunden' });
    return res.json({ user: rows[0] });
  } catch (e) {
    console.error('[DB ERROR] /users/:id/deactivate', e);
    return res.status(500).json({ error: 'Datenbankfehler' });
  }
});

router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();

    if (!q) {
      const { rows } = await pool.query(
        `SELECT id, "adGuid", username, role, "createdAt", "lastLogin", "isActivated"
         FROM users
         ORDER BY username ASC`
      );
      return res.json({ users: rows });
    }

    const { rows } = await pool.query(
      `SELECT id, "adGuid", username, role, "createdAt", "lastLogin", "isActivated"
       FROM users
       WHERE username ILIKE $1
       ORDER BY username ASC`,
      [`%${q}%`]
    );
    return res.json({ users: rows });
  } catch (e) {
    console.error('[DB ERROR] /users', e);
    return res.status(500).json({ error: 'Datenbankfehler' });
  }
});

module.exports = router;