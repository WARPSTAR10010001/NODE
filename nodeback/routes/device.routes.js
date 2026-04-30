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

function normalizeComparableDate(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function normalizeUsernameForLog(value) {
  if (value === undefined || value === null || value === '') return null;
  return String(value).split('@')[0].trim().toLowerCase();
}

function normalizeNumberForLog(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : String(value);
}

function normalizeComparableValue(field, value) {
  if (value === undefined || value === null || value === '') return null;

  if (['purchase', 'latestTestLastTest'].includes(field)) {
    return normalizeComparableDate(value);
  }

  if (field === 'macAddresses') {
    return Array.isArray(value) ? value.map((entry) => String(entry).trim()) : null;
  }

  if ([
    'categoryId',
    'statusId',
    'assignedToUserId',
    'locationId',
    'networkEnvironmentId',
    'depreciationId'
  ].includes(field)) {
    return normalizeNumberForLog(value);
  }

  if (field === 'assignedToUserId' || field === 'createdBy' || field === 'lastEditBy') {
    return normalizeUsernameForLog(value);
  }

  if (['price', 'latestTestNextPeriod', 'leaseDurationMonths', 'depreciationId'].includes(field)) {
    return normalizeNumberForLog(value);
  }

  return value;
}

function valuesEqual(field, left, right) {
  const normalizedLeft = normalizeComparableValue(field, left);
  const normalizedRight = normalizeComparableValue(field, right);

  return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight);
}

function formatLocationLabel(row) {
  if (!row) return null;
  return [row.city, row.address, row.houseNumber, row.room ? `Raum ${row.room}` : null]
    .filter(Boolean)
    .join(', ');
}

function formatAccountingType(value) {
  if (value === 'investiv') return 'Investiv';
  if (value === 'konsumtiv') return 'Konsumtiv';
  return value ?? null;
}

function formatContractType(value) {
  if (value === 'purchase') return 'Kauf';
  if (value === 'lease') return 'Leasing';
  if (value === 'pay-per-page') return 'Pay per Page';
  return value ?? null;
}

function formatTestResult(value) {
  if (value === 'pass') return 'Bestanden';
  if (value === 'fail') return 'Nicht bestanden';
  return value ?? null;
}

function formatDateForLog(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toISOString();
}

async function resolveLogDisplayValue(client, field, value) {
  if (value === undefined || value === null || value === '') return null;

  switch (field) {
    case 'categoryId': {
      const { rows } = await client.query('SELECT name FROM categories WHERE id = $1 LIMIT 1', [value]);
      return rows[0]?.name ?? String(value);
    }
    case 'statusId': {
      const { rows } = await client.query('SELECT name FROM statuses WHERE id = $1 LIMIT 1', [value]);
      return rows[0]?.name ?? String(value);
    }
    case 'assignedToUserId': {
      const { rows } = await client.query('SELECT username FROM users WHERE id = $1 LIMIT 1', [value]);
      return normalizeUsernameForLog(rows[0]?.username ?? value);
    }
    case 'locationId': {
      const { rows } = await client.query(
        'SELECT city, address, "houseNumber", room FROM locations WHERE id = $1 LIMIT 1',
        [value]
      );
      return formatLocationLabel(rows[0]) || String(value);
    }
    case 'networkEnvironmentId': {
      const { rows } = await client.query('SELECT name FROM network_environments WHERE id = $1 LIMIT 1', [value]);
      return rows[0]?.name ?? String(value);
    }
    case 'accountingType':
      return formatAccountingType(value);
    case 'contractType':
      return formatContractType(value);
    case 'latestTestResult':
      return formatTestResult(value);
    case 'latestTestLastTest':
    case 'purchase':
      return formatDateForLog(value);
    case 'price':
    case 'latestTestNextPeriod':
    case 'leaseDurationMonths':
      return normalizeNumberForLog(value);
    case 'macAddresses':
      return Array.isArray(value) ? value.join(', ') : String(value);
    default:
      return value;
  }
}

async function buildLogChanges(client, descriptors) {
  const entries = [];

  for (const descriptor of descriptors) {
    const before = await resolveLogDisplayValue(client, descriptor.field, descriptor.before);
    const after = await resolveLogDisplayValue(client, descriptor.field, descriptor.after);

    if (valuesEqual(descriptor.field, before, after)) {
      continue;
    }

    entries.push({
      field: descriptor.field,
      label: descriptor.label,
      before,
      after
    });
  }

  return entries;
}

async function createDeviceLog(client, { deviceId, inventoryNumber, section, changedBy, changes }) {
  if (!changes.length) return;

  const versionResult = await client.query(
    'SELECT COALESCE(MAX(version), 1) + 1 AS version FROM device_logs WHERE "deviceId" = $1',
    [deviceId]
  );

  const nextVersion = versionResult.rows[0]?.version ?? 2;

  await client.query(
    `
    INSERT INTO device_logs (
      "deviceId", "inventoryNumber", version, section, changes, "changedBy", "changedAt"
    ) VALUES (
      $1, $2, $3, $4, $5::jsonb, $6, NOW()
    )
    `,
    [deviceId, inventoryNumber, nextVersion, section, JSON.stringify(changes), changedBy]
  );
}

function normalizeElectronicTestPayload(body) {
  const tester = String(body.latestTestTester || '').trim();
  const hasLastTest = body.latestTestLastTest !== undefined && body.latestTestLastTest !== null && body.latestTestLastTest !== '';
  const lastTestDate = hasLastTest ? toDate(body.latestTestLastTest) : null;
  const lastTestResult = String(body.latestTestResult || '').trim();
  const hasNextTestPeriod = body.latestTestNextPeriod !== undefined && body.latestTestNextPeriod !== null && body.latestTestNextPeriod !== '';
  const nextTestPeriod = hasNextTestPeriod ? toInt(body.latestTestNextPeriod) : null;
  const hasScale = body.latestTestScale !== undefined && body.latestTestScale !== null && body.latestTestScale !== '';
  const scale = hasScale ? String(body.latestTestScale).trim().toLowerCase() : 'months';

  if (!tester && !hasLastTest && !lastTestResult && !hasNextTestPeriod) {
    return null;
  }

  if (!tester || !hasLastTest || !lastTestResult || !hasNextTestPeriod) {
    throw new Error('Für eine Geräteprüfung sind letzter Tester, letzter Test, Testergebnis und Testintervall erforderlich.');
  }

  if (hasLastTest && lastTestDate === undefined) {
    throw new Error('Das letzte Testdatum muss ein gültiges Datum sein.');
  }

  if (lastTestResult && !['pass', 'fail'].includes(lastTestResult)) {
    throw new Error('Das Testresultat muss bestanden oder nicht bestanden sein.');
  }

  if (hasScale && !['months', 'years'].includes(scale)) {
    throw new Error('Das Testintervall muss in Monaten oder Jahren angegeben werden.');
  }

  if (hasNextTestPeriod && (!nextTestPeriod || nextTestPeriod < 1)) {
    throw new Error('Das Testintervall muss eine positive Zahl sein.');
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
    throw new Error('Abschreibungszeit und Abschreibungsintervall müssen gültig sein.');
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

function generateInventoryNumber() {
  return `NODE-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
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

const currentRevisionSql = `
COALESCE((
  SELECT MAX(dl.version)
  FROM device_logs dl
  WHERE dl."deviceId" = d.id
), 1)
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
        cu.username AS "createdByUsername",
        eu.username AS "lastEditByUsername",
        dep.time AS "depreciationTime",
        dep.scale AS "depreciationScale",
        ${depreciationEndSql} AS "depreciationEnd",
        etl.id AS "latestTestId",
        etl.tester AS "latestTestTester",
        etl."lastTest" AS "latestTestLastTest",
        etl."lastTestResult" AS "latestTestResult",
        etl."nextTestPeriod" AS "latestTestNextPeriod",
        etl.scale AS "latestTestScale",
        ${nextTestAtSql} AS "latestTestNextAt",
        ${currentRevisionSql} AS "currentRevision"
      FROM devices d
      LEFT JOIN categories c ON c.id = d."categoryId"
      LEFT JOIN statuses s ON s.id = d."statusId"
      LEFT JOIN locations l ON l.id = d."locationId"
      LEFT JOIN network_environments ne ON ne.id = d."networkEnvironmentId"
      LEFT JOIN users u ON u.id = d."assignedToUserId"
      LEFT JOIN users cu ON cu.id = d."createdBy"
      LEFT JOIN users eu ON eu.id = d."lastEditBy"
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
    return res.status(500).json({ error: 'Die Geräte konnten nicht geladen werden.' });
  }
});

router.get('/devices/:id', requireAuth, requireActivated, async (req, res) => {
  const id = toInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Ungültige Geräte-ID.' });

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
        cu.username AS "createdByUsername",
        eu.username AS "lastEditByUsername",
        dep.time AS "depreciationTime",
        dep.scale AS "depreciationScale",
        ${depreciationEndSql} AS "depreciationEnd",
        etl.id AS "latestTestId",
        etl.tester AS "latestTestTester",
        etl."lastTest" AS "latestTestLastTest",
        etl."lastTestResult" AS "latestTestResult",
        etl."nextTestPeriod" AS "latestTestNextPeriod",
        etl.scale AS "latestTestScale",
        ${nextTestAtSql} AS "latestTestNextAt",
        ${currentRevisionSql} AS "currentRevision"
      FROM devices d
      LEFT JOIN categories c ON c.id = d."categoryId"
      LEFT JOIN statuses s ON s.id = d."statusId"
      LEFT JOIN locations l ON l.id = d."locationId"
      LEFT JOIN network_environments ne ON ne.id = d."networkEnvironmentId"
      LEFT JOIN users u ON u.id = d."assignedToUserId"
      LEFT JOIN users cu ON cu.id = d."createdBy"
      LEFT JOIN users eu ON eu.id = d."lastEditBy"
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

    if (rows.length === 0) return res.status(404).json({ error: 'Das Gerät konnte nicht gefunden werden.' });
    return res.json({ device: rows[0] });
  } catch (error) {
    console.error('[DB ERROR] GET /devices/:id', error);
    return res.status(500).json({ error: 'Das Gerät konnte nicht geladen werden.' });
  }
});

router.post('/devices', requireAuth, requireActivated, requireEditor, async (req, res) => {
  const body = req.body || {};

  if (!String(body.name || '').trim() || !toInt(body.categoryId) || !toInt(body.statusId)) {
    return res.status(400).json({ error: 'Ein Name, eine Kategorie und ein Status sind erforderlich.' });
  }

  const macs = normalizeMacArray(body.macAddresses);
  if (macs === undefined && hasOwn(body, 'macAddresses')) {
    return res.status(400).json({ error: 'Die MAC-Adressen müssen gültig sein.' });
  }

  const purchaseDate = toDate(body.purchase);
  if (purchaseDate === undefined) {
    return res.status(400).json({ error: 'Das Kaufdatum muss ein gültiges Datum sein.' });
  }

  try {
    const depreciationId = await ensureDepreciationId(body);
    const electronicTest = normalizeElectronicTestPayload(body);
    const client = await pool.connect();

    try {
      let insertedDevice = null;
      let lastInsertError = null;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          await client.query('BEGIN');

          const generatedInventoryNumber = generateInventoryNumber();
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

          insertedDevice = rows[0];
          break;
        } catch (error) {
          await client.query('ROLLBACK');

          if (error.code === '23505') {
            lastInsertError = error;
            continue;
          }

          throw error;
        }
      }

      if (!insertedDevice) {
        throw lastInsertError || new Error('Die Inventarnummer konnte nicht eindeutig erzeugt werden.');
      }

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
            insertedDevice.id,
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
      return res.status(201).json({ device: insertedDevice });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[DB ERROR] POST /devices', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Die generierte Inventarnummer existiert bereits. Bitte erneut versuchen.' });
    }
    if (
      String(error.message || '').includes('depreciationTime')
      || String(error.message || '').includes('latestTest')
      || String(error.message || '').includes('Geräteprüfung')
    ) {
      return res.status(400).json({ error: String(error.message) });
    }
    return res.status(500).json({ error: 'Das Gerät konnte nicht gespeichert werden.' });
  }
});

router.patch('/devices/:id', requireAuth, requireActivated, requireEditor, async (req, res) => {
  const id = toInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Ungültige Geräte-ID.' });

  const body = req.body || {};
  let derivedDepreciationId;

  try {
    if (hasOwn(body, 'depreciationTime') || hasOwn(body, 'depreciationScale') || hasOwn(body, 'depreciationId')) {
      derivedDepreciationId = await ensureDepreciationId(body);
    }
  } catch (error) {
    return res.status(400).json({ error: String(error.message || error) });
  }

  const fields = {
    name: {
      col: 'name',
      label: 'Name',
      transform: (value) => (value === null ? null : String(value).trim())
    },
    categoryId: {
      col: '"categoryId"',
      label: 'Kategorie',
      transform: (value) => (value === null ? null : toInt(value))
    },
    statusId: {
      col: '"statusId"',
      label: 'Status',
      transform: (value) => (value === null ? null : toInt(value))
    },
    purchase: {
      col: 'purchase',
      label: 'Kaufdatum',
      transform: (value) => {
        const date = toDate(value);
        if (date === undefined) throw new Error('Das Kaufdatum muss ein gültiges Datum sein.');
        return date;
      }
    },
    price: { col: 'price', label: 'Preis', transform: (value) => (value === null ? null : value) },
    supplier: { col: 'supplier', label: 'Lieferant', transform: (value) => (value === null ? null : String(value)) },
    depreciationId: {
      col: '"depreciationId"',
      label: 'Abschreibung',
      transform: () => derivedDepreciationId ?? null
    },
    accountingType: { col: '"accountingType"', label: 'Buchungstyp', transform: (value) => value },
    assignedToUserId: {
      col: '"assignedToUserId"',
      label: 'Zugewiesen an',
      transform: (value) => (value === null ? null : toInt(value))
    },
    locationId: {
      col: '"locationId"',
      label: 'Standort',
      transform: (value) => (value === null ? null : toInt(value))
    },
    networkEnvironmentId: {
      col: '"networkEnvironmentId"',
      label: 'Netzwerkumgebung',
      transform: (value) => (value === null ? null : toInt(value))
    },
    manufacturer: { col: 'manufacturer', label: 'Hersteller', transform: (value) => (value === null ? null : String(value)) },
    model: { col: 'model', label: 'Modell', transform: (value) => (value === null ? null : String(value)) },
    serialNumber: {
      col: '"serialNumber"',
      label: 'Seriennummer',
      transform: (value) => (value === null ? null : String(value))
    },
    patchPanelLabel: {
      col: '"patchPanelLabel"',
      label: 'Patchpanel / Port',
      transform: (value) => (value === null ? null : String(value))
    },
    ipAddress: { col: '"ipAddress"', label: 'IP-Adresse', transform: (value) => value },
    macAddresses: {
      col: '"macAddresses"',
      label: 'MAC-Adressen',
      transform: (value) => {
        const macs = normalizeMacArray(value);
        if (macs === undefined) throw new Error('Die MAC-Adressen müssen gültig sein.');
        return macs;
      }
    },
    leaseDurationMonths: {
      col: '"leaseDurationMonths"',
      label: 'Laufzeit Monate',
      transform: (value) => (value === null ? null : toInt(value))
    },
    contractType: { col: '"contractType"', label: 'Vertragsart', transform: (value) => value },
    notes: { col: 'notes', label: 'Notizen', transform: (value) => (value === null ? null : String(value)) },
  };

  const sets = [];
  const params = [id];
  const changedDescriptors = [];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingResult = await client.query('SELECT * FROM devices WHERE id = $1 LIMIT 1', [id]);
    if (existingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Das Gerät konnte nicht gefunden werden.' });
    }

    const existingDevice = existingResult.rows[0];

    for (const key of Object.keys(fields)) {
      if (!hasOwn(body, key)) continue;
      const spec = fields[key];
      const value = spec.transform(body[key]);
      if (valuesEqual(key, existingDevice[key], value)) {
        continue;
      }
      params.push(value);
      sets.push(`${spec.col} = $${params.length}`);
      changedDescriptors.push({
        field: key,
        label: spec.label,
        before: existingDevice[key],
        after: value
      });
    }

    if (sets.length === 0) {
      await client.query('COMMIT');
      return res.json({ device: existingDevice, changed: false });
    }

    params.push(req.user.id);
    sets.push(`"lastEditBy" = $${params.length}`);
    sets.push(`"lastEditAt" = NOW()`);

    const { rows } = await client.query(
      `
      UPDATE devices
      SET ${sets.join(', ')}
      WHERE id = $1
      RETURNING *
      `,
      params
    );

    const logChanges = await buildLogChanges(client, changedDescriptors);
    await createDeviceLog(client, {
      deviceId: id,
      inventoryNumber: rows[0].inventoryNumber,
      section: 'Gerät',
      changedBy: req.user.id,
      changes: logChanges
    });

    await client.query('COMMIT');
    return res.json({ device: rows[0], changed: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[DB ERROR] PATCH /devices/:id', error);
    return res.status(500).json({ error: 'Das Gerät konnte nicht aktualisiert werden.' });
  } finally {
    client.release();
  }
});

router.delete('/devices/:id', requireAuth, requireActivated, requireEditor, async (req, res) => {
  const id = toInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Ungültige Geräte-ID.' });

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
      return res.status(404).json({ error: 'Das Gerät konnte nicht gefunden werden.' });
    }

    await client.query('COMMIT');
    return res.json({ deleted: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[DB ERROR] DELETE /devices/:id', error);
    return res.status(500).json({ error: 'Das Gerät konnte nicht gelöscht werden.' });
  } finally {
    client.release();
  }
});

router.get('/devices/:id/electronic-tests', requireAuth, requireActivated, async (req, res) => {
  const deviceId = toInt(req.params.id);
  if (!deviceId) return res.status(400).json({ error: 'Ungültige Geräte-ID.' });

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
    return res.status(500).json({ error: 'Die Prüfungen konnten nicht geladen werden.' });
  }
});

router.get('/devices/:inventoryNumber/logs', requireAuth, requireActivated, async (req, res) => {
  const inventoryNumber = String(req.params.inventoryNumber || '').trim();

  if (!inventoryNumber) {
    return res.status(400).json({ error: 'Ungültige Inventarnummer.' });
  }

  try {
    const { rows } = await pool.query(
      `
      SELECT
        dl.*,
        u.username AS "changedByUsername"
      FROM device_logs dl
      LEFT JOIN users u ON u.id = dl."changedBy"
      WHERE dl."inventoryNumber" = $1
      ORDER BY dl.version DESC, dl."changedAt" DESC, dl.id DESC
      `,
      [inventoryNumber]
    );

    return res.json({ items: rows });
  } catch (error) {
    console.error('[DB ERROR] GET /devices/:inventoryNumber/logs', error);
    return res.status(500).json({ error: 'Das Änderungsprotokoll konnte nicht geladen werden.' });
  }
});

router.post('/devices/:id/electronic-tests', requireAuth, requireActivated, requireEditor, async (req, res) => {
  const deviceId = toInt(req.params.id);
  if (!deviceId) return res.status(400).json({ error: 'Ungültige Geräte-ID.' });

  const body = req.body || {};
  if (!body.tester || !body.lastTest || !body.lastTestResult || body.nextTestPeriod === undefined || !body.scale) {
    return res.status(400).json({
      error: 'Ein Tester, das letzte Testdatum, das letzte Testresultat und das nächste Testintervall sind erforderlich.',
    });
  }

  if (!['pass', 'fail'].includes(String(body.lastTestResult))) {
    return res.status(400).json({ error: 'Das Testresultat muss bestanden oder nicht bestanden sein.' });
  }
  if (!['months', 'years'].includes(String(body.scale))) {
    return res.status(400).json({ error: 'Das Testintervall muss in Monaten oder Jahren angegeben werden.' });
  }

  const nextTestPeriod = toInt(body.nextTestPeriod);
  if (!nextTestPeriod || nextTestPeriod < 1) {
    return res.status(400).json({ error: 'Das Testintervall muss eine positive Zahl sein.' });
  }

  const lastTestDate = toDate(body.lastTest);
  if (lastTestDate === undefined) {
    return res.status(400).json({ error: 'Das Testdatum muss ein gültiges Datum sein.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const deviceResult = await client.query(
      'SELECT id, "inventoryNumber" FROM devices WHERE id = $1 LIMIT 1',
      [deviceId]
    );

    if (deviceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Das Gerät konnte nicht gefunden werden.' });
    }

    const { rows } = await client.query(
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

    await client.query(
      'UPDATE devices SET "lastEditBy" = $2, "lastEditAt" = NOW() WHERE id = $1',
      [deviceId, req.user.id]
    );

    const logChanges = await buildLogChanges(client, [
      { field: 'latestTestTester', label: 'Letzter Tester', before: null, after: rows[0].tester },
      { field: 'latestTestLastTest', label: 'Letzter Test', before: null, after: rows[0].lastTest },
      { field: 'latestTestResult', label: 'Letztes Testergebnis', before: null, after: rows[0].lastTestResult },
      { field: 'latestTestNextPeriod', label: 'Testintervall', before: null, after: rows[0].nextTestPeriod },
      { field: 'latestTestScale', label: 'Intervall-Einheit', before: null, after: rows[0].scale }
    ]);

    await createDeviceLog(client, {
      deviceId,
      inventoryNumber: deviceResult.rows[0].inventoryNumber,
      section: 'Prüfung',
      changedBy: req.user.id,
      changes: logChanges
    });

    await client.query('COMMIT');
    return res.status(201).json({ electronicTest: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[DB ERROR] POST /devices/:id/electronic-tests', error);
    return res.status(500).json({ error: 'Die Prüfung konnte nicht gespeichert werden.' });
  } finally {
    client.release();
  }
});

router.patch('/electronic-tests/:testId', requireAuth, requireActivated, requireEditor, async (req, res) => {
  const testId = toInt(req.params.testId);
  if (!testId) return res.status(400).json({ error: 'Ungültige Test-ID.' });

  const body = req.body || {};
  const sets = [];
  const params = [testId];
  const changedDescriptors = [];
  const client = await pool.connect();

  const allowed = {
    tester: {
      col: 'tester',
      field: 'latestTestTester',
      label: 'Letzter Tester',
      transform: (value) => (value === null ? null : String(value))
    },
    lastTest: {
      col: '"lastTest"',
      field: 'latestTestLastTest',
      label: 'Letzter Test',
      transform: (value) => {
        const date = toDate(value);
        if (date === undefined) throw new Error('Das Testdatum muss ein gültiges Datum sein.');
        return date;
      }
    },
    lastTestResult: {
      col: '"lastTestResult"',
      field: 'latestTestResult',
      label: 'Letztes Testergebnis',
      transform: (value) => value
    },
    nextTestPeriod: {
      col: '"nextTestPeriod"',
      field: 'latestTestNextPeriod',
      label: 'Testintervall',
      transform: (value) => (value === null ? null : toInt(value))
    },
    scale: {
      col: 'scale',
      field: 'latestTestScale',
      label: 'Intervall-Einheit',
      transform: (value) => value
    },
  };

  try {
    await client.query('BEGIN');

    const existingResult = await client.query(
      `
      SELECT et.*, d."inventoryNumber"
      FROM electronic_tests et
      JOIN devices d ON d.id = et."deviceId"
      WHERE et.id = $1
      LIMIT 1
      `,
      [testId]
    );

    if (existingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Die Prüfung konnte nicht gefunden werden.' });
    }

    const existingTest = existingResult.rows[0];

    for (const key of Object.keys(allowed)) {
      if (!hasOwn(body, key)) continue;

      if (key === 'lastTestResult' && body[key] !== null && !['pass', 'fail'].includes(String(body[key]))) {
        return res.status(400).json({ error: 'Das Testresultat muss bestanden oder nicht bestanden sein.' });
      }
      if (key === 'scale' && body[key] !== null && !['months', 'years'].includes(String(body[key]))) {
        return res.status(400).json({ error: 'Das Testintervall muss in Monaten oder Jahren angegeben werden.' });
      }

      const value = allowed[key].transform(body[key]);
      if (valuesEqual(allowed[key].field, existingTest[key], value)) {
        continue;
      }
      params.push(value);
      sets.push(`${allowed[key].col} = $${params.length}`);
      changedDescriptors.push({
        field: allowed[key].field,
        label: allowed[key].label,
        before: existingTest[key],
        after: value
      });
    }
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(400).json({ error: String(error.message || error) });
  }

  if (sets.length === 0) {
    await client.query('COMMIT');
    return res.json({ electronicTest: { id: testId }, changed: false });
  }

  params.push(req.user.id);
  sets.push(`"lastEditBy" = $${params.length}`);
  sets.push(`"lastEditAt" = NOW()`);

  try {
    const { rows } = await client.query(
      `
      UPDATE electronic_tests
      SET ${sets.join(', ')}
      WHERE id = $1
      RETURNING *
      `,
      params
    );

    await client.query(
      'UPDATE devices SET "lastEditBy" = $2, "lastEditAt" = NOW() WHERE id = $1',
      [existingTest.deviceId, req.user.id]
    );

    const logChanges = await buildLogChanges(client, changedDescriptors);
    await createDeviceLog(client, {
      deviceId: existingTest.deviceId,
      inventoryNumber: existingTest.inventoryNumber,
      section: 'Prüfung',
      changedBy: req.user.id,
      changes: logChanges
    });

    await client.query('COMMIT');
    return res.json({ electronicTest: rows[0], changed: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[DB ERROR] PATCH /electronic-tests/:testId', error);
    return res.status(500).json({ error: 'Die Prüfung konnte nicht aktualisiert werden.' });
  } finally {
    client.release();
  }
});

router.delete('/electronic-tests/:testId', requireAuth, requireActivated, requireAdmin, async (req, res) => {
  const testId = toInt(req.params.testId);
  if (!testId) return res.status(400).json({ error: 'Ungültige Test-ID.' });

  try {
    const { rowCount } = await pool.query(
      'DELETE FROM electronic_tests WHERE id = $1',
      [testId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Die Prüfung konnte nicht gefunden werden.' });
    return res.json({ deleted: true });
  } catch (error) {
    console.error('[DB ERROR] DELETE /electronic-tests/:testId', error);
    return res.status(500).json({ error: 'Die Prüfung konnte nicht gelöscht werden.' });
  }
});

module.exports = router;
