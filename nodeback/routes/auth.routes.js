const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const ActiveDirectory = require('activedirectory2');

const router = express.Router();

const adConfig = {
  url: process.env.LDAP_URL, // z.B. 'ldap://ad.example.com' rheinberg.krzn.de
  baseDN: process.env.LDAP_BASE_DN, // z.B. 'dc=example,dc=com' rheinberg.krzn.de
  username: process.env.LDAP_USER, // Service-Account z.B. 'ldap-reader@example.com'
  password: process.env.LDAP_PASSWORD
};
const ad = new ActiveDirectory(adConfig);

function jwtCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: !!(process.env.COOKIE_SECURE === 'true'),
    maxAge: 1000 * 60 * 60 * 12,
    path: '/',
  };
}

router.post('/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Nutzername und Passwort erforderlich' });

  // LDAP Auth
  ad.authenticate(username, password, async (err, auth) => {
    if (err) {
      console.error('[LDAP ERROR]', err);
      return res.status(500).json({ error: 'LDAP-Fehler' });
    }
    if (!auth) return res.status(401).json({ error: 'Ungültiger Nutzername oder Passwort' });

    // User info aus LDAP holen
    ad.findUser(username, async (err, adUser) => {
      if (err) {
        console.error('[LDAP FIND USER ERROR]', err);
        return res.status(500).json({ error: 'LDAP-Fehler' });
      }
      if (!adUser) return res.status(404).json({ error: 'LDAP-Nutzer nicht gefunden' });

      const adGuid = adUser.objectGUID || adUser.objectGUID || username;
      const now = new Date();

      try {
        const { rows } = await pool.query(
          `INSERT INTO users (adGuid, username, role, createdAt, lastLogin, isActivated)
           VALUES ($1, $2, 0, NOW(), NOW(), TRUE)
           ON CONFLICT (adGuid)
           DO UPDATE SET lastLogin = NOW()
           RETURNING id, username, role, lastLogin, isActivated`,
          [adGuid, username]
        );

        const user = rows[0];

        const payload = { sub: user.id, username: user.username, role: user.role };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '12h' });

        res.cookie('token', token, jwtCookieOptions());

        return res.json({
          token,
          loggedIn: true,
          user,
          expHours: 12
        });
      } catch (dbErr) {
        console.error('[DB ERROR]', dbErr);
        return res.status(500).json({ error: 'Datenbankfehler' });
      }
    });
  });
});

router.post('/auth/logout', (_req, res) => {
  res.clearCookie('token', { path: '/' });
  return res.json({ loggedIn: false });
});

router.get('/auth/status', async (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.json({ loggedIn: false, user: null });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query('SELECT id, username, role, lastLogin, isActivated FROM users WHERE id=$1', [payload.sub]);
    if (rows.length === 0) return res.json({ loggedIn: false, user: null });

    return res.json({ loggedIn: true, user: rows[0] });
  } catch {
    return res.json({ loggedIn: false, user: null });
  }
});

module.exports = router;