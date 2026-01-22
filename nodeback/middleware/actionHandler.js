const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return res.status(401).json({ error: 'Fehlender Token' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Ungültiger oder abgelaufener Token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Kein Autorisierungskontext' });
    if (req.user.role === 1) return next();
    if (roles.includes(req.user.role)) return next();
    return res.status(403).json({ error: 'Verbotene Route' });
  };
}

module.exports = {
  requireAuth,
  requireRole,
};