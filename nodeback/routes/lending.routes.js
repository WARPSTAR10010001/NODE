const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

router.get("/", async (req, res, next) => {
    //...
});

router.get("/:id", async (req, res, next) => {
    //...
});

router.get("/user", async (req, res, next) => {
    //...
});

router.get("/available", async (req, res, next) => {
    //...
});

router.get("/unavailable", async (req, res, next) => {
    //...
});

router.get("/pending", async (req, res, next) => {
    //...
});

router.post("/:did", async (req, res, next) => {
    //...
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