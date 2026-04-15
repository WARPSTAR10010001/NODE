const express = require('express');
const ActiveDirectory = require('activedirectory2');
const pool = require('../db');
const {
  requireAuth,
  requireActivated,
  requireAdmin,
} = require('../middleware/actionHandler');

const router = express.Router();

const ROLE_MAP = {
  viewer: 0,
  editor: 1,
  admin: 2,
};

function getAdClient() {
  const config = {
    url: process.env.LDAP_URL,
    baseDN: process.env.LDAP_BASE_DN,
    username: process.env.LDAP_USER,
    password: process.env.LDAP_PASSWORD,
  };

  if (!config.url || !config.baseDN || !config.username || !config.password) {
    return null;
  }

  return new ActiveDirectory(config);
}

function normalizeRole(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();

    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      if (numeric >= 0 && numeric <= 2) return numeric;
    }

    if (Object.prototype.hasOwnProperty.call(ROLE_MAP, trimmed)) {
      return ROLE_MAP[trimmed];
    }
  }

  return null;
}

function parseUserId(rawId) {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizeUsername(value) {
  const trimmed = String(value || '').trim().toLowerCase();
  return trimmed || null;
}

function ldapSearchUsers(ad, query) {
  const escapedQuery = query.replace(/[\\*()]/g, '\\$&');
  const filter = `(|(sn=*${escapedQuery}*)(givenName=*${escapedQuery}*)(displayName=*${escapedQuery}*)(sAMAccountName=*${escapedQuery}*)(userPrincipalName=*${escapedQuery}*)(mail=*${escapedQuery}*))`;

  return new Promise((resolve, reject) => {
    ad.findUsers(
      {
        filter,
        attributes: ['dn', 'sAMAccountName', 'displayName', 'givenName', 'sn', 'mail', 'userPrincipalName'],
      },
      false,
      (err, users) => {
        if (err) return reject(err);
        resolve(Array.isArray(users) ? users : []);
      }
    );
  });
}

router.get('/ldap/search', requireAuth, requireActivated, async (req, res) => {
  const q = String(req.query.q || '').trim();

  if (!q || q.length < 2) {
    return res.json([]);
  }

  const ad = getAdClient();
  if (!ad) {
    return res.status(503).json({
      error: 'Die LDAP-Suche ist aktuell nicht konfiguriert.',
    });
  }

  try {
    const results = await ldapSearchUsers(ad, q);
    const formatted = results.map((user) => ({
      username: user.sAMAccountName || user.userPrincipalName || '',
      displayName:
        user.displayName ||
        [user.givenName, user.sn].filter(Boolean).join(' ') ||
        user.sAMAccountName ||
        user.userPrincipalName ||
        'Unbekannter Nutzer',
      email: user.mail || undefined,
    }));

    return res.json(formatted.filter((user) => user.username));
  } catch (error) {
    console.error('[LDAP SEARCH ERROR]', error);
    return res.status(502).json({
      error: 'Die LDAP-Suche ist derzeit nicht erreichbar.',
    });
  }
});

router.get('/users', requireAuth, requireActivated, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, "adGuid", username, role, "isActivated", "createdAt", "lastLogin", "previouslyLoggedIn" FROM users ORDER BY username ASC'
    );
    return res.json(rows);
  } catch (error) {
    console.error('[DB ERROR] GET /users', error);
    return res.status(500).json({ error: 'Die Nutzer konnten nicht geladen werden.' });
  }
});

router.post('/users/resolve-ldap', requireAuth, requireActivated, async (req, res) => {
  const username = normalizeUsername(req.body?.username);

  if (!username) {
    return res.status(400).json({ error: 'Ein Nutzername ist erforderlich.' });
  }

  try {
    const existing = await pool.query(
      'SELECT id, "adGuid", username, role, "isActivated", "createdAt", "lastLogin", "previouslyLoggedIn" FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1',
      [username]
    );

    if (existing.rows.length > 0) {
      return res.json({ user: existing.rows[0] });
    }

    const { rows } = await pool.query(
      `INSERT INTO users ("adGuid", username, role, "createdAt", "lastLogin", "isActivated", "previouslyLoggedIn")
       VALUES ($1, $2, 0, NOW(), NOW(), FALSE, FALSE)
       RETURNING id, "adGuid", username, role, "isActivated", "createdAt", "lastLogin", "previouslyLoggedIn"`,
      [username, username]
    );

    return res.status(201).json({ user: rows[0] });
  } catch (error) {
    console.error('[DB ERROR] POST /users/resolve-ldap', error);
    return res.status(500).json({ error: 'Der LDAP-Nutzer konnte nicht aufgel\u00f6st werden.' });
  }
});

router.patch('/users/:id/role', requireAuth, requireActivated, requireAdmin, async (req, res) => {
  const id = parseUserId(req.params.id);
  const role = normalizeRole(req.body?.role);

  if (!id) {
    return res.status(400).json({ error: 'Ung\u00fcltige Nutzer-ID.' });
  }

  if (role === null) {
    return res.status(400).json({ error: 'Die Rolle ist ung\u00fcltig.' });
  }

  try {
    const { rows } = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, "adGuid", username, role, "isActivated", "createdAt", "lastLogin", "previouslyLoggedIn"',
      [role, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Der Nutzer konnte nicht gefunden werden.' });
    }

    return res.json({ user: rows[0] });
  } catch (error) {
    console.error('[DB ERROR] PATCH /users/:id/role', error);
    return res.status(500).json({ error: 'Die Rolle konnte nicht aktualisiert werden.' });
  }
});

router.patch('/users/:id/activate', requireAuth, requireActivated, requireAdmin, async (req, res) => {
  const id = parseUserId(req.params.id);

  if (!id) {
    return res.status(400).json({ error: 'Ung\u00fcltige Nutzer-ID.' });
  }

  if (typeof req.body?.activated !== 'boolean') {
    return res.status(400).json({ error: 'Der Aktivierungsstatus muss als true oder false \u00fcbergeben werden.' });
  }

  if (Number(req.user.id) === id && req.body.activated === false) {
    return res.status(400).json({ error: 'Das eigene Konto kann nicht deaktiviert werden.' });
  }

  try {
    const { rows } = await pool.query(
      'UPDATE users SET "isActivated" = $1 WHERE id = $2 RETURNING id, "adGuid", username, role, "isActivated", "createdAt", "lastLogin", "previouslyLoggedIn"',
      [req.body.activated, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Der Nutzer konnte nicht gefunden werden.' });
    }

    return res.json({ user: rows[0] });
  } catch (error) {
    console.error('[DB ERROR] PATCH /users/:id/activate', error);
    return res.status(500).json({ error: 'Der Aktivierungsstatus konnte nicht aktualisiert werden.' });
  }
});

router.delete('/users/:id', requireAuth, requireActivated, requireAdmin, async (req, res) => {
  const id = parseUserId(req.params.id);

  if (!id) {
    return res.status(400).json({ error: 'Ung\u00fcltige Nutzer-ID.' });
  }

  if (Number(req.user.id) === id) {
    return res.status(400).json({ error: 'Das eigene Konto kann nicht gel\u00f6scht werden.' });
  }

  try {
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [id]);

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Der Nutzer konnte nicht gefunden werden.' });
    }

    return res.json({ deleted: true });
  } catch (error) {
    console.error('[DB ERROR] DELETE /users/:id', error);
    return res.status(500).json({ error: 'Der Nutzer konnte nicht gel\u00f6scht werden.' });
  }
});

module.exports = router;
