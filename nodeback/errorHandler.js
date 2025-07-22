function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${req.method} ${req.url} -`, err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Interner Serverfehler'
  });
}

module.exports = errorHandler;