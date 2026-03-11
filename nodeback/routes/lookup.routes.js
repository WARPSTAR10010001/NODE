const express = require('express');
const pool = require('../db');
const {
    requireAuth,
    requireActivated,
    requireAdmin
} = require('../middleware/actionHandler');

const router = express.Router();

function parseId(param) {
    const id = Number(param);
    return Number.isInteger(id) && id > 0 ? id : null;
}

router.get(
    '/categories',
    requireAuth,
    requireActivated,
    async (_req, res) => {
        try {
            const { rows } = await pool.query(
                'SELECT id, name, description FROM categories ORDER BY name ASC'
            );
            return res.json({ categories: rows });
        } catch (e) {
            console.error('[DB ERROR] GET /categories', e);
            return res.status(500).json({ error: 'Datenbankfehler' });
        }
    }
);

router.post(
    '/categories',
    requireAuth,
    requireActivated,
    requireAdmin,
    async (req, res) => {
        const { name, description = '' } = req.body || {};
        if (!name || !String(name).trim()) {
            return res.status(400).json({ error: 'Name erforderlich' });
        }

        try {
            const { rows } = await pool.query(
                `
        INSERT INTO categories (name, description)
        VALUES ($1, $2)
        RETURNING id, name, description
        `,
                [String(name).trim(), String(description)]
            );
            return res.status(201).json({ category: rows[0] });
        } catch (e) {
            console.error('[DB ERROR] POST /categories', e);
            return res.status(500).json({ error: 'Datenbankfehler' });
        }
    }
);

router.patch(
    '/categories/:id',
    requireAuth,
    requireActivated,
    requireAdmin,
    async (req, res) => {
        const id = parseId(req.params.id);
        if (!id) return res.status(400).json({ error: 'Ungültige Kategorien-ID' });

        const { name, description } = req.body || {};
        const sets = [];
        const params = [id];

        if (name !== undefined) {
            params.push(String(name).trim());
            sets.push(`name = $${params.length}`);
        }
        if (description !== undefined) {
            params.push(String(description));
            sets.push(`description = $${params.length}`);
        }

        if (sets.length === 0) {
            return res.status(400).json({ error: 'Keine Felder zum Updaten übergeben' });
        }

        try {
            const { rows } = await pool.query(
                `
        UPDATE categories
        SET ${sets.join(', ')}
        WHERE id = $1
        RETURNING id, name, description
        `,
                params
            );
            if (rows.length === 0) {
                return res.status(404).json({ error: 'Kategorie nicht gefunden' });
            }
            return res.json({ category: rows[0] });
        } catch (e) {
            console.error('[DB ERROR] PATCH /categories/:id', e);
            return res.status(500).json({ error: 'Datenbankfehler' });
        }
    }
);

router.delete(
    '/categories/:id',
    requireAuth,
    requireActivated,
    requireAdmin,
    async (req, res) => {
        const id = parseId(req.params.id);
        if (!id) return res.status(400).json({ error: 'Ungültige Kategorien-ID' });

        try {
            const { rowCount } = await pool.query(
                'DELETE FROM categories WHERE id = $1',
                [id]
            );
            if (rowCount === 0) {
                return res.status(404).json({ error: 'Kategorie nicht gefunden' });
            }
            return res.json({ deleted: true });
        } catch (e) {
            console.error('[DB ERROR] DELETE /categories/:id', e);
            return res.status(500).json({ error: 'Datenbankfehler' });
        }
    }
);

router.get(
    '/statuses',
    requireAuth,
    requireActivated,
    async (_req, res) => {
        try {
            const { rows } = await pool.query(
                'SELECT id, name, description FROM statuses ORDER BY name ASC'
            );
            return res.json({ statuses: rows });
        } catch (e) {
            console.error('[DB ERROR] GET /statuses', e);
            return res.status(500).json({ error: 'Datenbankfehler' });
        }
    }
);

router.post(
    '/statuses',
    requireAuth,
    requireActivated,
    requireAdmin,
    async (req, res) => {
        const { name, description = '' } = req.body || {};
        if (!name || !String(name).trim()) {
            return res.status(400).json({ error: 'Name erforderlich' });
        }

        try {
            const { rows } = await pool.query(
                `
        INSERT INTO statuses (name, description)
        VALUES ($1, $2)
        RETURNING id, name, description
        `,
                [String(name).trim(), String(description)]
            );
            return res.status(201).json({ status: rows[0] });
        } catch (e) {
            console.error('[DB ERROR] POST /statuses', e);
            return res.status(500).json({ error: 'Datenbankfehler' });
        }
    }
);

router.patch(
    '/statuses/:id',
    requireAuth,
    requireActivated,
    requireAdmin,
    async (req, res) => {
        const id = parseId(req.params.id);
        if (!id) return res.status(400).json({ error: 'Ungültige Status-ID' });

        const { name, description } = req.body || {};
        const sets = [];
        const params = [id];

        if (name !== undefined) {
            params.push(String(name).trim());
            sets.push(`name = $${params.length}`);
        }
        if (description !== undefined) {
            params.push(String(description));
            sets.push(`description = $${params.length}`);
        }

        if (sets.length === 0) {
            return res.status(400).json({ error: 'Keine Felder zum Updaten übergeben' });
        }

        try {
            const { rows } = await pool.query(
                `
        UPDATE statuses
        SET ${sets.join(', ')}
        WHERE id = $1
        RETURNING id, name, description
        `,
                params
            );
            if (rows.length === 0) {
                return res.status(404).json({ error: 'Status nicht gefunden' });
            }
            return res.json({ status: rows[0] });
        } catch (e) {
            console.error('[DB ERROR] PATCH /statuses/:id', e);
            return res.status(500).json({ error: 'Datenbankfehler' });
        }
    }
);

router.delete(
    '/statuses/:id',
    requireAuth,
    requireActivated,
    requireAdmin,
    async (req, res) => {
        const id = parseId(req.params.id);
        if (!id) return res.status(400).json({ error: 'Ungültige Status-ID' });

        try {
            const { rowCount } = await pool.query(
                'DELETE FROM statuses WHERE id = $1',
                [id]
            );
            if (rowCount === 0) {
                return res.status(404).json({ error: 'Status nicht gefunden' });
            }
            return res.json({ deleted: true });
        } catch (e) {
            console.error('[DB ERROR] DELETE /statuses/:id', e);
            return res.status(500).json({ error: 'Datenbankfehler' });
        }
    }
);

router.get(
    '/locations',
    requireAuth,
    requireActivated,
    async (_req, res) => {
        try {
            const { rows } = await pool.query(
                `
        SELECT id, city, address, "houseNumber", room
        FROM locations
        ORDER BY city ASC, address ASC, "houseNumber" ASC NULLS LAST, room ASC NULLS LAST
        `
            );
            return res.json({ locations: rows });
        } catch (e) {
            console.error('[DB ERROR] GET /locations', e);
            return res.status(500).json({ error: 'Datenbankfehler' });
        }
    }
);

router.post(
    '/locations',
    requireAuth,
    requireActivated,
    requireAdmin,
    async (req, res) => {
        const {
            city,
            address,
            houseNumber = null,
            room = null
        } = req.body || {};

        if (!city || !address) {
            return res.status(400).json({ error: 'city und address erforderlich' });
        }

        try {
            const { rows } = await pool.query(
                `
        INSERT INTO locations (city, address, "houseNumber", room)
        VALUES ($1, $2, $3, $4)
        RETURNING id, city, address, "houseNumber", room
        `,
                [
                    String(city).trim(),
                    String(address).trim(),
                    houseNumber === null ? null : String(houseNumber).trim(),
                    room === null ? null : String(room).trim()
                ]
            );
            return res.status(201).json({ location: rows[0] });
        } catch (e) {
            console.error('[DB ERROR] POST /locations', e);
            return res.status(500).json({ error: 'Datenbankfehler' });
        }
    }
);

router.patch(
    '/locations/:id',
    requireAuth,
    requireActivated,
    requireAdmin,
    async (req, res) => {
        const id = parseId(req.params.id);
        if (!id) return res.status(400).json({ error: 'Ungültige Standort-ID' });

        const { city, address, houseNumber, room } = req.body || {};
        const sets = [];
        const params = [id];

        if (city !== undefined) {
            params.push(city === null ? null : String(city).trim());
            sets.push(`city = $${params.length}`);
        }
        if (address !== undefined) {
            params.push(address === null ? null : String(address).trim());
            sets.push(`address = $${params.length}`);
        }
        if (houseNumber !== undefined) {
            params.push(houseNumber === null ? null : String(houseNumber).trim());
            sets.push(`"houseNumber" = $${params.length}`);
        }
        if (room !== undefined) {
            params.push(room === null ? null : String(room).trim());
            sets.push(`room = $${params.length}`);
        }

        if (sets.length === 0) {
            return res.status(400).json({ error: 'Keine Felder zum Updaten übergeben' });
        }

        try {
            const { rows } = await pool.query(
                `
        UPDATE locations
        SET ${sets.join(', ')}
        WHERE id = $1
        RETURNING id, city, address, "houseNumber", room
        `,
                params
            );
            if (rows.length === 0) {
                return res.status(404).json({ error: 'Standort nicht gefunden' });
            }
            return res.json({ location: rows[0] });
        } catch (e) {
            console.error('[DB ERROR] PATCH /locations/:id', e);
            return res.status(500).json({ error: 'Datenbankfehler' });
        }
    }
);

router.delete(
    '/locations/:id',
    requireAuth,
    requireActivated,
    requireAdmin,
    async (req, res) => {
        const id = parseId(req.params.id);
        if (!id) return res.status(400).json({ error: 'Ungültige Standort-ID' });

        try {
            const { rowCount } = await pool.query(
                'DELETE FROM locations WHERE id = $1',
                [id]
            );
            if (rowCount === 0) {
                return res.status(404).json({ error: 'Standort nicht gefunden' });
            }
            return res.json({ deleted: true });
        } catch (e) {
            console.error('[DB ERROR] DELETE /locations/:id', e);
            return res.status(500).json({ error: 'Datenbankfehler' });
        }
    }
);

router.get(
    '/network-environments',
    requireAuth,
    requireActivated,
    async (_req, res) => {
        try {
            const { rows } = await pool.query(
                'SELECT id, name FROM network_environments ORDER BY name ASC'
            );
            return res.json({ networkEnvironments: rows });
        } catch (e) {
            console.error('[DB ERROR] GET /network-environments', e);
            return res.status(500).json({ error: 'Datenbankfehler' });
        }
    }
);

router.post(
    '/network-environments',
    requireAuth,
    requireActivated,
    requireAdmin,
    async (req, res) => {
        const { name } = req.body || {};
        if (!name || !String(name).trim()) {
            return res.status(400).json({ error: 'Name erforderlich' });
        }

        try {
            const { rows } = await pool.query(
                `
        INSERT INTO network_environments (name)
        VALUES ($1)
        RETURNING id, name
        `,
                [String(name).trim()]
            );
            return res.status(201).json({ networkEnvironment: rows[0] });
        } catch (e) {
            console.error('[DB ERROR] POST /network-environments', e);
            return res.status(500).json({ error: 'Datenbankfehler' });
        }
    }
);

router.patch(
    '/network-environments/:id',
    requireAuth,
    requireActivated,
    requireAdmin,
    async (req, res) => {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json({ error: 'Ungültige Netzwerkumgebungs-ID' });
        }

        const { name } = req.body || {};
        const sets = [];
        const params = [id];

        if (name !== undefined) {
            params.push(name === null ? null : String(name).trim());
            sets.push(`name = $${params.length}`);
        }

        if (sets.length === 0) {
            return res.status(400).json({ error: 'Keine Felder zum Updaten übergeben' });
        }

        try {
            const { rows } = await pool.query(
                `
        UPDATE network_environments
        SET ${sets.join(', ')}
        WHERE id = $1
        RETURNING id, name
        `,
                params
            );
            if (rows.length === 0) {
                return res.status(404).json({ error: 'Netzwerkumgebung nicht gefunden' });
            }
            return res.json({ networkEnvironment: rows[0] });
        } catch (e) {
            console.error('[DB ERROR] PATCH /network-environments/:id', e);
            return res.status(500).json({ error: 'Datenbankfehler' });
        }
    }
);

router.delete(
    '/network-environments/:id',
    requireAuth,
    requireActivated,
    requireAdmin,
    async (req, res) => {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json({ error: 'Ungültige Netzwerkumgebungs-ID' });
        }

        try {
            const { rowCount } = await pool.query(
                'DELETE FROM network_environments WHERE id = $1',
                [id]
            );
            if (rowCount === 0) {
                return res.status(404).json({ error: 'Netzwerkumgebung nicht gefunden' });
            }
            return res.json({ deleted: true });
        } catch (e) {
            console.error('[DB ERROR] DELETE /network-environments/:id', e);
            return res.status(500).json({ error: 'Datenbankfehler' });
        }
    }
);

module.exports = router;