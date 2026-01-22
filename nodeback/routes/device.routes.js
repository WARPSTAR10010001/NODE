const express = require('express');
const pool = require('../db');

const {
  requireAuth,
  requireActivated,
  requireEditor,
  requireAdmin,
} = require('../middleware/actionHandler');

const router = express.Router();

function toInt(v, fallback = null) {
  if (v === undefined || v === null || v === '') return fallback;
  const n = Number(v);
  return Number.isInteger(n) ? n : fallback;
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function normalizeMacArray(v) {
  if (v === null) return null;
  if (v === undefined) return undefined;
  if (Array.isArray(v)) return v;
  return undefined;
}

const depreciationEndSql = `
CASE
  WHEN d.purchase IS NULL OR dep.id IS NULL THEN NULL
  WHEN dep.scale = 'months' THEN d.purchase + (dep.time || ' months')::interval
  WHEN dep.scale = 'years'  THEN d.purchase + (dep.time || ' years')::interval
  ELSE NULL
END
`;

const nextTestAtSql = `
CASE
  WHEN etl."lastTest" IS NULL THEN NULL
  WHEN etl.scale = 'months' THEN etl."lastTest" + (etl."nextTestPeriod" || ' months')::interval
  WHEN etl.scale = 'years'  THEN etl."lastTest" + (etl."nextTestPeriod" || ' years')::interval
  ELSE NULL
END
`;

const allowedSort = new Set(['lastEditAt', 'createdAt', 'inventoryNumber', 'name']);
const allowedOrder = new Set(['asc', 'desc']);

router.get('/devices', requireAuth, requireActivated, async (req, res) => {
  const q = String(req.query.q || '').trim();
  const statusId = toInt(req.query.statusId);
  const categoryId = toInt(req.query.categoryId);
  const locationId = toInt(req.query.locationId);
  const assignedToUserId = toInt(req.query.assignedToUserId);

  const page = Math.max(1, toInt(req.query.page, 1));
  const pageSize = Math.min(200, Math.max(1, toInt(req.query.pageSize, 25)));

  const sort = allowedSort.has(String(req.query.sort)) ? String(req.query.sort) : 'lastEditAt';
  const order = allowedOrder.has(String(req.query.order).toLowerCase())
    ? String(req.query.order).toLowerCase()
    : 'desc';

  const where = [];
  const params = [];

  if (q) {
    params.push(`%${q}%`);
    where.push(`(
      d."inventoryNumber" ILIKE $${params.length}
      OR d.name ILIKE $${params.length}
      OR d.manufacturer ILIKE $${params.length}
      OR d.model ILIKE $${params.length}
      OR d."serialNumber" ILIKE $${params.length}
      OR u.username ILIKE $${params.length}
      OR c.name ILIKE $${params.length}
      OR s.name ILIKE $${params.length}
    )`);
  }
  if (statusId) {
    params.push(statusId);
    where.push(`d."statusId" = $${params.length}`);
  }
  if (categoryId) {
    params.push(categoryId);
    where.push(`d."categoryId" = $${params.length}`);
  }
  if (locationId) {
    params.push(locationId);
    where.push(`d."locationId" = $${params.length}`);
  }
  if (assignedToUserId) {
    params.push(assignedToUserId);
    where.push(`d."assignedToUserId" = $${params.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (page - 1) * pageSize;

  try {
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM devices d
       LEFT JOIN users u ON u.id = d."assignedToUserId"
       LEFT JOIN categories c ON c.id = d."categoryId"
       LEFT JOIN statuses s ON s.id = d."statusId"
       ${whereSql}`,
      params
    );
    const total = countResult.rows[0]?.total || 0;

    params.push(pageSize);
    params.push(offset);

    const dataResult = await pool.query(
      `
      SELECT
        d.*,

        c.name AS "categoryName",
        s.name AS "statusName",
        l.city AS "locationCity",
        l.address AS "locationAddress",
        l."houseNumber" AS "locationHouseNumber",
        l.room AS "locationRoom",
        ne.name AS "networkEnvironmentName",
        u.username AS "assignedToUsername",

        dep.time AS "depreciationTime",
        dep.scale AS "depreciationScale",
        ${depreciationEndSql} AS "depreciationEnd",

        etl.id AS "latestTestId",
        etl.tester AS "latestTestTester",
        etl."lastTest" AS "latestTestLastTest",
        etl."lastTestResult" AS "latestTestResult",
        etl."nextTestPeriod" AS "latestTestNextPeriod",
        etl.scale AS "latestTestScale",
        ${nextTestAtSql} AS "latestTestNextAt"

      FROM devices d
      LEFT JOIN categories c ON c.id = d."categoryId"
      LEFT JOIN statuses s ON s.id = d."statusId"
      LEFT JOIN locations l ON l.id = d."locationId"
      LEFT JOIN network_environments ne ON ne.id = d."networkEnvironmentId"
      LEFT JOIN users u ON u.id = d."assignedToUserId"
      LEFT JOIN depreciations dep ON dep.id = d."depreciationId"

      LEFT JOIN LATERAL (
        SELECT *
        FROM electronic_tests et
        WHERE et."deviceId" = d.id
        ORDER BY et."lastTest" DESC NULLS LAST, et.id DESC
        LIMIT 1
      ) etl ON TRUE

      ${whereSql}
      ORDER BY d."${sort}" ${order}, d.id ${order}
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
      `,
      params
    );

    return res.json({ page, pageSize, total, items: dataResult.rows });
  } catch (e) {
    console.error('[DB ERROR] GET /devices', e);
    return res.status(500).json({ error: 'Datenbankfehler' });
  }
});

router.get('/devices/:id', requireAuth, requireActivated, async (req, res) => {
  const id = toInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Ungültige Geräte-ID' });

  try {
    const { rows } = await pool.query(
      `
      SELECT
        d.*,

        c.name AS "categoryName",
        s.name AS "statusName",
        l.city AS "locationCity",
        l.address AS "locationAddress",
        l."houseNumber" AS "locationHouseNumber",
        l.room AS "locationRoom",
        ne.name AS "networkEnvironmentName",
        u.username AS "assignedToUsername",

        dep.time AS "depreciationTime",
        dep.scale AS "depreciationScale",
        ${depreciationEndSql} AS "depreciationEnd",

        etl.id AS "latestTestId",
        etl.tester AS "latestTestTester",
        etl."lastTest" AS "latestTestLastTest",
        etl."lastTestResult" AS "latestTestResult",
        etl."nextTestPeriod" AS "latestTestNextPeriod",
        etl.scale AS "latestTestScale",
        ${nextTestAtSql} AS "latestTestNextAt"

      FROM devices d
      LEFT JOIN categories c ON c.id = d."categoryId"
      LEFT JOIN statuses s ON s.id = d."statusId"
      LEFT JOIN locations l ON l.id = d."locationId"
      LEFT JOIN network_environments ne ON ne.id = d."networkEnvironmentId"
      LEFT JOIN users u ON u.id = d."assignedToUserId"
      LEFT JOIN depreciations dep ON dep.id = d."depreciationId"
      LEFT JOIN LATERAL (
        SELECT *
        FROM electronic_tests et
        WHERE et."deviceId" = d.id
        ORDER BY et."lastTest" DESC NULLS LAST, et.id DESC
        LIMIT 1
      ) etl ON TRUE
      WHERE d.id = $1
      `,
      [id]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Gerät nicht gefunden' });
    return res.json({ device: rows[0] });
  } catch (e) {
    console.error('[DB ERROR] GET /devices/:id', e);
    return res.status(500).json({ error: 'Datenbankfehler' });
  }
});

router.post('/devices', requireAuth, requireActivated, requireEditor, async (req, res) => {
  const b = req.body || {};

  if (!b.inventoryNumber || !b.name || !b.categoryId || !b.statusId) {
    return res.status(400).json({ error: 'inventoryNumber, name, categoryId, statusId erforderlich' });
  }

  const macs = normalizeMacArray(b.macAddresses);
  if (macs === undefined && hasOwn(b, 'macAddresses')) {
    return res.status(400).json({ error: 'macAddresses muss ein Array oder null sein' });
  }

  try {
    const { rows } = await pool.query(
      `
      INSERT INTO devices (
        "inventoryNumber", name, "categoryId", "statusId",
        purchase, price, supplier, "depreciationId", "accountingType",
        "assignedToUserId",
        "locationId", "networkEnvironmentId",
        manufacturer, model, "serialNumber",
        "patchPanelLabel", "ipAddress", "macAddresses",
        "leaseDurationMonths", "contractType",
        notes,
        "createdBy", "createdAt", "lastEditBy", "lastEditAt"
      )
      VALUES (
        $1,$2,$3,$4,
        $5,$6,$7,$8,$9,
        $10,
        $11,$12,
        $13,$14,$15,
        $16,$17,$18,
        $19,$20,
        $21,
        $22,NOW(),$23,NOW()
      )
      RETURNING *
      `,
      [
        String(b.inventoryNumber),
        String(b.name),
        toInt(b.categoryId),
        toInt(b.statusId),

        b.purchase ? new Date(b.purchase) : null,
        b.price ?? null,
        b.supplier ?? null,
        toInt(b.depreciationId),
        b.accountingType ?? 'konsumtiv',

        toInt(b.assignedToUserId),

        toInt(b.locationId),
        toInt(b.networkEnvironmentId),

        b.manufacturer ?? null,
        b.model ?? null,
        b.serialNumber ?? null,

        b.patchPanelLabel ?? null,
        b.ipAddress ?? null,
        macs === undefined ? null : macs,

        toInt(b.leaseDurationMonths),
        b.contractType ?? null,

        b.notes ?? null,

        req.user.id,
        req.user.id,
      ]
    );

    return res.status(201).json({ device: rows[0] });
  } catch (e) {
    console.error('[DB ERROR] POST /devices', e);
    if (e.code === '23505') return res.status(409).json({ error: 'Inventarnummer existiert bereits' });
    return res.status(500).json({ error: 'Datenbankfehler' });
  }
});

router.patch('/devices/:id', requireAuth, requireActivated, requireEditor, async (req, res) => {
  const id = toInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Ungültige Geräte-ID' });

  const b = req.body || {};

  const fields = {
    inventoryNumber: { col: `"inventoryNumber"`, transform: (v) => (v === null ? null : String(v)) },
    name: { col: `name`, transform: (v) => (v === null ? null : String(v)) },

    categoryId: { col: `"categoryId"`, transform: (v) => (v === null ? null : toInt(v)) },
    statusId: { col: `"statusId"`, transform: (v) => (v === null ? null : toInt(v)) },

    purchase: { col: `purchase`, transform: (v) => (v === null ? null : new Date(v)) },
    price: { col: `price`, transform: (v) => (v === null ? null : v) },
    supplier: { col: `supplier`, transform: (v) => (v === null ? null : String(v)) },
    depreciationId: { col: `"depreciationId"`, transform: (v) => (v === null ? null : toInt(v)) },
    accountingType: { col: `"accountingType"`, transform: (v) => v },

    assignedToUserId: { col: `"assignedToUserId"`, transform: (v) => (v === null ? null : toInt(v)) },

    locationId: { col: `"locationId"`, transform: (v) => (v === null ? null : toInt(v)) },
    networkEnvironmentId: { col: `"networkEnvironmentId"`, transform: (v) => (v === null ? null : toInt(v)) },

    manufacturer: { col: `manufacturer`, transform: (v) => (v === null ? null : String(v)) },
    model: { col: `model`, transform: (v) => (v === null ? null : String(v)) },
    serialNumber: { col: `"serialNumber"`, transform: (v) => (v === null ? null : String(v)) },

    patchPanelLabel: { col: `"patchPanelLabel"`, transform: (v) => (v === null ? null : String(v)) },
    ipAddress: { col: `"ipAddress"`, transform: (v) => v }, // inet string oder null
    macAddresses: {
      col: `"macAddresses"`,
      transform: (v) => {
        const macs = normalizeMacArray(v);
        if (macs === undefined) throw new Error('macAddresses muss ein Array oder null sein');
        return macs;
      }
    },

    leaseDurationMonths: { col: `"leaseDurationMonths"`, transform: (v) => (v === null ? null : toInt(v)) },
    contractType: { col: `"contractType"`, transform: (v) => v },

    notes: { col: `notes`, transform: (v) => (v === null ? null : String(v)) },
  };

  const sets = [];
  const params = [id];

  try {
    for (const key of Object.keys(fields)) {
      if (!hasOwn(b, key)) continue;
      const spec = fields[key];
      const value = spec.transform(b[key]);
      params.push(value);
      sets.push(`${spec.col} = $${params.length}`);
    }
  } catch (e) {
    return res.status(400).json({ error: String(e.message || e) });
  }

  if (sets.length === 0) {
    return res.status(400).json({ error: 'Keine Felder zum Updaten übergeben' });
  }

  params.push(req.user.id);
  sets.push(`"lastEditBy" = $${params.length}`);
  sets.push(`"lastEditAt" = NOW()`);

  try {
    const { rows } = await pool.query(
      `
      UPDATE devices
      SET ${sets.join(', ')}
      WHERE id = $1
      RETURNING *
      `,
      params
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Gerät nicht gefunden' });
    return res.json({ device: rows[0] });
  } catch (e) {
    console.error('[DB ERROR] PATCH /devices/:id', e);
    if (e.code === '23505') return res.status(409).json({ error: 'Inventarnummer existiert bereits' });
    return res.status(500).json({ error: 'Datenbankfehler' });
  }
});

router.get('/devices/:id/electronic-tests', requireAuth, requireActivated, async (req, res) => {
  const deviceId = toInt(req.params.id);
  if (!deviceId) return res.status(400).json({ error: 'Ungültige Geräte-ID' });

  try {
    const { rows } = await pool.query(
      `
      SELECT
        et.*,
        CASE
          WHEN et."lastTest" IS NULL THEN NULL
          WHEN et.scale = 'months' THEN et."lastTest" + (et."nextTestPeriod" || ' months')::interval
          WHEN et.scale = 'years'  THEN et."lastTest" + (et."nextTestPeriod" || ' years')::interval
          ELSE NULL
        END AS "nextTestAt"
      FROM electronic_tests et
      WHERE et."deviceId" = $1
      ORDER BY et."lastTest" DESC NULLS LAST, et.id DESC
      `,
      [deviceId]
    );
    return res.json({ items: rows });
  } catch (e) {
    console.error('[DB ERROR] GET /devices/:id/electronic-tests', e);
    return res.status(500).json({ error: 'Datenbankfehler' });
  }
});

router.post('/devices/:id/electronic-tests', requireAuth, requireActivated, requireEditor, async (req, res) => {
  const deviceId = toInt(req.params.id);
  if (!deviceId) return res.status(400).json({ error: 'Ungültige Geräte-ID' });

  const b = req.body || {};
  if (!b.tester || !b.lastTest || !b.lastTestResult || b.nextTestPeriod === undefined || !b.scale) {
    return res.status(400).json({ error: 'tester, lastTest, lastTestResult, nextTestPeriod, scale erforderlich' });
  }

  if (!['pass', 'fail'].includes(String(b.lastTestResult))) {
    return res.status(400).json({ error: 'lastTestResult muss pass oder fail sein' });
  }
  if (!['months', 'years'].includes(String(b.scale))) {
    return res.status(400).json({ error: 'scale muss months oder years sein' });
  }

  const nextTestPeriod = toInt(b.nextTestPeriod);
  if (!nextTestPeriod || nextTestPeriod < 1) {
    return res.status(400).json({ error: 'nextTestPeriod muss eine positive Zahl sein' });
  }

  try {
    const { rows } = await pool.query(
      `
      INSERT INTO electronic_tests (
        "deviceId", tester, "lastTest", "lastTestResult", "nextTestPeriod", scale,
        "createdBy", "createdAt", "lastEditBy", "lastEditAt"
      ) VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,NOW(),$8,NOW()
      )
      RETURNING *
      `,
      [
        deviceId,
        String(b.tester),
        new Date(b.lastTest),
        String(b.lastTestResult),
        nextTestPeriod,
        String(b.scale),
        req.user.id,
        req.user.id,
      ]
    );

    return res.status(201).json({ electronicTest: rows[0] });
  } catch (e) {
    console.error('[DB ERROR] POST /devices/:id/electronic-tests', e);
    return res.status(500).json({ error: 'Datenbankfehler' });
  }
});

router.patch('/electronic-tests/:testId', requireAuth, requireActivated, requireEditor, async (req, res) => {
  const testId = toInt(req.params.testId);
  if (!testId) return res.status(400).json({ error: 'Ungültige Test-ID' });

  const b = req.body || {};
  const sets = [];
  const params = [testId];

  const allowed = {
    tester: { col: 'tester', transform: (v) => (v === null ? null : String(v)) },
    lastTest: { col: `"lastTest"`, transform: (v) => (v === null ? null : new Date(v)) },
    lastTestResult: { col: `"lastTestResult"`, transform: (v) => v },
    nextTestPeriod: { col: `"nextTestPeriod"`, transform: (v) => (v === null ? null : toInt(v)) },
    scale: { col: `scale`, transform: (v) => v },
  };

  for (const key of Object.keys(allowed)) {
    if (!hasOwn(b, key)) continue;

    if (key === 'lastTestResult' && b[key] !== null && !['pass', 'fail'].includes(String(b[key]))) {
      return res.status(400).json({ error: 'lastTestResult muss pass oder fail sein' });
    }
    if (key === 'scale' && b[key] !== null && !['months', 'years'].includes(String(b[key]))) {
      return res.status(400).json({ error: 'scale muss months oder years sein' });
    }

    const value = allowed[key].transform(b[key]);
    params.push(value);
    sets.push(`${allowed[key].col} = $${params.length}`);
  }

  if (sets.length === 0) return res.status(400).json({ error: 'Keine Felder zum Updaten übergeben' });

  params.push(req.user.id);
  sets.push(`"lastEditBy" = $${params.length}`);
  sets.push(`"lastEditAt" = NOW()`);

  try {
    const { rows } = await pool.query(
      `
      UPDATE electronic_tests
      SET ${sets.join(', ')}
      WHERE id = $1
      RETURNING *
      `,
      params
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Prüfung nicht gefunden' });
    return res.json({ electronicTest: rows[0] });
  } catch (e) {
    console.error('[DB ERROR] PATCH /electronic-tests/:testId', e);
    return res.status(500).json({ error: 'Datenbankfehler' });
  }
});

router.delete('/electronic-tests/:testId', requireAuth, requireActivated, requireAdmin, async (req, res) => {
  const testId = toInt(req.params.testId);
  if (!testId) return res.status(400).json({ error: 'Ungültige Test-ID' });

  try {
    const { rowCount } = await pool.query(
      `DELETE FROM electronic_tests WHERE id = $1`,
      [testId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Prüfung nicht gefunden' });
    return res.json({ deleted: true });
  } catch (e) {
    console.error('[DB ERROR] DELETE /electronic-tests/:testId', e);
    return res.status(500).json({ error: 'Datenbankfehler' });
  }
});

module.exports = router;