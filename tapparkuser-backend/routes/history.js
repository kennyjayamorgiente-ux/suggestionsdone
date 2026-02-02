const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get comprehensive user history
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const offset = (page - 1) * limit;

    let history = [];

    if (!type || type === 'parking') {
      // Get all reservations for the user first
      const reservations = await db.query(`
        SELECT 
          r.reservation_id as id,
          r.time_stamp as timestamp,
          r.start_time,
          r.end_time,
          r.booking_status,
          r.QR as qr_code,
          r.parking_spots_id,
          v.plate_number,
          v.vehicle_type,
          v.brand,
          v.color,
          CASE 
            WHEN r.end_time IS NOT NULL THEN GREATEST(1, TIMESTAMPDIFF(MINUTE, r.start_time, r.end_time)) / 60.0
            ELSE NULL
          END as hours_deducted
        FROM reservations r
        LEFT JOIN vehicles v ON r.vehicle_id = v.vehicle_id
        WHERE r.user_id = ?
        ORDER BY r.time_stamp DESC
        LIMIT ? OFFSET ?
      `, [req.user.user_id, parseInt(limit), parseInt(offset)]);

      // Process each reservation to get parking details
      const parkingHistory = [];
      
      for (const reservation of reservations) {
        const parkingSpotsId = reservation.parking_spots_id;
        
        // Check if this parking_spots_id exists in parking_section table
        const sectionCheck = await db.query(`
          SELECT parking_section_id 
          FROM parking_section 
          WHERE parking_section_id = ?
        `, [parkingSpotsId]);

        let parkingDetails;
        
        if (sectionCheck.length > 0) {
          // This is a capacity section
          parkingDetails = await db.query(`
            SELECT 
              pa.parking_area_name as location_name,
              pa.location,
              ps.section_name
            FROM parking_section ps
            JOIN parking_area pa ON ps.parking_area_id = pa.parking_area_id
            WHERE ps.parking_section_id = ?
          `, [parkingSpotsId]);

          if (parkingDetails.length > 0) {
            const section = parkingDetails[0];
            parkingHistory.push({
              ...reservation,
              location_name: section.location_name,
              location: section.location,
              spot_number: `M1-${section.section_name}-1`,
              spot_type: 'motorcycle',
              section_name: section.section_name
            });
          }
        } else {
          // This is a regular spot
          parkingDetails = await db.query(`
            SELECT 
              pa.parking_area_name as location_name,
              pa.location,
              ps.spot_number,
              ps.spot_type,
              psec.section_name
            FROM parking_spot ps
            JOIN parking_section psec ON ps.parking_section_id = psec.parking_section_id
            JOIN parking_area pa ON psec.parking_area_id = pa.parking_area_id
            WHERE ps.parking_spot_id = ?
          `, [parkingSpotsId]);

          if (parkingDetails.length > 0) {
            const spot = parkingDetails[0];
            parkingHistory.push({
              ...reservation,
              location_name: spot.location_name,
              location: spot.location,
              spot_number: spot.spot_number,
              spot_type: spot.spot_type,
              section_name: spot.section_name
            });
          }
        }
      }

      history = history.concat(parkingHistory);
    }

    if (!type || type === 'payments') {
      // Get payment history
      const paymentHistory = await db.query(`
        SELECT 
          'payment' as type,
          p.payment_id as id,
          p.payment_date as timestamp,
          p.amount,
          'subscription' as payment_type,
          pm.method_name as payment_method,
          p.status,
          pl.plan_name as location_name,
          pl.number_of_hours,
          pl.cost
        FROM payments p
        LEFT JOIN payment_method pm ON p.payment_method_id = pm.id
        LEFT JOIN subscriptions s ON p.subscription_id = s.subscription_id
        LEFT JOIN plans pl ON s.plan_id = pl.plan_id
        WHERE s.user_id = ?
        ORDER BY p.payment_date DESC
        LIMIT ? OFFSET ?
      `, [req.user.user_id, parseInt(limit), parseInt(offset)]);

      history = history.concat(paymentHistory);
    }

    // Sort combined history by timestamp
    history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Get total counts
    const parkingCount = await db.query(
      'SELECT COUNT(*) as count FROM reservations WHERE user_id = ?',
      [req.user.user_id]
    );

    const paymentCount = await db.query(
      'SELECT COUNT(*) as count FROM payments p JOIN subscriptions s ON p.subscription_id = s.subscription_id WHERE s.user_id = ?',
      [req.user.user_id]
    );

    res.json({
      success: true,
      data: {
        history,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil((parkingCount[0].count + paymentCount[0].count) / limit),
          totalItems: parkingCount[0].count + paymentCount[0].count,
          itemsPerPage: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch history'
    });
  }
});

// Get parking history only
router.get('/parking', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    // Get all reservations for the user first
    let reservationQuery = `
      SELECT 
        r.reservation_id,
        r.time_stamp,
        r.start_time,
        r.end_time,
        r.booking_status,
        r.parking_spots_id,
        v.plate_number,
        v.vehicle_type,
        v.brand,
        CASE 
          WHEN r.end_time IS NOT NULL THEN GREATEST(1, TIMESTAMPDIFF(MINUTE, r.start_time, r.end_time))
          ELSE NULL
        END as duration_minutes,
        CASE 
          WHEN r.end_time IS NOT NULL THEN GREATEST(1, TIMESTAMPDIFF(MINUTE, r.start_time, r.end_time)) / 60.0
          ELSE NULL
        END as hours_deducted
      FROM reservations r
      LEFT JOIN vehicles v ON r.vehicle_id = v.vehicle_id
      WHERE r.user_id = ?
    `;
    const reservationParams = [req.user.user_id];

    if (status) {
      reservationQuery += ' AND r.booking_status = ?';
      reservationParams.push(status);
    }

    reservationQuery += ' ORDER BY r.time_stamp DESC LIMIT ? OFFSET ?';
    reservationParams.push(parseInt(limit), parseInt(offset));

    const reservations = await db.query(reservationQuery, reservationParams);

    // Process each reservation to get parking details
    const sessions = [];
    
    for (const reservation of reservations) {
      const parkingSpotsId = reservation.parking_spots_id;
      
      // Check if this parking_spots_id exists in parking_section table
      const sectionCheck = await db.query(`
        SELECT parking_section_id 
        FROM parking_section 
        WHERE parking_section_id = ?
      `, [parkingSpotsId]);

      let parkingDetails;
      
      if (sectionCheck.length > 0) {
        // This is a capacity section
        parkingDetails = await db.query(`
          SELECT 
            pa.parking_area_id,
            pa.parking_area_name as location_name,
            pa.location as location_address,
            ps.section_name
          FROM parking_section ps
          JOIN parking_area pa ON ps.parking_area_id = pa.parking_area_id
          WHERE ps.parking_section_id = ?
        `, [parkingSpotsId]);

        if (parkingDetails.length > 0) {
          const section = parkingDetails[0];
          sessions.push({
            ...reservation,
            parking_area_id: section.parking_area_id,
            location_name: section.location_name,
            location_address: section.location_address,
            parking_spot_id: parkingSpotsId,
            spot_number: `M1-${section.section_name}-1`,
            spot_type: 'motorcycle',
            spot_status: 'available',
            section_name: section.section_name
          });
        }
      } else {
        // This is a regular spot
        parkingDetails = await db.query(`
          SELECT 
            pa.parking_area_id,
            pa.parking_area_name as location_name,
            pa.location as location_address,
            ps.parking_spot_id,
            ps.spot_number,
            ps.spot_type,
            ps.status as spot_status,
            psec.section_name
          FROM parking_spot ps
          JOIN parking_section psec ON ps.parking_section_id = psec.parking_section_id
          JOIN parking_area pa ON psec.parking_area_id = pa.parking_area_id
          WHERE ps.parking_spot_id = ?
        `, [parkingSpotsId]);

        if (parkingDetails.length > 0) {
          const spot = parkingDetails[0];
          sessions.push({
            ...reservation,
            parking_area_id: spot.parking_area_id,
            location_name: spot.location_name,
            location_address: spot.location_address,
            parking_spot_id: spot.parking_spot_id,
            spot_number: spot.spot_number,
            spot_type: spot.spot_type,
            spot_status: spot.spot_status,
            section_name: spot.section_name
          });
        }
      }
    }

    const totalCount = await db.query(
      'SELECT COUNT(*) as count FROM reservations WHERE user_id = ?' + (status ? ' AND booking_status = ?' : ''),
      status ? [req.user.user_id, status] : [req.user.user_id]
    );

    res.json({
      success: true,
      data: {
        sessions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount[0].count / limit),
          totalItems: totalCount[0].count,
          itemsPerPage: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get parking history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch parking history'
    });
  }
});

// Get payment history only
router.get('/payments', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, type } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        p.payment_id,
        p.subscription_id,
        p.amount,
        'subscription' as payment_type,
        pm.method_name as payment_method,
        p.status,
        p.payment_date as created_at,
        pl.plan_name as location_name,
        pl.description as location_address,
        pl.number_of_hours,
        pl.cost
      FROM payments p
      LEFT JOIN payment_method pm ON p.payment_method_id = pm.id
      LEFT JOIN subscriptions s ON p.subscription_id = s.subscription_id
      LEFT JOIN plans pl ON s.plan_id = pl.plan_id
      WHERE s.user_id = ?
    `;
    const params = [req.user.user_id];

    if (type) {
      query += ' AND p.payment_type = ?';
      params.push(type);
    }

    query += ' ORDER BY p.payment_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const payments = await db.query(query, params);

    const totalCount = await db.query(
      'SELECT COUNT(*) as count FROM payments p JOIN subscriptions s ON p.subscription_id = s.subscription_id WHERE s.user_id = ?' + (type ? ' AND p.payment_type = ?' : ''),
      type ? [req.user.user_id, type] : [req.user.user_id]
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

// Get history statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { period = '30' } = req.query; // days

    // Parking statistics
    const parkingStats = await db.query(`
      SELECT 
        COUNT(*) as total_sessions,
        SUM(CASE WHEN booking_status = 'completed' THEN 1 ELSE 0 END) as completed_sessions,
        SUM(CASE WHEN booking_status = 'active' THEN 1 ELSE 0 END) as active_sessions
      FROM reservations 
      WHERE user_id = ? AND time_stamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [req.user.user_id, parseInt(period)]);

    // Payment statistics
    const paymentStats = await db.query(`
      SELECT 
        COUNT(*) as total_payments,
        SUM(CASE WHEN payment_type = 'topup' THEN amount ELSE 0 END) as total_topup,
        SUM(CASE WHEN payment_type = 'parking_fee' THEN amount ELSE 0 END) as total_parking_fees,
        AVG(CASE WHEN payment_type = 'parking_fee' THEN amount ELSE NULL END) as avg_parking_cost
      FROM payments 
      WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [req.user.user_id, parseInt(period)]);

    // Monthly breakdown
    const monthlyBreakdown = await db.query(`
      SELECT 
        DATE_FORMAT(time_stamp, '%Y-%m') as month,
        COUNT(*) as sessions_count
      FROM reservations 
      WHERE user_id = ? AND time_stamp >= DATE_SUB(NOW(), INTERVAL 12 MONTH) AND booking_status = 'completed'
      GROUP BY DATE_FORMAT(time_stamp, '%Y-%m')
      ORDER BY month DESC
    `, [req.user.user_id]);

    // Most used locations
    // Get reservations first, then determine location for each
    const locationReservations = await db.query(`
      SELECT r.parking_spots_id
      FROM reservations r
      WHERE r.user_id = ? AND r.booking_status = 'completed'
    `, [req.user.user_id]);

    const locationCounts = new Map();
    
    for (const reservation of locationReservations) {
      const parkingSpotsId = reservation.parking_spots_id;
      
      // Check if this parking_spots_id exists in parking_section table
      const sectionCheck = await db.query(`
        SELECT parking_section_id 
        FROM parking_section 
        WHERE parking_section_id = ?
      `, [parkingSpotsId]);

      let locationDetails;
      
      if (sectionCheck.length > 0) {
        // This is a capacity section
        locationDetails = await db.query(`
          SELECT 
            pa.parking_area_id,
            pa.parking_area_name as location_name
          FROM parking_section ps
          JOIN parking_area pa ON ps.parking_area_id = pa.parking_area_id
          WHERE ps.parking_section_id = ?
        `, [parkingSpotsId]);
      } else {
        // This is a regular spot
        locationDetails = await db.query(`
          SELECT 
            pa.parking_area_id,
            pa.parking_area_name as location_name
          FROM parking_spot ps
          JOIN parking_section psec ON ps.parking_section_id = psec.parking_section_id
          JOIN parking_area pa ON psec.parking_area_id = pa.parking_area_id
          WHERE ps.parking_spot_id = ?
        `, [parkingSpotsId]);
      }

      if (locationDetails.length > 0) {
        const location = locationDetails[0];
        const key = location.parking_area_id;
        const current = locationCounts.get(key) || { location_name: location.location_name, visit_count: 0 };
        current.visit_count += 1;
        locationCounts.set(key, current);
      }
    }

    // Convert to array and sort by visit count
    const topLocations = Array.from(locationCounts.values())
      .sort((a, b) => b.visit_count - a.visit_count)
      .slice(0, 5);

    res.json({
      success: true,
      data: {
        parking: parkingStats[0],
        payments: paymentStats[0],
        monthlyBreakdown,
        topLocations
      }
    });

  } catch (error) {
    console.error('Get history stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch history statistics'
    });
  }
});

// Get frequently used parking spots - OPTIMIZED
router.get('/frequent-spots', authenticateToken, async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    console.log('🔍 Fetching frequent spots for user:', req.user.user_id);

    // Optimized single query with JOINs instead of multiple queries
    const frequentSpots = await db.query(`
      SELECT 
        pa.parking_area_id,
        pa.parking_area_name as location_name,
        pa.location as location_address,
        COUNT(r.reservation_id) as usage_count,
        MAX(r.time_stamp) as last_used,
        -- Get spot details with COALESCE to handle both regular spots and motorcycle sections
        COALESCE(ps.spot_number, CONCAT('M1-', psec.section_name, '-1')) as spot_number,
        COALESCE(ps.spot_type, 'motorcycle') as spot_type,
        COALESCE(ps.parking_spot_id, r.parking_section_id) as parking_spot_id,
        -- Determine status with CASE statement
        CASE 
          WHEN r.parking_spots_id = 0 THEN 'AVAILABLE'  -- Motorcycle sections
          WHEN ps.status = 'available' THEN 'AVAILABLE'
          WHEN ps.status = 'occupied' THEN 'OCCUPIED'
          WHEN ps.status = 'reserved' THEN 'RESERVED'
          ELSE 'UNKNOWN'
        END as status
      FROM reservations r
      LEFT JOIN parking_spot ps ON r.parking_spots_id = ps.parking_spot_id
      LEFT JOIN parking_section psec ON r.parking_section_id = psec.parking_section_id
      LEFT JOIN parking_area pa ON (psec.parking_area_id = pa.parking_area_id OR ps.parking_section_id = psec.parking_section_id)
      WHERE r.user_id = ?
        AND (
          (r.parking_spots_id > 0)  -- Regular spots
          OR (r.parking_spots_id = 0 AND r.parking_section_id IS NOT NULL)  -- Motorcycle sections
        )
        AND pa.parking_area_id IS NOT NULL
      GROUP BY 
        pa.parking_area_id, 
        pa.parking_area_name, 
        pa.location,
        COALESCE(ps.spot_number, CONCAT('M1-', psec.section_name, '-1')),
        COALESCE(ps.spot_type, 'motorcycle'),
        COALESCE(ps.parking_spot_id, r.parking_section_id),
        CASE 
          WHEN r.parking_spots_id = 0 THEN 'AVAILABLE'
          WHEN ps.status = 'available' THEN 'AVAILABLE'
          WHEN ps.status = 'occupied' THEN 'OCCUPIED'
          WHEN ps.status = 'reserved' THEN 'RESERVED'
          ELSE 'UNKNOWN'
        END
      ORDER BY usage_count DESC, last_used DESC
      LIMIT ?
    `, [req.user.user_id, parseInt(limit)]);

    console.log('🔍 Frequent spots query result:', frequentSpots.length, 'spots found');

    // Batch current status check for all spots (single query instead of multiple)
    const spotsWithAvailability = await Promise.all(
      frequentSpots.map(async (spot) => {
        // Single query to check current reservation for this spot
        const currentReservation = await db.query(`
          SELECT r.reservation_id, r.booking_status, r.start_time, r.end_time, r.user_id
          FROM reservations r
          WHERE (
            (r.parking_spots_id = ? AND ? > 0)  -- Regular spot check
            OR (r.parking_section_id = ? AND ? = 0)  -- Motorcycle section check
          )
            AND r.booking_status IN ('reserved', 'active')
            AND (r.end_time IS NULL OR r.end_time > NOW())
          ORDER BY r.time_stamp DESC
          LIMIT 1
        `, [spot.parking_spot_id, spot.parking_spot_id, spot.parking_spot_id, spot.parking_spot_id]);

        // Determine final status
        let finalStatus = spot.status;
        
        if (currentReservation.length > 0) {
          const reservation = currentReservation[0];
          if (reservation.user_id === req.user.user_id) {
            finalStatus = reservation.booking_status === 'active' ? 'ACTIVE' : 'RESERVED';
          } else {
            finalStatus = reservation.booking_status === 'active' ? 'OCCUPIED' : 'RESERVED';
          }
        }
        
        return {
          ...spot,
          status: finalStatus,
          current_reservation: currentReservation[0] || null
        };
      })
    );

    res.json({
      success: true,
      data: {
        frequent_spots: spotsWithAvailability
      }
    });

    console.log('✅ Frequent spots response sent:', spotsWithAvailability.length, 'spots');

  } catch (error) {
    console.error('❌ Get frequent spots error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch frequent parking spots'
    });
  }
});

// Delete parking history record
router.delete('/parking/:reservationId', authenticateToken, async (req, res) => {
  try {
    const { reservationId } = req.params;
    const userId = req.user.user_id;

    // Verify that the reservation belongs to the user
    const reservation = await db.query(
      'SELECT reservation_id, user_id FROM reservations WHERE reservation_id = ?',
      [reservationId]
    );

    if (reservation.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'History record not found'
      });
    }

    if (reservation[0].user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this record'
      });
    }

    // Delete the reservation
    const result = await db.query(
      'DELETE FROM reservations WHERE reservation_id = ? AND user_id = ?',
      [reservationId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'History record not found or could not be deleted'
      });
    }

    res.json({
      success: true,
      message: 'History record deleted successfully'
    });

  } catch (error) {
    console.error('Delete history record error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete history record'
    });
  }
});

module.exports = router;
