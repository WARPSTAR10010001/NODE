const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth.routes');

const app = express();

const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:4200';

const corsOptions = {
  origin: allowedOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());

app.use('/api', authRoutes);

app.get('/', (_req, res) => res.send('NODE Server Health Check'));
app.get('/api/health', (_req, res) =>
  res.json({ message: 'NODE Server Health Check', timestamp: Date.now() })
);

module.exports = app;