const express = require('express');
const pool = require('../db');
const crypto = require('crypto');

const {
  requireAuth,
  requireActivated,
  requireEditor,
  requireAdmin,
} = require('../middleware/actionHandler');

const router = express.Router();

function toInt(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function toDate(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function normalizeMacArray(value) {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value;
  return undefined;
}

function normalizeElectronicTestPayload(body) {
  const hasAnyField = [
    'latestTestTester',
    'latestTestLastTest',
    'latestTestResult',
    'latestTestNextPeriod',
    'latestTestScale'
  ].some((key) => hasOwn(body, key) && body[key] !== undefined && body[key] !== null && body[key] !== '');

  if (!hasAnyField) return null;

  const tester = String(body.latestTestTester || '').trim();
  const lastTestDate = toDate(body.latestTestLastTest);
  const lastTestResult = String(body.latestTestResult || '').trim();
  const nextTestPeriod = toInt(body.latestTestNextPeriod);
  const scale = String(body.latestTestScale || 'months').trim().toLowerCase();

  if (!tester || !body.latestTestLastTest || !lastTestResult || !nextTestPeriod) {
    throw new Error('Für eine Geräteprüfung sind letzter Tester, letzter Test, Testergebnis und Testintervall erforderlich.');
  }

  if (lastTestDate === undefined) {
    throw new Error('latestTestLastTest muss ein gueltiges Datum sein.');
  }

  if (!['pass', 'fail'].includes(lastTestResult)) {
    throw new Error('latestTestResult muss pass oder fail sein.');
  }

  if (!['months', 'years'].includes(scale)) {
    throw new Error('latestTestScale muss months oder years sein.');
  }

  if (nextTestPeriod < 1) {
    throw new Error('latestTestNextPeriod muss eine positive Zahl sein.');
  }

  return {
    tester,
    lastTest: lastTestDate,
    lastTestResult,
    nextTestPeriod,
    scale
  };
}

async function ensureDepreciationId(body) {
  const directId = toInt(body.depreciationId);
  if (directId) return directId;

  const time = toInt(body.depreciationTime);
  const scale = String(body.depreciationScale || '').trim().toLowerCase();

  if (!time && !scale) return null;
  if (!time || !['months', 'years'].includes(scale)) {
    throw new Error('depreciationTime und depreciationScale muessen gueltig sein.');
  }

  const existing = await pool.query(
    'SELECT id FROM depreciations WHERE time = $1 AND scale = $2 LIMIT 1',
    [time, scale]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  const created = await pool.query(
    'INSERT INTO depreciations (time, scale) VALUES ($1, $2) RETURNING id',
    [time, scale]
  );

  return created.rows[0].id;
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
  } catch (error) {
    console.error('[DB ERROR] GET /devices', error);
    return res.status(500).json({ error: 'Geraete konnten nicht geladen werden.' });
  }
});

router.get('/devices/:id', requireAuth, requireActivated, async (req, res) => {
  const id = toInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Ungueltige Geraete-ID.' });

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

    if (rows.length === 0) return res.status(404).json({ error: 'Geraet nicht gefunden.' });
    return res.json({ device: rows[0] });
  } catch (error) {
    console.error('[DB ERROR] GET /devices/:id', error);
    return res.status(500).json({ error: 'Geraet konnte nicht geladen werden.' });
  }
});

router.post('/devices', requireAuth, requireActivated, requireEditor, async (req, res) => {
  const body = req.body || {};

  if (!String(body.name || '').trim() || !toInt(body.categoryId) || !toInt(body.statusId)) {
    return res.status(400).json({ error: 'name, categoryId und statusId sind erforderlich.' });
  }

  const macs = normalizeMacArray(body.macAddresses);
  if (macs === undefined && hasOwn(body, 'macAddresses')) {
    return res.status(400).json({ error: 'macAddresses muss ein Array oder null sein.' });
  }

  const purchaseDate = toDate(body.purchase);
  if (purchaseDate === undefined) {
    return res.status(400).json({ error: 'purchase muss ein gueltiges Datum sein.' });
  }

  const generatedInventoryNumber = `NODE-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  try {
    const depreciationId = await ensureDepreciationId(body);
    const electronicTest = normalizeElectronicTestPayload(body);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
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
          generatedInventoryNumber,
          String(body.name).trim(),
          toInt(body.categoryId),
          toInt(body.statusId),
          purchaseDate,
          body.price ?? null,
          body.supplier ?? null,
          depreciationId,
          body.accountingType ?? 'konsumtiv',
          toInt(body.assignedToUserId),
          toInt(body.locationId),
          toInt(body.networkEnvironmentId),
          body.manufacturer ?? null,
          body.model ?? null,
          body.serialNumber ?? null,
          body.patchPanelLabel ?? null,
          body.ipAddress ?? null,
          macs === undefined ? null : macs,
          toInt(body.leaseDurationMonths),
          body.contractType ?? null,
          body.notes ?? null,
          req.user.id,
          req.user.id,
        ]
      );

      if (electronicTest) {
        await client.query(
          `
          INSERT INTO electronic_tests (
            "deviceId", tester, "lastTest", "lastTestResult", "nextTestPeriod", scale,
            "createdBy", "createdAt", "lastEditBy", "lastEditAt"
          ) VALUES (
            $1,$2,$3,$4,$5,$6,
            $7,NOW(),$8,NOW()
          )
          `,
          [
            rows[0].id,
            electronicTest.tester,
            electronicTest.lastTest,
            electronicTest.lastTestResult,
            electronicTest.nextTestPeriod,
            electronicTest.scale,
            req.user.id,
            req.user.id,
          ]
        );
      }

      await client.query('COMMIT');
      return res.status(201).json({ device: rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[DB ERROR] POST /devices', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Generierte Inventarnummer existiert bereits. Bitte erneut versuchen.' });
    }
    if (
      String(error.message || '').includes('depreciationTime')
      || String(error.message || '').includes('latestTest')
      || String(error.message || '').includes('Geräteprüfung')
    ) {
      return res.status(400).json({ error: String(error.message) });
    }
    return res.status(500).json({ error: 'Geraet konnte nicht gespeichert werden.' });
  }
});

router.patch('/devices/:id', requireAuth, requireActivated, requireEditor, async (req, res) => {
  const id = toInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Ungueltige Geraete-ID.' });

  const body = req.body || {};
  const fields = {
    name: { col: 'name', transform: (value) => (value === null ? null : String(value).trim()) },
    categoryId: { col: '"categoryId"', transform: (value) => (value === null ? null : toInt(value)) },
    statusId: { col: '"statusId"', transform: (value) => (value === null ? null : toInt(value)) },
    purchase: {
      col: 'purchase',
      transform: (value) => {
        const date = toDate(value);
        if (date === undefined) throw new Error('purchase muss ein gueltiges Datum sein.');
        return date;
      }
    },
    price: { col: 'price', transform: (value) => (value === null ? null : value) },
    supplier: { col: 'supplier', transform: (value) => (value === null ? null : String(value)) },
    depreciationId: { col: '"depreciationId"', transform: (value) => (value === null ? null : toInt(value)) },
    accountingType: { col: '"accountingType"', transform: (value) => value },
    assignedToUserId: { col: '"assignedToUserId"', transform: (value) => (value === null ? null : toInt(value)) },
    locationId: { col: '"locationId"', transform: (value) => (value === null ? null : toInt(value)) },
    networkEnvironmentId: { col: '"networkEnvironmentId"', transform: (value) => (value === null ? null : toInt(value)) },
    manufacturer: { col: 'manufacturer', transform: (value) => (value === null ? null : String(value)) },
    model: { col: 'model', transform: (value) => (value === null ? null : String(value)) },
    serialNumber: { col: '"serialNumber"', transform: (value) => (value === null ? null : String(value)) },
    patchPanelLabel: { col: '"patchPanelLabel"', transform: (value) => (value === null ? null : String(value)) },
    ipAddress: { col: '"ipAddress"', transform: (value) => value },
    macAddresses: {
      col: '"macAddresses"',
      transform: (value) => {
        const macs = normalizeMacArray(value);
        if (macs === undefined) throw new Error('macAddresses muss ein Array oder null sein.');
        return macs;
      }
    },
    leaseDurationMonths: { col: '"leaseDurationMonths"', transform: (value) => (value === null ? null : toInt(value)) },
    contractType: { col: '"contractType"', transform: (value) => value },
    notes: { col: 'notes', transform: (value) => (value === null ? null : String(value)) },
  };

  const sets = [];
  const params = [id];

  try {
    for (const key of Object.keys(fields)) {
      if (!hasOwn(body, key)) continue;
      const spec = fields[key];
      const value = spec.transform(body[key]);
      params.push(value);
      sets.push(`${spec.col} = $${params.length}`);
    }
  } catch (error) {
    return res.status(400).json({ error: String(error.message || error) });
  }

  if (sets.length === 0) {
    return res.status(400).json({ error: 'Keine Felder zum Aktualisieren uebergeben.' });
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

    if (rows.length === 0) return res.status(404).json({ error: 'Geraet nicht gefunden.' });
    return res.json({ device: rows[0] });
  } catch (error) {
    console.error('[DB ERROR] PATCH /devices/:id', error);
    return res.status(500).json({ error: 'Geraet konnte nicht aktualisiert werden.' });
  }
});

router.delete('/devices/:id', requireAuth, requireActivated, requireEditor, async (req, res) => {
  const id = toInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Ungueltige Geraete-ID.' });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      'DELETE FROM electronic_tests WHERE "deviceId" = $1',
      [id]
    );

    const { rowCount } = await client.query(
      'DELETE FROM devices WHERE id = $1',
      [id]
    );

    if (rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Geraet nicht gefunden.' });
    }

    await client.query('COMMIT');
    return res.json({ deleted: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[DB ERROR] DELETE /devices/:id', error);
    return res.status(500).json({ error: 'Geraet konnte nicht geloescht werden.' });
  } finally {
    client.release();
  }
});

router.get('/devices/:id/electronic-tests', requireAuth, requireActivated, async (req, res) => {
  const deviceId = toInt(req.params.id);
  if (!deviceId) return res.status(400).json({ error: 'Ungueltige Geraete-ID.' });

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
  } catch (error) {
    console.error('[DB ERROR] GET /devices/:id/electronic-tests', error);
    return res.status(500).json({ error: 'Pruefungen konnten nicht geladen werden.' });
  }
});

router.post('/devices/:id/electronic-tests', requireAuth, requireActivated, requireEditor, async (req, res) => {
  const deviceId = toInt(req.params.id);
  if (!deviceId) return res.status(400).json({ error: 'Ungueltige Geraete-ID.' });

  const body = req.body || {};
  if (!body.tester || !body.lastTest || !body.lastTestResult || body.nextTestPeriod === undefined || !body.scale) {
    return res.status(400).json({
      error: 'tester, lastTest, lastTestResult, nextTestPeriod und scale sind erforderlich.',
    });
  }

  if (!['pass', 'fail'].includes(String(body.lastTestResult))) {
    return res.status(400).json({ error: 'lastTestResult muss pass oder fail sein.' });
  }
  if (!['months', 'years'].includes(String(body.scale))) {
    return res.status(400).json({ error: 'scale muss months oder years sein.' });
  }

  const nextTestPeriod = toInt(body.nextTestPeriod);
  if (!nextTestPeriod || nextTestPeriod < 1) {
    return res.status(400).json({ error: 'nextTestPeriod muss eine positive Zahl sein.' });
  }

  const lastTestDate = toDate(body.lastTest);
  if (lastTestDate === undefined) {
    return res.status(400).json({ error: 'lastTest muss ein gueltiges Datum sein.' });
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
        String(body.tester),
        lastTestDate,
        String(body.lastTestResult),
        nextTestPeriod,
        String(body.scale),
        req.user.id,
        req.user.id,
      ]
    );

    return res.status(201).json({ electronicTest: rows[0] });
  } catch (error) {
    console.error('[DB ERROR] POST /devices/:id/electronic-tests', error);
    return res.status(500).json({ error: 'Pruefung konnte nicht gespeichert werden.' });
  }
});

router.patch('/electronic-tests/:testId', requireAuth, requireActivated, requireEditor, async (req, res) => {
  const testId = toInt(req.params.testId);
  if (!testId) return res.status(400).json({ error: 'Ungueltige Test-ID.' });

  const body = req.body || {};
  const sets = [];
  const params = [testId];

  const allowed = {
    tester: { col: 'tester', transform: (value) => (value === null ? null : String(value)) },
    lastTest: {
      col: '"lastTest"',
      transform: (value) => {
        const date = toDate(value);
        if (date === undefined) throw new Error('lastTest muss ein gueltiges Datum sein.');
        return date;
      }
    },
    lastTestResult: { col: '"lastTestResult"', transform: (value) => value },
    nextTestPeriod: { col: '"nextTestPeriod"', transform: (value) => (value === null ? null : toInt(value)) },
    scale: { col: 'scale', transform: (value) => value },
  };

  try {
    for (const key of Object.keys(allowed)) {
      if (!hasOwn(body, key)) continue;

      if (key === 'lastTestResult' && body[key] !== null && !['pass', 'fail'].includes(String(body[key]))) {
        return res.status(400).json({ error: 'lastTestResult muss pass oder fail sein.' });
      }
      if (key === 'scale' && body[key] !== null && !['months', 'years'].includes(String(body[key]))) {
        return res.status(400).json({ error: 'scale muss months oder years sein.' });
      }

      const value = allowed[key].transform(body[key]);
      params.push(value);
      sets.push(`${allowed[key].col} = $${params.length}`);
    }
  } catch (error) {
    return res.status(400).json({ error: String(error.message || error) });
  }

  if (sets.length === 0) {
    return res.status(400).json({ error: 'Keine Felder zum Aktualisieren uebergeben.' });
  }

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

    if (rows.length === 0) return res.status(404).json({ error: 'Pruefung nicht gefunden.' });
    return res.json({ electronicTest: rows[0] });
  } catch (error) {
    console.error('[DB ERROR] PATCH /electronic-tests/:testId', error);
    return res.status(500).json({ error: 'Pruefung konnte nicht aktualisiert werden.' });
  }
});

router.delete('/electronic-tests/:testId', requireAuth, requireActivated, requireAdmin, async (req, res) => {
  const testId = toInt(req.params.testId);
  if (!testId) return res.status(400).json({ error: 'Ungueltige Test-ID.' });

  try {
    const { rowCount } = await pool.query(
      'DELETE FROM electronic_tests WHERE id = $1',
      [testId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Pruefung nicht gefunden.' });
    return res.json({ deleted: true });
  } catch (error) {
    console.error('[DB ERROR] DELETE /electronic-tests/:testId', error);
    return res.status(500).json({ error: 'Pruefung konnte nicht geloescht werden.' });
  }
});

module.exports = router;
