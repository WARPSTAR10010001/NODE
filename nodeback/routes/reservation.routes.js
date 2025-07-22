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

router.get("/user", (req, res) => {
    //...
});

router.post("/:did", (req, res) => {
    //...
});

router.put("/cancel/:id", (req, res) => {
    //...
});

module.exports = router;