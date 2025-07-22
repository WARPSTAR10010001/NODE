const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

router.get("/", (req, res) => {
    //...
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