const jwt = require('jsonwebtoken');
const pool = require('../db');

function getToken(req) {
  const cookieToken = req.cookies?.token;
  if (cookieToken) return cookieToken;

  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);

  return null;
}

async function requireAuth(req, res, next) {
  const token = getToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Anmeldung erforderlich.' });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: 'JWT-Konfiguration fehlt auf dem Server.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query(
      `SELECT id, "adGuid", username, role, "isActivated"
       FROM users
       WHERE id = $1`,
      [payload.sub]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Benutzerkonto wurde nicht gefunden.' });
    }

    req.user = rows[0];
    req.jwt = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Sitzung ist ungueltig oder abgelaufen.' });
  }
}

function requireActivated(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Anmeldung erforderlich.' });
  }

  if (!req.user.isActivated) {
    return res.status(403).json({ error: 'Dein Konto wartet noch auf Freigabe.' });
  }

  return next();
}

function requireMinRole(minRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Anmeldung erforderlich.' });
    }

    if (!Number.isInteger(req.user.role)) {
      return res.status(403).json({ error: 'Rollenkonfiguration des Kontos ist ungueltig.' });
    }

    if (req.user.role >= minRole) {
      return next();
    }

    return res.status(403).json({ error: 'Du hast keine Berechtigung fuer diese Aktion.' });
  };
}

const requireEditor = requireMinRole(1);
const requireAdmin = requireMinRole(2);

module.exports = {
  requireAuth,
  requireActivated,
  requireMinRole,
  requireEditor,
  requireAdmin,
};
