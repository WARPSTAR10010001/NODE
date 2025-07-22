const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

router.get("/", async (req, res, next) => {
    try {
        const data = await fs.readFile("./data/devices", "utf-8");
        const devices = JSON.parse(data);
        res.status(200).send(devices);
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