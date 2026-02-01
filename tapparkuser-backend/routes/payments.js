const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, checkBalance } = require('../middleware/auth');
const { logUserActivity, ActionTypes } = require('../utils/userLogger');

const router = express.Router();

// Validation rules
const topUpValidation = [
  body('amount').isFloat({ min: 10 }).withMessage('Minimum top-up amount is $10'),
  body('paymentMethod').isIn(['card', 'bank_transfer', 'wallet']).withMessage('Valid payment method is required')
];

// Get payment history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, type } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT p.*, ps.id as session_id, pl.name as location_name,
             sub.plan_id, sub.user_id, plan.plan_name, plan.number_of_hours,
             CASE WHEN p.subscription_id IS NOT NULL THEN 'subscription' ELSE p.payment_type END as payment_type
      FROM payments p
      LEFT JOIN parking_sessions ps ON p.parking_session_id = ps.id
      LEFT JOIN parking_locations pl ON ps.location_id = pl.id
      LEFT JOIN subscriptions sub ON p.subscription_id = sub.subscription_id
      LEFT JOIN plans plan ON sub.plan_id = plan.plan_id
      WHERE (ps.user_id = ? OR sub.user_id = ?)
    `;
    const params = [req.user.user_id, req.user.user_id];

    if (type) {
      query += ' AND p.payment_type = ?';
      params.push(type);
    }

    query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const payments = await db.query(query, params);
    
    // Debug log to see what data is being returned
    console.log('📊 Payment history query result:');
    console.log('Total payments returned:', payments.length);
    if (payments.length > 0) {
      console.log('First payment sample:', {
        payment_id: payments[0].payment_id,
        user_id: payments[0].user_id, // From sub.user_id
        payment_type: payments[0].payment_type,
        subscription_id: payments[0].subscription_id,
        plan_id: payments[0].plan_id,
        plan_name: payments[0].plan_name,
        number_of_hours: payments[0].number_of_hours,
        amount: payments[0].amount,
        created_at: payments[0].created_at
      });
      
      // Check for subscription transactions
      const subscriptionPayments = payments.filter(p => p.payment_type === 'subscription');
      console.log('Subscription payments found:', subscriptionPayments.length);
      if (subscriptionPayments.length > 0) {
        console.log('First subscription payment:', {
          payment_id: subscriptionPayments[0].payment_id,
          subscription_id: subscriptionPayments[0].subscription_id,
          plan_name: subscriptionPayments[0].plan_name,
          number_of_hours: subscriptionPayments[0].number_of_hours
        });
      }
    }

    const totalCount = await db.query(
      `SELECT COUNT(*) as count FROM payments p
       LEFT JOIN parking_sessions ps ON p.parking_session_id = ps.id
       LEFT JOIN subscriptions sub ON p.subscription_id = sub.subscription_id
       WHERE (ps.user_id = ? OR sub.user_id = ?)` + (type ? ' AND p.payment_type = ?' : ''),
      type ? [req.user.user_id, req.user.user_id, type] : [req.user.user_id, req.user.user_id]
    );

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount[0].count / limit),
          totalItems: totalCount[0].count,
          itemsPerPage: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment history'
    });
  }
});

// Top up wallet
router.post('/topup', authenticateToken, topUpValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { amount, paymentMethod } = req.body;

    // Generate transaction ID (in real app, this would come from payment gateway)
    const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Process payment (simulate payment gateway response)
    const paymentSuccess = Math.random() > 0.1; // 90% success rate for demo

    if (!paymentSuccess) {
      return res.status(400).json({
        success: false,
        message: 'Payment failed. Please try again.'
      });
    }

    // Add to user balance and record payment
    const results = await db.transaction([
      {
        sql: 'UPDATE users SET balance = balance + ? WHERE id = ?',
        params: [amount, req.user.user_id]
      },
      {
        sql: `
          INSERT INTO payments (user_id, amount, payment_type, payment_method, transaction_id, status, gateway_response)
          VALUES (?, ?, 'topup', ?, ?, 'completed', ?)
        `,
        params: [
          req.user.user_id, 
          amount, 
          paymentMethod, 
          transactionId, 
          JSON.stringify({ status: 'success', gateway: 'demo' })
        ]
      }
    ]);

    // Get updated balance
    const user = await db.query(
      'SELECT balance FROM users WHERE id = ?',
      [req.user.user_id]
    );

    // Get payment ID for logging
    const paymentRecord = await db.query(
      'SELECT payment_id FROM payments WHERE transaction_id = ? ORDER BY payment_id DESC LIMIT 1',
      [transactionId]
    );

    // Log payment topup
    if (paymentRecord.length > 0) {
      await logUserActivity(
        req.user.user_id,
        ActionTypes.PAYMENT_TOPUP,
        `Wallet topped up: ₱${amount} via ${paymentMethod}`,
        paymentRecord[0].payment_id
      );
    }

    res.json({
      success: true,
      message: 'Wallet topped up successfully',
      data: {
        transactionId,
        amount,
        newBalance: user[0].balance
      }
    });

  } catch (error) {
    console.error('Top up error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to top up wallet'
    });
  }
});

// Get current balance
router.get('/balance', authenticateToken, async (req, res) => {
  try {
    const user = await db.query(
      'SELECT balance FROM users WHERE id = ?',
      [req.user.user_id]
    );

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        balance: user[0].balance
      }
    });

  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch balance'
    });
  }
});

// Process parking payment
router.post('/parking/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { paymentMethod = 'wallet' } = req.body;

    // Get parking session
    const sessions = await db.query(`
      SELECT ps.*, u.balance
      FROM parking_sessions ps
      JOIN users u ON ps.user_id = u.id
      WHERE ps.id = ? AND ps.user_id = ? AND ps.status = 'active'
    `, [sessionId, req.user.user_id]);

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Active parking session not found'
      });
    }

    const session = sessions[0];
    const endTime = new Date();
    const startTime = new Date(session.start_time);
    // Calculate duration in minutes, ensuring minimum of 1 minute (even for seconds)
    const durationMinutes = Math.max(1, Math.ceil((endTime - startTime) / (1000 * 60)));
    const totalCost = Math.ceil(durationMinutes / 60) * session.hourly_rate;

    // Check balance if using wallet
    if (paymentMethod === 'wallet' && session.balance < totalCost) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Required: $${totalCost}, Available: $${session.balance}`
      });
    }

    // Generate transaction ID
    const transactionId = `PARK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Process payment
    const results = await db.transaction([
      {
        sql: `
          UPDATE parking_sessions 
          SET end_time = NOW(), duration_minutes = ?, total_cost = ?, status = 'completed', payment_status = 'paid'
          WHERE id = ?
        `,
        params: [durationMinutes, totalCost, sessionId]
      },
      {
        sql: `
          UPDATE users 
          SET balance = balance - ? 
          WHERE id = ?
        `,
        params: [paymentMethod === 'wallet' ? totalCost : 0, req.user.user_id]
      },
      {
        sql: `
          UPDATE parking_locations 
          SET available_spots = available_spots + 1 
          WHERE id = ?
        `,
        params: [session.location_id]
      },
      {
        sql: `
          INSERT INTO payments (user_id, parking_session_id, amount, payment_type, payment_method, transaction_id, status)
          VALUES (?, ?, ?, 'parking_fee', ?, ?, 'completed')
        `,
        params: [req.user.user_id, sessionId, totalCost, paymentMethod, transactionId]
      }
    ]);

    // Get updated balance
    const user = await db.query(
      'SELECT balance FROM users WHERE id = ?',
      [req.user.user_id]
    );

    res.json({
      success: true,
      message: 'Parking payment processed successfully',
      data: {
        transactionId,
        totalCost,
        durationMinutes,
        newBalance: user[0].balance
      }
    });

  } catch (error) {
    console.error('Process parking payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process parking payment'
    });
  }
});

// Get payment statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { period = '30' } = req.query; // days

    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_payments,
        SUM(CASE WHEN payment_type = 'topup' THEN amount ELSE 0 END) as total_topup,
        SUM(CASE WHEN payment_type = 'parking_fee' THEN amount ELSE 0 END) as total_parking_fees,
        AVG(CASE WHEN payment_type = 'parking_fee' THEN amount ELSE NULL END) as avg_parking_cost
      FROM payments 
      WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [req.user.user_id, parseInt(period)]);

    const monthlyStats = await db.query(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as payments_count,
        SUM(amount) as total_amount
      FROM payments 
      WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month DESC
    `, [req.user.user_id]);

    res.json({
      success: true,
      data: {
        summary: stats[0],
        monthlyBreakdown: monthlyStats
      }
    });

  } catch (error) {
    console.error('Get payment stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment statistics'
    });
  }
});

module.exports = router;
