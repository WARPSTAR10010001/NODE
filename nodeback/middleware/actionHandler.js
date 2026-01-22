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
  if (!token) return res.status(401).json({ error: 'Fehlender Token' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const { rows } = await pool.query(
      `SELECT id, "adGuid", username, role, "isActivated"
       FROM users
       WHERE id = $1`,
      [payload.sub]
    );

    if (rows.length === 0) return res.status(401).json({ error: 'User nicht gefunden' });

    req.user = rows[0];
    req.jwt = payload;
    return next();
  } catch (err) {
    return res.status(403).json({ error: 'Ungültiger oder abgelaufener Token' });
  }
}

function requireActivated(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Kein Autorisierungskontext' });
  if (!req.user.isActivated) return res.status(403).json({ error: 'Warte auf Freigabe' });
  return next();
}

function requireMinRole(minRole) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Kein Autorisierungskontext' });
    if (typeof req.user.role !== 'number') return res.status(403).json({ error: 'Ungültige Rolle' });

    if (req.user.role >= minRole) return next();
    return res.status(403).json({ error: 'Verbotene Route' });
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