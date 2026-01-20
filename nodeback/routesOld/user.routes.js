const express = require("express");
const router = express.Router();
const fs = require("fs/promises");
const path = require("path");
const bcrypt = require("bcrypt");
const { requireLogin, requireModerator } = require("../middleware/actionHandler");

const dataFilePath = path.join(__dirname, "..", "data", "users.json");

function isValidUser(user) {
    const isValidDate = (d) => !isNaN(new Date(d).getTime());
    if (
        typeof user.name !== "string" || user.name.trim().length <= 3 ||
        typeof user.rolle !== "number" || user.rolle > 1 || user.rolle < 0 ||
        typeof user.passwortHash !== "string" ||
        !isValidDate(user.letzterLogin) ||
        typeof user.freigeschaltet !== "boolean"
    ) {
        return false;
    }
    return true;
}

router.get("/", requireLogin, requireModerator, async (req, res, next) => {
    try {
        const data = await fs.readFile(dataFilePath, "utf-8");
        const users = JSON.parse(data).map(u => {
            const { passwortHash, ...safeUser } = u;
            return safeUser;
        });
        res.status(200).json(users);
        return;
    } catch (err) {
        next(err);
    }
});

router.get("/:id", requireLogin, requireModerator, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const data = await fs.readFile(dataFilePath, "utf-8");
        const users = JSON.parse(data).map(u => {
            const { passwortHash, ...safeUser } = u;
            return safeUser;
        });
        const user = users.find(u => u.id === id);
        if (user === undefined) {
            res.status(404).send({ error: "Nutzer nicht gefunden" });
            return;
        }
        res.status(200).json(user);
        return;
    } catch (err) {
        next(err);
    }
});

router.post("/login", async (req, res, next) => {
    try {
        const { name, password } = req.body;
        if (typeof name !== "string" || typeof password !== "string") {
            res.status(400).json({ error: "E-Mail und Passwort erforderlich" });
            return;
        }
        const data = await fs.readFile(dataFilePath, "utf-8");
        const users = JSON.parse(data);
        const user = users.find(u => u.name === name.toLowerCase());
        if (!user) {
            res.status(401).json({ error: "Ungültige Zugangsdaten" });
            return;
        }
        const match = await bcrypt.compare(password, user.passwortHash);
        if (!match) {
            res.status(401).json({ error: "Ungültige Zugangsdaten" });
            return;
        }
        if (!user.freigeschaltet) {
            res.status(403).json({ error: "Account gesperrt oder noch nicht freigeschaltet" });
            return;
        }
        req.session.userId = user.id;
        req.session.role = user.rolle;
        user.letzterLogin = new Date().toISOString();
        await fs.writeFile(dataFilePath, JSON.stringify(users, null, 2), "utf-8");
        res.status(200).json({ message: "Login erfolgreich" });
    } catch (err) {
        next(err);
    }
});

router.post("/logout", (req, res) => {
    req.session.destroy(err => {
        if (err) {
            res.status(500).send("Fehler beim Logout");
            return;
        }
        res.status(200).send({ message: "Ausgeloggt" });
        return;
    });
});

router.post("/", requireLogin, requireModerator, async (req, res, next) => {
    try {
        const { name, rolle, passwort, freigeschaltet } = req.body;
        if (
            typeof name !== "string" || name.length < 3 || !name.includes("@") ||
            typeof rolle !== "number" || rolle < 0 || rolle > 1 ||
            typeof passwort !== "string" || passwort.length < 6 ||
            typeof freigeschaltet !== "boolean"
        ) {
            res.status(400).json({ error: "Ungültige Eingabedaten" });
            return;
        }
        const data = await fs.readFile(dataFilePath, "utf-8");
        const users = JSON.parse(data);
        const exists = users.some(u => u.name === name.toLowerCase());
        if (exists) {
            res.status(409).json({ error: "Benutzername bereits vergeben" });
            return;
        }
        let id = 1;
        if (users.length >= 1) {
            id = users[users.length - 1].id + 1;
        }
        const nU = {
            id,
            name: name.toLowerCase(),
            rolle,
            erstelltAm: new Date().toISOString(),
            letzterLogin: new Date().toISOString(),
            freigeschaltet: true,
            passwortHash: await bcrypt.hash(passwort, 10)
        };
        users.push(nU);
        await fs.writeFile(dataFilePath, JSON.stringify(users, null, 2), "utf-8");
        res.status(201).json({ id: nU.id, name: nU.name, rolle });
        return;
    } catch (err) {
        next(err);
    }
});

router.post("/register", async (req, res, next) => {
    try {
        const { name, rolle, passwort, freigeschaltet } = req.body;
        if (
            typeof name !== "string" || name.length < 3 || !name.includes("@") ||
            typeof rolle !== "number" || rolle < 0 || rolle > 1 ||
            typeof passwort !== "string" || passwort.length < 6 ||
            typeof freigeschaltet !== "boolean"
        ) {
            res.status(400).json({ error: "Ungültige Eingabedaten" });
            return;
        }
        const data = await fs.readFile(dataFilePath, "utf-8");
        const users = JSON.parse(data);
        const exists = users.some(u => u.name === name.toLowerCase());
        if (exists) {
            res.status(409).json({ error: "Benutzername bereits vergeben" });
            return;
        }
        let id = 1;
        if (users.length >= 1) {
            id = users[users.length - 1].id + 1;
        }
        const nU = {
            id,
            name: name.toLowerCase(),
            rolle: 0,
            erstelltAm: new Date().toISOString(),
            letzterLogin: new Date().toISOString(),
            freigeschaltet: false,
            passwortHash: await bcrypt.hash(passwort, 10)
        };
        users.push(nU);
        await fs.writeFile(dataFilePath, JSON.stringify(users, null, 2), "utf-8");
        res.status(201).json({ id: nU.id, name: nU.name, rolle });
        return;
    } catch (err) {
        next(err);
    }
});

router.put("/:id", requireLogin, requireModerator, async (req, res, next) => {
    try {
        const data = await fs.readFile(dataFilePath, "utf-8");
        const users = JSON.parse(data);
        const uU = req.body;
        const nameExists = users.some(u => u.name === uU.name && u.id !== Number(req.params.id));
        if (nameExists) {
            res.status(409).json({ error: "Benutzername bereits vergeben" });
            return;
        }
        if (!isValidUser(uU)) {
            res.status(400).send({ error: "Ungültige oder unvollständige PUT-Anfrage" });
            return;
        }
        const index = users.findIndex(u => u.id === Number(req.params.id));
        if (index === -1) {
            res.status(404).send({ error: "Nutzer nicht gefunden" });
            return;
        }
        if (uU.passwort) {
            uU.passwortHash = await bcrypt.hash(uU.passwort, 10);
            delete uU.passwort;
        }
        const oU = users[index];
        users[index] = uU;
        users[index] = {
            id: oU.id,
            erstelltAm: oU.erstelltAm,
            letzterLogin: oU.letzterLogin
        };
        await fs.writeFile(dataFilePath, JSON.stringify(users, null, 2), "utf-8");
        res.status(200).json(users[index]);
        return;
    } catch (err) {
        next(err);
    }
})

router.delete("/:id", requireLogin, requireModerator, async (req, res, next) => {
    try {
        const data = await fs.readFile(dataFilePath, "utf-8");
        const users = JSON.parse(data);
        const index = users.findIndex(u => u.id === Number(req.params.id));
        if (index === -1) {
            res.status(404).send({ error: "Nutzer nicht gefunden" });
            return;
        }
        const dU = users.splice(index, 1)[0];
        await fs.writeFile(dataFilePath, JSON.stringify(users, null, 2), "utf-8");
        res.status(200).json(dU);
        return;
    } catch (err) {
        next(err);
    }
});

module.exports = router;