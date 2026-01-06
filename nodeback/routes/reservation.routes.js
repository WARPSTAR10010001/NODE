const express = require("express");
const router = express.Router();
const fs = require("fs/promises");
const path = require("path");
const { requireLogin, requireModerator } = require("../actionHandler");

const dataFilePath = path.join(__dirname, "..", "data", "reservations.json");

router.get("/", requireLogin, requireModerator, async (req, res, next) => {
    try {
        const data = await fs.readFile(dataFilePath, "utf-8");
        const reservations = JSON.parse(data);
        res.status(200).json(reservations);
        return;
    } catch (err) {
        next(err);
    }
});

router.get("/:id", async (req, res, next) => {
    try {
        const data = await fs.readFile(dataFilePath, "utf-8");
        const reservations = JSON.parse(data);
        const reservation = reservations.find(r => r.id === Number(req.params.id));
        if (reservation === undefined) {
            res.status(404).send({ error: "Keine Reservierung gefunden" });
            return;
        }
        res.status(200).json(reservation);
        return;
    } catch (err) {
        next(err);
    }
});

router.get("/user", async (req, res, next) => {
    try {
        const data = await fs.readFile(dataFilePath, "utf-8");
        const reservations = JSON.parse(data);
        const userReservations = reservations.filter(r => r.userId === req.session.userId);
        if (userReservations === undefined) {
            res.status(404).send({ error: "Keine Reservierungen gefunden" });
            return;
        }
        res.status(200).json(userReservations);
        return;
    } catch (err) {
        next(err);
    }
});

router.post("/:did", async (req, res, next) => {
    //...
});

router.put("/cancel/:id", async (req, res, next) => {
    //...
});

module.exports = router;