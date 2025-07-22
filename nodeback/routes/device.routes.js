const express = require("express");
const router = express.Router();
const fs = require("fs/promises");
const path = require("path");

router.get("/", async (req, res, next) => {
    try {
        const data = await fs.readFile("./data/devices.json", "utf-8");
        const devices = JSON.parse(data);
        res.status(200).json(devices);
    } catch(err) {
        next(err);
    }
});

router.get("/:id", (req, res) => {
    //...
});

router.post("/", (req, res) => {
    //...
});

router.put("/:id", (req, res) => {
    //...
});

router.delete("/:id", (req, res) => {
    //...
});

module.exports = router;