const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const ActiveDirectory = require('activedirectory2');

const router = express.Router();

const adConfig = {
  url: process.env.LDAP_URL,
  baseDN: process.env.LDAP_BASE_DN,
  username: process.env.LDAP_USER,
  password: process.env.LDAP_PASSWORD
};
const ad = new ActiveDirectory(adConfig);

function jwtCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: 1000 * 60 * 60 * 12,
    path: '/',
  };
}

function bufferToGuid(buf) {
  const b = Buffer.from(buf);
  const p1 = Buffer.from(b.slice(0, 4)).reverse().toString('hex');
  const p2 = Buffer.from(b.slice(4, 6)).reverse().toString('hex');
  const p3 = Buffer.from(b.slice(6, 8)).reverse().toString('hex');
  const p4 = Buffer.from(b.slice(8, 10)).toString('hex');
  const p5 = Buffer.from(b.slice(10, 16)).toString('hex');
  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}

function normalizeGuidLike(value, fallbackUsername) {
  if (!value) return fallbackUsername;

  if (Buffer.isBuffer(value)) return bufferToGuid(value);

  if (typeof value === 'string') {
    const s = value.trim();

    if (s.startsWith('S-')) return fallbackUsername;

    const looksBase64 =
      /^[A-Za-z0-9+/]+={0,2}$/.test(s) && s.length >= 20 && s.length <= 30;

    if (looksBase64) {
      try {
        const buf = Buffer.from(s, 'base64');
        if (buf.length === 16) return bufferToGuid(buf);
      } catch {
      }
    }

    return s;
  }

  try {
    return String(value);
  } catch {
    return fallbackUsername;
  }
}

function findUserWithGuid(loginName) {
  const opts = {
    attributes: [
      'dn',
      'cn',
      'sAMAccountName',
      'userPrincipalName',
      'objectGUID',
      'objectGUID;binary',
      'objectSid'
    ]
  };

  return new Promise((resolve, reject) => {
    ad.findUser(opts, loginName, (err, adUser) => {
      if (err) return reject(err);
      resolve(adUser);
    });
  });
}

router.post('/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Nutzername und Passwort erforderlich' });
  }

  ad.authenticate(username, password, async (err, auth) => {
    if (err) {
      console.error('[LDAP AUTH ERROR]', err);
      return res.status(500).json({ error: 'LDAP-Fehler' });
    }
    if (!auth) {
      return res.status(401).json({ error: 'Ungültiger Nutzername oder Passwort' });
    }

    try {
      const login = String(username).trim();

      let adUser = await findUserWithGuid(login);

      if (!adUser && !login.includes('@') && process.env.LDAP_UPN_SUFFIX) {
        const upn = `${login}${process.env.LDAP_UPN_SUFFIX}`;
        adUser = await findUserWithGuid(upn);
      }

      if (!adUser) {
        return res.status(404).json({ error: 'LDAP-Nutzer nicht gefunden' });
      }

      console.log('[LDAP DEBUG] baseDN:', adConfig.baseDN);
      console.log('[LDAP DEBUG] login used:', login);
      console.log('[LDAP DEBUG] adUser keys:', Object.keys(adUser));
      console.log('[LDAP DEBUG] dn:', adUser?.dn);
      console.log('[LDAP DEBUG] sAMAccountName:', adUser?.sAMAccountName);
      console.log('[LDAP DEBUG] userPrincipalName:', adUser?.userPrincipalName);
      console.log('[LDAP DEBUG] objectGUID:', adUser?.objectGUID);
      console.log('[LDAP DEBUG] objectGUID;binary:', adUser?.['objectGUID;binary']);
      console.log('[LDAP DEBUG] objectSid:', adUser?.objectSid);

      const rawGuid = adUser?.['objectGUID;binary'] ?? adUser?.objectGUID;
      const adGuid = normalizeGuidLike(rawGuid, login);

      if (adGuid === login) {
        console.warn('[LDAP WARNING] adGuid ist fallback (=login). objectGUID wurde nicht als GUID geliefert.');
      }

      console.log('[LDAP DEBUG] computed adGuid:', adGuid);

      const { rows } = await pool.query(
        `
        INSERT INTO users ("adGuid", username, role, "createdAt", "lastLogin", "isActivated")
        VALUES ($1, $2, 0, NOW(), NOW(), FALSE)
        ON CONFLICT ("adGuid")
        DO UPDATE SET
          username = EXCLUDED.username,
          "lastLogin" = NOW()
        RETURNING id, "adGuid", username, role, "lastLogin", "isActivated"
        `,
        [adGuid, login]
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
    } catch (e) {
      console.error('[LOGIN FLOW ERROR]', e);
      return res.status(500).json({ error: 'Login-Fehler (LDAP/DB)' });
    }
  });
});

router.post('/auth/logout', (_req, res) => {
  res.clearCookie('token', { path: '/' });
  return res.json({ loggedIn: false });
});

router.get('/auth/status', async (req, res) => {
  const token = req.cookies?.token;
  if (!token) return res.json({ loggedIn: false, user: null });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const { rows } = await pool.query(
      `SELECT id, "adGuid", username, role, "lastLogin", "isActivated"
       FROM users
       WHERE id = $1`,
      [payload.sub]
    );

    if (rows.length === 0) return res.json({ loggedIn: false, user: null });
    return res.json({ loggedIn: true, user: rows[0] });
  } catch {
    return res.json({ loggedIn: false, user: null });
  }
});

module.exports = router;