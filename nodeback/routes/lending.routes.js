const express = require("express");
const router = express.Router();
const fs = require("fs/promises");
const path = require("path");
const { requireLogin, requireModerator } = require("../actionHandler");

const dataFilePath = path.join(__dirname, "..", "data", "lendings.json");

function isValidLending(lending) {
    const isValidDate = (d) => !isNaN(new Date(d).getTime());
    const allowedStatus = ["aktiv", "zurückgegeben", "abgelehnt", "abgebrochen", "ausstehend"];
    if (
        !isValidDate(lending.rueckgabeDatum) ||
        !isValidDate(lending.ausleihDatum) ||
        (lending.rueckgabe !== null && !isValidDate(lending.rueckgabe)) ||
        typeof lending.status !== "string" || !allowedStatus.includes(lending.status.toLowerCase()) ||
        typeof lending.notizen !== "string" ||
        typeof lending.freigeschaltet !== "boolean"
    ) {
        return false;
    }
    return true;
}

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

router.get("/pending", requireLogin, requireModerator, async (req, res, next) => {
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

router.get("/user", requireLogin, async (req, res, next) => {
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

router.get("/:id", requireLogin, async (req, res, next) => {
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

router.post("/:did", requireLogin, async (req, res, next) => {
    try {
        const data = await fs.readFile(dataFilePath, "utf-8");
        const lendings = JSON.parse(data);
        let nL = req.body;
        if (!isValidLending(nL)) {
            res.status(400).send({ error: "Ungültige oder unvollständige POST-Anfrage" })
            return;
        }
        let id = 1;
        if (lendings.length >= 1) {
            id = lendings[lendings.length - 1].id + 1;
        }
        nL = {
            id: id,
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

router.put("/accept/:id", requireLogin, requireModerator, async (req, res, next) => {
    try {
        const data = await fs.readFile(dataFilePath, "utf-8");
        const lendings = JSON.parse(data);
        const index = lendings.findIndex(l => l.id === Number(req.params.id));
        if(index === -1){
            res.status(404).send({ error: "Ausleihe nicht gefunden"});
            return;
        }
        lendings[index].freigeschaltet = true;
        lendings[index].status = "aktiv";
        await fs.writeFile(dataFilePath, JSON.stringify(lendings, null, 2), "utf-8");
        res.status(200).json(lendings[index]);
        return;
    } catch(err) {
        next(err);
    }
});

router.put("/decline/:id", requireLogin, requireModerator, async (req, res, next) => {
    try {
        const data = await fs.readFile(dataFilePath, "utf-8");
        const lendings = JSON.parse(data);
        const index = lendings.findIndex(l => l.id === Number(req.params.id));
        if(index === -1){
            res.status(404).send({ error: "Ausleihe nicht gefunden"});
            return;
        }
        lendings[index].status = "abgelehnt";
        await fs.writeFile(dataFilePath, JSON.stringify(lendings, null, 2), "utf-8");
        res.status(200).json(lendings[index]);
        return;
    } catch(err) {
        next(err);
    }
});

router.put("/cancel/:id", requireLogin, async (req, res, next) => {
    try {
        const data = await fs.readFile(dataFilePath, "utf-8");
        const lendings = JSON.parse(data);
        const index = lendings.findIndex(l => l.id === Number(req.params.id));
        if(index === -1){
            res.status(404).send({ error: "Ausleihe nicht gefunden"});
            return;
        }
        if(lendings[index].freigeschaltet === true){
            res.status(400).send({ error: "Ausleihe kann nicht abgebrochen werden, da diese schon freigeschaltet wurde."});
            return;
        }
        lendings[index].status = "abgebrochen";
        await fs.writeFile(dataFilePath, JSON.stringify(lendings, null, 2), "utf-8");
        res.status(200).json(lendings[index]);
        return;
    } catch(err) {
        next(err);
    }
});

router.put("/return/:id", requireLogin, requireModerator, async (req, res, next) => {
    try {
        const data = await fs.readFile(dataFilePath, "utf-8");
        const lendings = JSON.parse(data);
        const index = lendings.findIndex(l => l.id === Number(req.params.id));
        if(index === -1){
            res.status(404).send({ error: "Ausleihe nicht gefunden"});
            return;
        }
        lendings[index].status = "zurückgegeben";
        lendings[index].rueckgabe = new Date().toISOString();

        await fs.writeFile(dataFilePath, JSON.stringify(lendings, null, 2), "utf-8");
        res.status(200).json(lendings[index]);
        return;
    } catch(err) {
        next(err);
    }
});

module.exports = router;