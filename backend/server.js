const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const apiRouter = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimit');

const app = express();

// SECURITY CONTROL: Security Headers — sets X-Content-Type-Options, X-Frame-Options,
// Strict-Transport-Security (once served over HTTPS), and a conservative default CSP.
app.use(helmet());

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map(v => v.trim()).filter(Boolean);
app.use(cors({ origin(origin, cb) { if (!origin || allowedOrigins.includes(origin)) return cb(null, true); return cb(new Error('Origin not allowed by CORS')); }, credentials: false }));
app.use(express.json({ limit: '1mb' })); // caps request body size (basic DoS/abuse guard)

// SECURITY CONTROL: Rate Limiting — baseline limiter API-wide; a stricter
// limiter is layered on top of /auth/login and /auth/register specifically
// (see middleware/rateLimit.js and routes/auth.routes.js).
app.use('/api/v1', generalLimiter);

// In production the same Express service serves the responsive frontend and API.
if (process.env.NODE_ENV === 'production') app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/health', (req, res) => res.json({ status: 'ok', module: 'FreightSync - Service Provider & Network Control' }));

app.use('/api/v1/setup', require('./routes/setup.routes'));
app.use('/api/v1', apiRouter);

// Production browser routes fall back to the login page; unknown API routes stay JSON.
if (process.env.NODE_ENV === 'production') app.get('*', (req,res,next) => { if (req.path.startsWith('/api/')) return next(); return res.sendFile(path.join(__dirname, '../frontend/index.html')); });
// 404 handler
app.use((req, res) => res.status(404).json({ success: false, message: 'Endpoint not found' }));

// Centralized error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`FreightSync API running on http://localhost:${PORT}`);
});

module.exports = app;
