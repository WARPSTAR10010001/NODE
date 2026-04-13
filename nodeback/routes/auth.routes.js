const express = require('express');
const jwt = require('jsonwebtoken');
const ActiveDirectory = require('activedirectory2');
const pool = require('../db');

const router = express.Router();

function getAdConfig() {
  return {
    url: process.env.LDAP_URL,
    baseDN: process.env.LDAP_BASE_DN,
    username: process.env.LDAP_USER,
    password: process.env.LDAP_PASSWORD,
  };
}

function hasCompleteAdConfig(config) {
  return Object.values(config).every((value) => typeof value === 'string' && value.trim().length > 0);
}

function createAdClient() {
  const config = getAdConfig();

  if (!hasCompleteAdConfig(config)) {
    return null;
  }

  return new ActiveDirectory(config);
}

function jwtCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: 1000 * 60 * 60 * 12,
    path: '/',
  };
}

function clearJwtCookie(res) {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
  });
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
    const trimmed = value.trim();

    if (!trimmed) return fallbackUsername;
    if (trimmed.startsWith('S-')) return fallbackUsername;

    const looksBase64 =
      /^[A-Za-z0-9+/]+={0,2}$/.test(trimmed) && trimmed.length >= 20 && trimmed.length <= 30;

    if (looksBase64) {
      try {
        const buffer = Buffer.from(trimmed, 'base64');
        if (buffer.length === 16) return bufferToGuid(buffer);
      } catch {
      }
    }

    return trimmed;
  }

  try {
    return String(value);
  } catch {
    return fallbackUsername;
  }
}

function isLikelyInvalidCredentials(error) {
  const message = String(
    error?.lde_message ||
    error?.message ||
    error?.code ||
    ''
  ).toLowerCase();

  return (
    message.includes('invalid credentials') ||
    message.includes('data 52e') ||
    message.includes('80090308')
  );
}

function authenticateAd(ad, username, password) {
  return new Promise((resolve, reject) => {
    ad.authenticate(username, password, (error, authenticated) => {
      if (error) return reject(error);
      resolve(Boolean(authenticated));
    });
  });
}

function findUserWithGuid(ad, loginName) {
  const opts = {
    attributes: [
      'dn',
      'cn',
      'displayName',
      'mail',
      'sAMAccountName',
      'userPrincipalName',
      'objectGUID',
      'objectGUID;binary',
      'objectSid',
    ],
  };

  return new Promise((resolve, reject) => {
    ad.findUser(opts, loginName, (error, adUser) => {
      if (error) return reject(error);
      resolve(adUser || null);
    });
  });
}

async function upsertLocalUser(adGuid, username) {
  const normalizedUsername = String(username).trim().toLowerCase();

  const existing = await pool.query(
    `SELECT id
     FROM users
     WHERE "adGuid" = $1 OR LOWER(username) = LOWER($2)
     ORDER BY id ASC
     LIMIT 1`,
    [adGuid, normalizedUsername]
  );

  if (existing.rows.length > 0) {
    const { rows } = await pool.query(
      `
      UPDATE users
      SET "adGuid" = $1,
          username = $2,
          "lastLogin" = NOW(),
          "previouslyLoggedIn" = TRUE
      WHERE id = $3
      RETURNING id, "adGuid", username, role, "lastLogin", "isActivated", "previouslyLoggedIn"
      `,
      [adGuid, normalizedUsername, existing.rows[0].id]
    );

    return rows[0];
  }

  const { rows } = await pool.query(
    `
    INSERT INTO users ("adGuid", username, role, "createdAt", "lastLogin", "isActivated", "previouslyLoggedIn")
    VALUES ($1, $2, 0, NOW(), NOW(), FALSE, TRUE)
    RETURNING id, "adGuid", username, role, "lastLogin", "isActivated", "previouslyLoggedIn"
    `,
    [adGuid, normalizedUsername]
  );

  return rows[0];
}

router.post('/auth/login', async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');

  if (!username || !password) {
    return res.status(400).json({ error: 'Nutzername und Passwort sind erforderlich.' });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: 'JWT-Konfiguration fehlt auf dem Server.' });
  }

  const ad = createAdClient();
  if (!ad) {
    return res.status(500).json({ error: 'LDAP-Konfiguration ist unvollstaendig.' });
  }

  try {
    const authenticated = await authenticateAd(ad, username, password);

    if (!authenticated) {
      clearJwtCookie(res);
      return res.status(401).json({ error: 'Ungueltiger Nutzername oder Passwort.' });
    }

    let adGuid = username.toLowerCase();

    try {
      let adUser = await findUserWithGuid(ad, username);

      if (!adUser && !username.includes('@') && process.env.LDAP_UPN_SUFFIX) {
        adUser = await findUserWithGuid(ad, `${username}${process.env.LDAP_UPN_SUFFIX}`);
      }

      const rawGuid = adUser?.['objectGUID;binary'] ?? adUser?.objectGUID;
      adGuid = normalizeGuidLike(rawGuid, username.toLowerCase());
    } catch (lookupError) {
      console.warn('[LDAP LOOKUP WARNING]', lookupError);
    }

    const user = await upsertLocalUser(adGuid, username);
    const payload = { sub: user.id, username: user.username, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '12h' });

    res.cookie('token', token, jwtCookieOptions());

    return res.json({
      token,
      loggedIn: true,
      user,
      expHours: 12,
    });
  } catch (error) {
    console.error('[LDAP AUTH ERROR]', error);
    clearJwtCookie(res);

    if (isLikelyInvalidCredentials(error)) {
      return res.status(401).json({ error: 'Ungueltiger Nutzername oder Passwort.' });
    }

    return res.status(502).json({ error: 'LDAP-Anmeldung ist derzeit nicht erreichbar.' });
  }
});

router.post('/auth/logout', (_req, res) => {
  clearJwtCookie(res);
  return res.json({ loggedIn: false });
});

router.get('/auth/status', async (req, res) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.json({ loggedIn: false, user: null });
  }

  if (!process.env.JWT_SECRET) {
    clearJwtCookie(res);
    return res.status(500).json({ error: 'JWT-Konfiguration fehlt auf dem Server.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query(
      `SELECT id, "adGuid", username, role, "lastLogin", "isActivated"
      , "previouslyLoggedIn"
       FROM users
       WHERE id = $1`,
      [payload.sub]
    );

    if (rows.length === 0) {
      clearJwtCookie(res);
      return res.json({ loggedIn: false, user: null });
    }

    return res.json({ loggedIn: true, user: rows[0] });
  } catch (error) {
    clearJwtCookie(res);
    return res.json({ loggedIn: false, user: null });
  }
});

module.exports = router;
