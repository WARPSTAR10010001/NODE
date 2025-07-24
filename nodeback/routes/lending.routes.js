const express = require("express");
const router = express.Router();
const fs = require("fs/promises");
const path = require("path");
const { requireLogin, requireModerator } = require("../actionHandler");

const dataFilePath = path.join(__dirname, "..", "data", "lendings.json");
const deviceDataFilePath = path.join(__dirname, "..", "data", "devices.json");

router.get("/", requireLogin, requireModerator, async (req, res, next) => {
    try {
        const data = await fs.readFile(dataFilePath, "utf-8");
        const lendings = JSON.parse(data);
        res.status(200).json(lendings);
        return;
    } catch (err) {
        next(err);
    }
});

router.get("/:id", async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const data = await fs.readFile(dataFilePath, "utf-8");
        const lendings = JSON.parse(data);
        const lending = lendings.find(l => l.id === id);
        if (lending === undefined) {
            res.status(404).send({ error: "Ausleihe nicht gefunden" });
            return;
        }
        res.status(200).json(lending);
        return;
    } catch (err) {
        next(err);
    }
});

router.get("/user", async (req, res, next) => {
    try {
        const data = await fs.readFile(dataFilePath, "utf-8");
        const lendings = JSON.parse(data);
        const userLendings = lendings.filter(l => l.userId === req.session.userId);
        if (userLendings === undefined) {
            res.status(404).send({ error: "Keine Ausleihen gefunden" });
            return;
        }
        res.status(200).json(userLendings);
        return;
    } catch (err) {
        next(err);
    }
});

router.get("/pending", async (req, res, next) => {
    try {
        const data = await fs.readFile(dataFilePath, "utf-8");
        const lendings = JSON.parse(data);
        const pendingLendings = lendings.filter(l => l.status === "ausstehend");
        if (pendingLendings === undefined) {
            res.status(404).send({ error: "Keine ausstehenden Ausleihen verfügbar" });
            return;
        }
        res.status(200).json(pendingLendings);
        return;
    } catch (err) {
        next(err);
    }
});

router.post("/:did", async (req, res, next) => {
    try {
        const data = await fs.readFile(dataFilePath, "utf-8");
        const lendings = await JSON.parse(data);
        let nL = req.body;
        if (!isValidLending(nL)) { //muss implementiert werden
            res.status(400).send({ error: "Ungültige oder unvollständige POST-Anfrage" })
            return;
        }
        nL = {
            id: lendings[lendings.length - 1].id + 1,
            deviceId: Number(req.params.did),
            userId: req.session.userId,
            ausleihDatum: new Date().toISOString(),
            rueckgabe: null,
            status: "ausstehend",
            freigeschaltet: false,
        };
        lendings.push(nL);
        await fs.writeFile(dataFilePath, JSON.stringify(lendings, null, 2), "utf-8");
        res.status(201).json(nL);
        return;
    } catch (err) {
        next(err);
    }
});

router.put("/accept/:id", async (req, res, next) => {
    //...
});

router.put("/decline/:id", async (req, res, next) => {
    //...
});

router.put("/cancel/:id", async (req, res, next) => {
    //...
});

router.put("/return/:id", async (req, res, next) => {
    //...
});

module.exports = router;