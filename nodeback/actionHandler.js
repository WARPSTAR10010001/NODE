function requireLogin(req, res, next) {
    if (global.maintenanceMode) {
        res.status(503).json({ error: "Das System befindet sich in Wartung" });
        return;
    }
    if (!req.session?.userId) {
        res.status(401).json({ error: "Nicht eingeloggt" });
        return;
    }
    next();
}

function requireModerator(req, res, next) {
    if (req.session?.role !== 1) {
        res.status(403).json({ error: "Keine Berechtigung" });
        return;
    }
    next();
}

function errorLogger(err, req, res, next) {
    console.error(`[ERROR] ${req.method} ${req.url} (${req.session?.userId || "anonymous"}) - ${err.message}`);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Interner Serverfehler"
    });
    return;
}

function requestLogger(req, res, next) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
    next();
}

module.exports = { requireLogin, requireModerator, requestLogger, errorLogger }