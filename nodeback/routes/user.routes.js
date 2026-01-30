const express = require('express');
const pool = require('../db');

// IMPORTANT: Passe den Pfad an deine echte Middleware-Datei an.
// Wenn du sie wie zuvor als auth.middleware.js hast, dann:
const { requireAuth, requireAdmin } = require('../middleware/actionHandler');

// Falls du WIRKLICH ../middleware/actionHandler nutzt, dann muss die Datei
// exports { requireAuth, requireAdmin } liefern. Sonst -> Pfad fixen.

const router = express.Router();

// Rollen: 0=viewer, 1=editor, 2=admin
function parseRole(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 2) return null;
  return n;
}

function parseId(param) {
  const id = Number(param);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * GET /users/me
 * Liefert den aktuell eingeloggten Benutzer (DB-Truth aus requireAuth)
 */
router.get('/users/me', requireAuth, async (req, res) => {
  return res.json({ user: req.user });
});

/**
 * GET /users/pending
 * Admin-only: alle nicht aktivierten User
 */
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
    console.error('[DB ERROR] GET /users/pending', e);
    return res.status(500).json({ error: 'Datenbankfehler' });
  }
});

/**
 * PATCH /users/:id/activate
 * Admin-only: aktiviert einen User und setzt optional die Rolle.
 * Body: { role?: 0|1|2 }
 */
router.patch('/users/:id/activate', requireAuth, requireAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Ungültige User-ID' });

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
    console.error('[DB ERROR] PATCH /users/:id/activate', e);
    return res.status(500).json({ error: 'Datenbankfehler' });
  }
});

/**
 * PATCH /users/:id/role
 * Admin-only: Rolle ändern
 * Body: { role: 0|1|2 }
 */
router.patch('/users/:id/role', requireAuth, requireAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Ungültige User-ID' });

  const role = parseRole(req.body?.role);
  if (role === null) return res.status(400).json({ error: 'Ungültige Rolle (0=viewer,1=editor,2=admin)' });

  // Schutz: Admin kann sich nicht selbst "ent-adminen"
  if (req.user?.id === id && req.user?.role === 2 && role !== 2) {
    return res.status(400).json({ error: 'Du kannst dir selbst die Adminrolle nicht entziehen.' });
  }

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
    console.error('[DB ERROR] PATCH /users/:id/role', e);
    return res.status(500).json({ error: 'Datenbankfehler' });
  }
});

/**
 * PATCH /users/:id/deactivate
 * Admin-only: setzt User wieder auf pending.
 */
router.patch('/users/:id/deactivate', requireAuth, requireAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Ungültige User-ID' });

  // Schutz: nicht selbst deaktivieren
  if (req.user?.id === id) {
    return res.status(400).json({ error: 'Du kannst dich nicht selbst deaktivieren.' });
  }

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
    console.error('[DB ERROR] PATCH /users/:id/deactivate', e);
    return res.status(500).json({ error: 'Datenbankfehler' });
  }
});

/**
 * GET /users
 * Admin-only: alle User, optional Suche ?q=
 */
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
    console.error('[DB ERROR] GET /users', e);
    return res.status(500).json({ error: 'Datenbankfehler' });
  }
});

module.exports = router;