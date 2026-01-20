const express = require("express");
const router = express.Router();
const fs = require("fs/promises");
const path = require("path");
const { requireLogin, requireModerator } = require("../actionHandler");

const dataFilePath = path.join(__dirname, "..", "data", "devices.json");

function isValidDevice(device) {
    const isValidDate = (d) => !isNaN(new Date(d).getTime());
    const allowedStatus = ["verfügbar", "nicht verfügbar", "reserviert", "ausgeliehen", "vergeben"];
    const allowedType = ["usb", "laptop", "beamer", "pointer", "headset", "sonstiges"]
    if (
        typeof device.name !== "string" || device.name.trim().length <= 3 ||
        typeof device.typ !== "string" || !allowedType.includes(device.typ.toLowerCase()) ||
        typeof device.hersteller !== "string" ||
        typeof device.modell !== "string" ||
        typeof device.standort !== "string" ||
        typeof device.defekt !== "boolean" ||
        typeof device.status !== "string" || !allowedStatus.includes(device.status.toLowerCase()) ||
        typeof device.abgeschrieben !== "boolean" ||
        !isValidDate(device.anschaffungsdatum) || !isValidDate(device.abschreibedatum) ||
        new Date(device.abschreibedatum) < new Date(device.anschaffungsdatum) ||
        typeof device.erstelltVon !== "number" ||
        !isValidDate(device.erstelltAm) ||
        !isValidDate(device.zuletztBearbeitet) ||
        (device.zugewiesenAn !== null && typeof device.zugewiesenAn !== "number")
    ) {
        return false;
    }
    return true;
}

router.get("/", requireLogin, async (req, res, next) => {
    try {
        const data = await fs.readFile(dataFilePath, "utf-8");
        const devices = JSON.parse(data);
        res.status(200).json(devices);
        return;
    } catch (err) {
        next(err);
    }
});

router.get("/:id", requireLogin, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const data = await fs.readFile(dataFilePath, "utf-8");
        const devices = JSON.parse(data);
        const device = devices.find(d => d.id === id);
        if (device === undefined) {
            res.status(404).send({ error: "Gerät nicht gefunden" });
            return;
        }
        res.status(200).json(device);
        return;
    } catch (err) {
        next(err);
    }
});

router.get("/available", async (req, res, next) => {
    try {
        const data = await fs.readFile(dataFilePath, "utf-8");
        const devices = JSON.parse(data);
        const availableDevices = devices.filter(d => d.status === "verfügbar");
        if (availableDevices === undefined) {
            res.status(404).send({ error: "Keine verfügbaren Geräte gefunden" });
            return;
        }
        res.status(200).json(availableDevices);
        return;
    } catch (err) {
        next(err);
    }
});

router.get("/unavailable", async (req, res, next) => {
    try {
        const data = await fs.readFile(dataFilePath, "utf-8");
        const devices = JSON.parse(data);
        const unavailableDevices = devices.filter(d => d.status === ("nicht verfügbar" || "reserviert" || "ausgeliehen"));
        if (unavailableDevices === undefined) {
            res.status(404).send({ error: "Keine unverfügbaren Geräte gefunden" });
            return;
        }
        res.status(200).json(unavailableDevices);
        return;
    } catch (err) {
        next(err);
    }
});

router.post("/", requireLogin, requireModerator, async (req, res, next) => {
    try {
        const data = await fs.readFile(dataFilePath, "utf-8");
        const devices = JSON.parse(data);
        let nD = req.body;
        if (!isValidDevice(nD)) {
            res.status(400).send({ error: "Ungültige oder unvollständige POST-Anfrage" })
            return;
        }
        let id = 1;
        if (devices.length >= 1) {
            id = devices[devices.length - 1].id + 1;
        }
        nD = {
            erstelltAm: new Date().toISOString(),
            erstelltVon: req.session.userId,
            zuletztBearbeitet: nD.erstelltAm,
            id: id
        };
        devices.push(nD);
        await fs.writeFile(dataFilePath, JSON.stringify(devices, null, 2), "utf-8");
        res.status(201).json(nD);
        return;
    } catch (err) {
        next(err);
    }
});

router.put("/:id", requireLogin, requireModerator, async (req, res, next) => {
    try {
        const data = await fs.readFile(dataFilePath, "utf-8");
        const devices = JSON.parse(data);
        const uD = req.body;
        if (!isValidDevice(uD)) {
            res.status(400).send({ error: "Ungültige oder unvollständige PUT-Anfrage" });
            return;
        }
        const index = devices.findIndex(d => d.id === Number(req.params.id));
        if (index === -1) {
            res.status(404).send({ error: "Gerät nicht gefunden" });
            return;
        }
        const oD = devices[index];
        devices[index] = uD;
        devices[index] = {
            id: Number(req.params.id),
            erstelltVon: oD.erstelltVon,
            erstelltAm: oD.erstelltAm,
            zuletztBearbeitet: new Date().toISOString()
        };
        await fs.writeFile(dataFilePath, JSON.stringify(devices, null, 2), "utf-8");
        res.status(200).json(devices[index]);
        return;
    } catch (err) {
        next(err);
    }
});

router.delete("/:id", requireLogin, requireModerator, async (req, res, next) => {
    try {
        const data = await fs.readFile(dataFilePath, "utf-8");
        const devices = JSON.parse(data);
        const index = devices.findIndex(d => d.id === Number(req.params.id));
        if (index === -1) {
            res.status(404).send({ error: "Gerät nicht gefunden" });
            return;
        }
        const dD = devices.splice(index, 1)[0];
        await fs.writeFile(dataFilePath, JSON.stringify(devices, null, 2), "utf-8");
        res.status(200).json(dD);
        return;
    } catch (err) {
        next(err);
    }
});

module.exports = router;