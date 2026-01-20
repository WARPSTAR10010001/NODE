const express = require("express");
const router = express.Router();
const { requireModerator } = require("../middleware/actionHandler");

router.get("/maintenance", requireModerator, (req, res) => {
  res.status(200).json({ maintenance: global.maintenanceMode });
  return;
});

router.post("/maintenance/:bool", requireModerator, (req, res) => {
  const mode = req.params.bool.toLowerCase();

    if(mode === "1" || mode === "true"){
        global.maintenanceMode = true;
    } else if(mode === "0" || mode === "false"){
        global.maintenanceMode = false;
    } else {
        res.status(400).json({ error: "Falscher Parameter" });
        return;
    }
  res.status(200).json({ success: true, maintenance: global.maintenanceMode });
  return;
});

module.exports = router;