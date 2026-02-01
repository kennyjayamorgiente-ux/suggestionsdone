const jwt = require('jsonwebtoken');
const db = require('../config/database');

// Verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    // Check if JWT_SECRET is configured
    if (!process.env.JWT_SECRET) {
      console.error('❌ JWT_SECRET is not configured in environment variables');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error',
        errorCode: 'JWT_SECRET_MISSING'
      });
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'JsonWebTokenError') {
        console.error('❌ Invalid JWT token:', jwtError.message);
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }
      
      if (jwtError.name === 'TokenExpiredError') {
        console.error('❌ Token expired');
        return res.status(401).json({
          success: false,
          message: 'Token expired'
        });
      }
      throw jwtError;
    }

    if (!decoded || !decoded.userId) {
      console.error('❌ Token decoded but missing userId:', decoded);
      return res.status(401).json({
        success: false,
        message: 'Invalid token payload'
      });
    }
    
    // Check if user still exists and is active
    let user;
    try {
      user = await db.query(
        'SELECT user_id, email, first_name, last_name FROM users WHERE user_id = ?',
        [decoded.userId]
      );
    } catch (dbError) {
      console.error('❌ Database query error in auth middleware:', dbError);
      
      // Check for database connection errors
      if (
        dbError.code === 'ECONNREFUSED' ||
        dbError.code === 'ETIMEDOUT' ||
        dbError.code === 'ENOTFOUND' ||
        dbError.message?.includes('connect ECONNREFUSED') ||
        dbError.message?.includes('connection') ||
        dbError.message?.includes('Unable to connect') ||
        dbError.errno === -61 || // Connection refused (Mac/Linux)
        dbError.errno === 10061 || // Connection refused (Windows)
        dbError.sqlState === '08001' || // SQL connection error
        (dbError.sqlState === 'HY000' && dbError.code === 'ECONNREFUSED')
      ) {
        return res.status(503).json({
          success: false,
          message: 'Database connection error. Please ensure the database server is running.',
          errorCode: 'DATABASE_CONNECTION_ERROR'
        });
      }
      
      throw dbError;
    }

    if (!user || !user.length) {
      console.error('❌ User not found for userId:', decoded.userId);
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // User is valid (no verification check needed for existing users)

    // Add user info to request
    req.user = user[0];
    next();
  } catch (error) {
    console.error('❌ Auth middleware error:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState
    });
    
    // If it's already been handled above, don't send another response
    if (res.headersSent) {
      return;
    }

    return res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      errorCode: 'AUTH_ERROR'
    });
  }
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await db.query(
        'SELECT user_id, email, first_name, last_name FROM users WHERE user_id = ?',
        [decoded.userId]
      );

      if (user.length) {
        req.user = user[0];
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};

// Check if user has sufficient balance
const checkBalance = (requiredAmount = 0) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const user = await db.query(
        'SELECT hour_balance FROM users WHERE user_id = ?',
        [req.user.user_id]
      );

      if (!user.length) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (user[0].hour_balance < requiredAmount) {
        return res.status(400).json({
          success: false,
          message: `Insufficient balance. Required: $${requiredAmount}, Available: $${user[0].hour_balance}`
        });
      }

      req.userBalance = user[0].hour_balance;
      next();
    } catch (error) {
      console.error('Balance check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Balance check failed'
      });
    }
  };
};

// Admin only middleware
const adminOnly = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Check if user is admin (you can modify this logic based on your admin system)
    const isAdmin = req.user.email === 'admin@tapparkuser.com' || req.user.role === 'admin';
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    next();
  } catch (error) {
    console.error('Admin check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authorization error'
    });
  }
};

module.exports = {
  authenticateToken,
  optionalAuth,
  checkBalance,
  adminOnly
};
