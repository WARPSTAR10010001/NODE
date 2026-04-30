const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const lookupRoutes = require('./routes/lookup.routes');
const deviceRoutes = require('./routes/device.routes');

const app = express();

function buildCorsOriginChecker() {
  const allowedOrigins = String(process.env.CORS_ORIGIN || 'http://localhost:4200')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('CORS origin not allowed'));
  };
}

app.use(cors({
  origin: buildCorsOriginChecker(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use((error, _req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ error: 'JSON-Body ist ungültig.' });
  }

  return next(error);
});

app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', lookupRoutes);
app.use('/api', deviceRoutes);

app.get('/', (_req, res) => res.send('NODE Server Health Check'));
app.get('/api/health', (_req, res) =>
  res.json({ message: 'NODE Server Health Check', timestamp: Date.now() })
);

app.use('/api', (_req, res) => {
  return res.status(404).json({ error: 'API-Route nicht gefunden.' });
});

app.use((error, _req, res, _next) => {
  console.error('[UNHANDLED ERROR]', error);

  if (error?.message === 'CORS origin not allowed') {
    return res.status(403).json({ error: 'Anfrage von dieser Origin ist nicht erlaubt.' });
  }

  return res.status(500).json({ error: 'Interner Serverfehler.' });
});

module.exports = app;
