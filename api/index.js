require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('../config/db');

const app = express();

// Security: HTTP headers
app.use(helmet());


const allowedOrigins = [
  'http://localhost:5173',
  'https://near-by-frontend.vercel.app'
];

// CORS
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  })
);

// Rate limiting – 100 requests per 15 min per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ensure MongoDB is connected before handling API routes.
app.use(async (_req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: 'Database connection failed' });
  }
});

// Routes
app.use('/api/auth', require('../routes/auth'));
app.use('/api/businesses', require('../routes/business'));
app.use('/api/reviews', require('../routes/review'));
app.use('/api/admin', require('../routes/admin'));
app.use('/api/enterprise', require('../routes/enterprise'));
app.use('/api/payment', require('../routes/payment'));

// Health check
app.get('/health', (_req, res) => res.json({ status: 'OK', timestamp: new Date().toISOString() }));

// Root
app.get('/', (_req, res) => res.json({ success: true, message: 'NearBy Finder API is running' }));

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler
app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'File too large. Maximum size is 10 MB per image.' });
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ success: false, message: 'Too many files. Maximum is 5 images.' });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ success: false, message: 'Unexpected upload field.' });
  }
  if (err.message === 'Only image files are allowed') {
    return res.status(400).json({ success: false, message: err.message });
  }
  console.error(err.stack);
  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  }
};

if (process.env.VERCEL) {
  connectDB().catch((err) => {
    console.error(`MongoDB bootstrap error: ${err.message}`);
  });
} else {
  startServer();
}

module.exports = app;
