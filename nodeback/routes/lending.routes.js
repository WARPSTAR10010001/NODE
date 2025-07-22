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

router.get("/available", (req, res) => {
    //...
});

router.get("/unavailable", (req, res) => {
    //...
});

router.get("/pending", (req, res) => {
    //...
});

router.post("/:did", (req, res) => {
    //...
});

router.put("/accept/:id", (req, res) => {
    //...
});

router.put("/decline/:id", (req, res) => {
    //...
});

router.put("/cancel/:id", (req, res) => {
    //...
});

router.put("/return/:id", (req, res) => {
    //...
});

module.exports = router;