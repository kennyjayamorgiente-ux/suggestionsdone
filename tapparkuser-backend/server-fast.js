const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const db = require('./config/database');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const vehicleRoutes = require('./routes/vehicles');
const parkingRoutes = require('./routes/parking');
const parkingAreasRoutes = require('./routes/parking-areas');
const qrRoutes = require('./routes/qr');
const paymentRoutes = require('./routes/payments');
const favoriteRoutes = require('./routes/favorites');
const historyRoutes = require('./routes/history');
const subscriptionRoutes = require('./routes/subscriptions');
const attendantRoutes = require('./routes/attendant');
const paypalRoutes = require('./routes/paypal');
const capacityRoutes = require('./routes/capacity-management');
const feedbackRoutes = require('./routes/feedback_v2');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware with performance optimizations
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for development
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: true, // Allow all origins for debugging
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ 
  limit: '10mb',
  strict: false // Relax JSON parsing for better performance
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
  parameterLimit: 1000
}));

// Add response time middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) { // Log slow requests
      console.warn(`⚠️ Slow request: ${req.method} ${req.path} - ${duration}ms`);
    }
  });
  next();
});

// Serve static files (QR codes)
app.use('/public', express.static(path.join(__dirname, 'public')));

// Serve profile pictures (explicit handler to avoid static middleware issues)
const profilePicturesDir = path.join(__dirname, 'uploads', 'profile-pictures');

app.use('/uploads/profile-pictures', express.static(profilePicturesDir));

app.get('/uploads/profile-pictures/:filename', (req, res, next) => {
  const { filename } = req.params;
  const filePath = path.join(profilePicturesDir, filename);

  if (fs.existsSync(filePath)) {
    console.log(`📸 Serving profile picture: ${filename}`);
    return res.sendFile(filePath);
  }

  console.warn(`⚠️ Profile picture not found: ${filename}`);
  return res.status(404).json({
    success: false,
    message: 'Profile picture not found',
    filename
  });
});

// Health check endpoint (no database required)
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/parking', parkingRoutes);
app.use('/api/parking-areas', parkingAreasRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/attendant', attendantRoutes);
app.use('/api/paypal', paypalRoutes);
app.use('/api/capacity', capacityRoutes);
app.use('/api/feedback', feedbackRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Server Error'
  });
});

// Start server immediately - listen on all network interfaces for external devices
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Tapparkuser Backend Server running on port ${PORT}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 Network access: http://192.168.1.5:${PORT}/health`);
  console.log(`📋 API Documentation: http://localhost:${PORT}/api`);
  console.log('💡 Database will connect when first API call is made');
});

// Database will connect automatically on first API call - no startup delay
console.log('💡 Database connects automatically on first API call');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await db.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await db.disconnect();
  process.exit(0);
});
