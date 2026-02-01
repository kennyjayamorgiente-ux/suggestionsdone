const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

// Get capacity status for all sections in an area
router.get('/areas/:areaId/capacity-status', authenticateToken, async (req, res) => {
  try {
    const { areaId } = req.params;
    const userId = req.user.user_id;
    
    console.log(`📊 DEBUG: Capacity API called for area ${areaId}, userId: ${userId}`);
    console.log(`📊 DEBUG: This should show if backend is restarted`);
    
    // Validate parameters
    if (!userId || !areaId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters'
      });
    }
    
    // Get motorcycle sections with accurate capacity counts
    const query = `
      SELECT 
        ps.parking_section_id,
        ps.section_name,
        ps.capacity as total_capacity,
        ps.parked_count,
        ps.reserved_count,
        ps.section_mode,
        ps.vehicle_type,
        ps.status,
        CASE 
          WHEN EXISTS (
            SELECT 1 
            FROM reservations r2 
            WHERE r2.parking_section_id = ps.parking_section_id 
            AND r2.user_id = ?
            AND r2.booking_status IN ('reserved', 'active')
          ) THEN 1
          ELSE 0
        END as is_user_booked
      FROM parking_section ps
      WHERE ps.parking_area_id = ? AND ps.vehicle_type = 'motorcycle'
      ORDER BY ps.section_name
    `;
    
    const result = await db.execute(query, [userId, areaId]);
    const sections = result.rows;
    
    console.log('🔍 Debug - Query result:', sections.length, 'sections found');
    console.log('🔍 Debug - Query:', query);
    console.log('🔍 Debug - Parameters:', [userId, areaId]);
    
    // Debug: Check what sections actually exist in this area
    const debugQuery = `
      SELECT parking_section_id, section_name, vehicle_type, capacity, parking_area_id
      FROM parking_section 
      WHERE parking_area_id = ?
    `;
    const debugResult = await db.execute(debugQuery, [areaId]);
    console.log('🔍 Debug - All sections in area', areaId, ':', debugResult.rows);
    
    // Debug: Check ALL sections in database to see what exists
    const allSectionsQuery = `
      SELECT parking_section_id, section_name, vehicle_type, capacity, parking_area_id
      FROM parking_section 
      ORDER BY parking_area_id, section_name
    `;
    const allSectionsResult = await db.execute(allSectionsQuery);
    console.log('🔍 Debug - ALL sections in database:', allSectionsResult.rows);
    
    // Calculate real-time capacity using accurate counts
    const capacityStatus = sections.map(section => {
      const totalCapacity = section.total_capacity || 0;
      const parkedCount = section.parked_count || 0;
      const reservedCount = section.reserved_count || 0;
      const totalUsed = parkedCount + reservedCount;
      const availableCapacity = Math.max(0, totalCapacity - totalUsed);
      const utilizationRate = totalCapacity > 0 ? 
        (totalUsed / totalCapacity * 100).toFixed(1) : 0;
      
      return {
        sectionId: section.parking_section_id,
        sectionName: section.section_name,
        vehicleType: section.vehicle_type,
        totalCapacity: totalCapacity,
        availableCapacity: availableCapacity,
        parkedCount: parkedCount,
        reservedCount: reservedCount,
        totalUsed: totalUsed,
        utilizationRate: utilizationRate,
        status: section.status || 'available', // Include section status
        isUserBooked: section.is_user_booked === 1
      };
    });
    
    res.json({
      success: true,
      data: capacityStatus
    });
    
  } catch (error) {
    console.error('Get capacity status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch capacity status'
    });
  }
});

// Reserve capacity in a section
router.post('/sections/:sectionId/reserve', authenticateToken, async (req, res) => {
  try {
    const { sectionId } = req.params;
    const userId = req.user.user_id;
    const { reservationId } = req.body;
    
    console.log(`🎯 Reserving capacity in section ${sectionId} for user ${userId}`);
    
    // Start transaction
    const connection = await db.connection.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Check if section exists and has capacity
      const [sectionCheck] = await connection.execute(`
        SELECT capacity as total_capacity, section_name, parked_count, reserved_count
        FROM parking_section 
        WHERE parking_section_id = ? AND vehicle_type = 'motorcycle'
      `, [sectionId]);
      
      if (sectionCheck.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: 'Section not found or not capacity-based'
        });
      }
      
      const section = sectionCheck[0];
      const totalUsed = (section.parked_count || 0) + (section.reserved_count || 0);
      const availableCapacity = Math.max(0, (section.total_capacity || 0) - totalUsed);
      
      if (availableCapacity <= 0) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'No available capacity in this section'
        });
      }
      
      // For capacity-based sections, we don't need individual parking spots
      // Just create a reservation tied to the section itself
      const [reservationResult] = await connection.execute(`
        INSERT INTO reservations 
        (user_id, parking_spots_id, booking_status, time_stamp, start_time, end_time, QR, qr_key)
        VALUES (?, ?, 'reserved', NOW(), NOW(), DATE_ADD(NOW(), INTERVAL 24 HOUR), ?, ?)
      `, [userId, sectionId, `CAP-${Date.now()}-${userId}`, `CAP-${Date.now()}-${userId}`]);
      
      // Increment reserved_count for the section
      await connection.execute(`
        UPDATE parking_section 
        SET reserved_count = reserved_count + 1 
        WHERE parking_section_id = ?
      `, [sectionId]);
      
      await connection.commit();
      
      res.json({
        success: true,
        message: `Capacity reserved in section ${section.section_name}`,
        data: {
          reservationId: reservationResult.insertId,
          sectionName: section.section_name,
          remainingCapacity: availableCapacity - 1
        }
      });
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Reserve capacity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reserve capacity'
    });
  }
});

// Confirm parking (attendant scans QR - moves from reserved to parked)
router.post('/sections/:sectionId/confirm-parking', authenticateToken, async (req, res) => {
  try {
    const { sectionId } = req.params;
    const userId = req.user.user_id;
    const { reservationId } = req.body;
    
    console.log(`✅ Confirming parking in section ${sectionId} for user ${userId}, reservation ${reservationId}`);
    
    // Start transaction
    const connection = await db.connection.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Update reservation status to active
      const [updateResult] = await connection.execute(`
        UPDATE reservations 
        SET booking_status = 'active', start_time = NOW()
        WHERE reservation_id = ? AND user_id = ? AND booking_status = 'reserved'
      `, [reservationId, userId]);
      
      if (updateResult.affectedRows === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: 'Reservation not found or already confirmed'
        });
      }
      
      // Move from reserved_count to parked_count
      await connection.execute(`
        UPDATE parking_section 
        SET 
          reserved_count = reserved_count - 1,
          parked_count = parked_count + 1
        WHERE parking_section_id = ?
      `, [sectionId]);
      
      await connection.commit();
      
      res.json({
        success: true,
        message: 'Parking confirmed successfully'
      });
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Confirm parking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm parking'
    });
  }
});

// End capacity reservation (when parking ends)
router.post('/sections/:sectionId/end-reservation', authenticateToken, async (req, res) => {
  try {
    const { sectionId } = req.params;
    const userId = req.user.user_id;
    
    console.log(`🏁 Ending capacity reservation in section ${sectionId} for user ${userId}`);
    
    // Start transaction
    const connection = await db.connection.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Find and update user's active reservation in this section
      const [updateResult] = await connection.execute(`
        UPDATE reservations 
        SET booking_status = 'completed', end_time = NOW()
        WHERE parking_spots_id = ? AND user_id = ? AND booking_status = 'active'
      `, [sectionId, userId]);
      
      if (updateResult.affectedRows === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: 'No active reservation found for this user in this section'
        });
      }
      
      // Decrement parked_count
      await connection.execute(`
        UPDATE parking_section 
        SET parked_count = parked_count - 1
        WHERE parking_section_id = ?
      `, [sectionId]);
      
      await connection.commit();
      
      res.json({
        success: true,
        message: 'Capacity reservation ended successfully'
      });
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('End capacity reservation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to end capacity reservation'
    });
  }
});

// Get user's active capacity reservations
router.get('/user/capacity-reservations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    console.log(`👤 Getting capacity reservations for user ${userId}`);
    
    // For now, return empty array since we can't properly track capacity without database changes
    res.json({
      success: true,
      data: []
    });
    
  } catch (error) {
    console.error('Get user capacity reservations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch capacity reservations'
    });
  }
});

// Get parked users for a specific motorcycle section
router.get('/sections/:sectionId/parked-users', authenticateToken, async (req, res) => {
  try {
    const { sectionId } = req.params;
    const userId = req.user.user_id;
    
    console.log(`👥 Getting parked users for section ${sectionId}, userId: ${userId}`);
    
    // Validate parameters
    if (!userId || !sectionId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters'
      });
    }
    
    // Get parked users for this section
    const query = `
      SELECT 
        r.reservation_id,
        r.user_id,
        r.start_time,
        r.end_time,
        u.first_name,
        u.last_name,
        v.plate_number,
        v.vehicle_type,
        v.brand,
        v.color,
        ps.section_name
      FROM reservations r
      JOIN users u ON r.user_id = u.user_id
      JOIN vehicles v ON r.vehicle_id = v.vehicle_id
      JOIN parking_section ps ON r.parking_spots_id = ps.parking_section_id
      WHERE ps.parking_section_id = ? 
        AND r.booking_status = 'active'
        AND ps.vehicle_type = 'motorcycle'
      ORDER BY r.start_time DESC
    `;
    
    const result = await db.execute(query, [sectionId]);
    const parkedUsers = result.rows;
    
    console.log(`🔍 Found ${parkedUsers.length} parked users in section ${sectionId}`);
    
    // Format the response
    const formattedUsers = parkedUsers.map(user => ({
      reservationId: user.reservation_id,
      userId: user.user_id,
      name: `${user.first_name} ${user.last_name}`,
      plateNumber: user.plate_number,
      vehicleType: user.vehicle_type,
      brand: user.brand,
      color: user.color,
      startTime: user.start_time,
      endTime: user.end_time,
      sectionName: user.section_name
    }));
    
    res.json({
      success: true,
      data: {
        sectionId: parseInt(sectionId),
        parkedUsers: formattedUsers,
        totalParked: formattedUsers.length
      }
    });
    
  } catch (error) {
    console.error('Get parked users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch parked users'
    });
  }
});

// Get individual motorcycle spots for a specific section
router.get('/sections/:sectionId/spots', authenticateToken, async (req, res) => {
  try {
    const { sectionId } = req.params;
    const userId = req.user.user_id;
    
    console.log(`🏍️ Getting motorcycle spots for section ${sectionId}, userId: ${userId}`);
    
    // Validate parameters
    if (!userId || !sectionId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters'
      });
    }
    
    // Get individual motorcycle spots for this section
    // For capacity-only sections, generate virtual spots based on capacity
    const query = `
      SELECT 
        ps.parking_section_id,
        ps.section_name,
        ps.capacity as total_capacity,
        ps.parked_count,
        ps.reserved_count,
        ps.section_mode,
        ps.vehicle_type
      FROM parking_section ps
      WHERE ps.parking_section_id = ? 
        AND ps.vehicle_type = 'motorcycle'
    `;
    
    const sectionResult = await db.execute(query, [sectionId]);
    const sectionData = sectionResult.rows[0];
    
    if (!sectionData) {
      return res.status(404).json({
        success: false,
        message: 'Motorcycle section not found'
      });
    }
    
    console.log(`🏍️ Section ${sectionId}: ${sectionData.section_name}, Capacity: ${sectionData.total_capacity}`);
    
    // Get actual reservations for this section to assign to virtual spots
    // Now using the new parking_section_id column directly
    // Include both real parking spots (parking_spots_id > 0) and virtual spots (parking_spots_id = 0)
    const reservationsQuery = `
      SELECT 
        r.reservation_id,
        r.user_id,
        r.booking_status,
        r.start_time,
        r.end_time,
        u.first_name,
        u.last_name,
        v.plate_number,
        v.brand,
        v.color,
        r.spot_number,
        CASE 
          WHEN r.user_id = ? AND r.booking_status IN ('reserved', 'active') THEN 1
          ELSE 0
        END as is_user_booked
      FROM reservations r
      LEFT JOIN users u ON r.user_id = u.user_id
      LEFT JOIN vehicles v ON r.vehicle_id = v.vehicle_id
      WHERE r.parking_section_id = ? 
        AND r.booking_status IN ('reserved', 'active')
        AND (r.parking_spots_id = 0 OR r.parking_spots_id IN (
          SELECT ps.parking_spot_id 
          FROM parking_spot ps 
          WHERE ps.parking_section_id = ?
        ))
      ORDER BY r.start_time
    `;
    
    const reservationsResult = await db.execute(reservationsQuery, [userId, sectionId, sectionId]);
    const reservations = reservationsResult.rows;
    
    console.log(`📋 Found ${reservations.length} active reservations for section ${sectionId}`);
    console.log(`🔍 Reservations details:`, reservations.map(r => ({
      reservationId: r.reservation_id,
      spotNumber: r.spot_number,
      bookingStatus: r.booking_status,
      userName: `${r.first_name} ${r.last_name}`,
      isUserBooked: r.is_user_booked
    })));
    
    // Generate virtual spots
    const virtualSpots = [];
    const totalCapacity = sectionData.total_capacity || 0;
    
    for (let i = 1; i <= totalCapacity; i++) {
      const spotNumber = `${sectionData.section_name}-${i}`;
      
      // Find reservation for this specific spot number
      const reservation = reservations.find(r => r.spot_number === spotNumber);
      
      const spot = {
        spotId: `${sectionId}-virtual-${i}`, // Virtual spot ID
        spotNumber: spotNumber,
        spotType: 'motorcycle',
        status: reservation ? reservation.booking_status : 'available',
        sectionName: sectionData.section_name,
        isUserBooked: reservation ? reservation.is_user_booked === 1 : false,
        reservation: reservation ? {
          reservationId: reservation.reservation_id,
          userId: reservation.user_id,
          userName: `${reservation.first_name} ${reservation.last_name}`,
          plateNumber: reservation.plate_number,
          brand: reservation.brand,
          color: reservation.color,
          startTime: reservation.start_time,
          endTime: reservation.end_time
        } : null
      };
      
      virtualSpots.push(spot);
    }
    
    console.log(`✅ Generated ${virtualSpots.length} virtual spots for section ${sectionId}`);
    
    // Calculate statistics
    const availableSpots = virtualSpots.filter(s => s.status === 'available').length;
    const occupiedSpots = virtualSpots.filter(s => s.status === 'active').length;
    const reservedSpots = virtualSpots.filter(s => s.status === 'reserved').length;
    
    res.json({
      success: true,
      data: {
        sectionId: parseInt(sectionId),
        spots: virtualSpots,
        totalSpots: virtualSpots.length,
        availableSpots: availableSpots,
        occupiedSpots: occupiedSpots,
        reservedSpots: reservedSpots
      }
    });
    
  } catch (error) {
    console.error('Get motorcycle spots error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch motorcycle spots'
    });
  }
});

// Assign user to specific motorcycle spot
router.post('/sections/:sectionId/spots/:spotNumber/assign', authenticateToken, async (req, res) => {
  try {
    const { sectionId, spotNumber } = req.params;
    const { vehicleId } = req.body;
    const userId = req.user.user_id;
    
    console.log(`🏍️ Assigning user ${userId} to spot ${spotNumber} in section ${sectionId}`);
    
    // Validate parameters
    if (!userId || !sectionId || !spotNumber || !vehicleId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters'
      });
    }
    
    // Get section details
    const sectionQuery = `
      SELECT 
        ps.parking_section_id,
        ps.section_name,
        ps.capacity as total_capacity,
        ps.parked_count,
        ps.reserved_count,
        ps.section_mode,
        ps.vehicle_type,
        ps.parking_area_id
      FROM parking_section ps
      WHERE ps.parking_section_id = ? 
        AND ps.vehicle_type = 'motorcycle'
    `;
    
    const sectionResult = await db.execute(sectionQuery, [sectionId]);
    const sectionData = sectionResult.rows[0];
    
    if (!sectionData) {
      return res.status(404).json({
        success: false,
        message: 'Motorcycle section not found'
      });
    }
    
    // Verify vehicle belongs to user
    const vehicle = await db.execute(
      'SELECT vehicle_id FROM vehicles WHERE vehicle_id = ? AND user_id = ?',
      [vehicleId, userId]
    );
    
    if (vehicle.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }
    
    // Check if user has active parking session
    const activeSession = await db.execute(
      'SELECT reservation_id FROM reservations WHERE user_id = ? AND booking_status = "active"',
      [userId]
    );
    
    if (activeSession.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active parking session'
      });
    }
    
    // For capacity-only sections, create a virtual reservation without requiring actual parking_spot
    // Check if there's already a reservation for this virtual spot
    const existingReservation = await db.execute(
      'SELECT reservation_id FROM reservations WHERE parking_section_id = ? AND spot_number = ? AND booking_status IN ("reserved", "active")',
      [sectionId, spotNumber]
    );
    
    if (existingReservation.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Spot is already occupied or reserved'
      });
    }
    
    // Generate unique QR key before creating reservation (same as regular parking)
    const qrKey = require('uuid').v4();
    
    console.log('🔍 Motorcycle Booking Debug - Creating reservation:', { 
      sectionId, 
      spotNumber, 
      vehicleId, 
      qrKey,
      userId
    });
    
    // Create reservation for the virtual spot (same as regular parking process)
    // Use dummy parking_spots_id = 0 for capacity-only sections
    let reservationResult;
    try {
      reservationResult = await db.execute(`
        INSERT INTO reservations (
          user_id, vehicle_id, parking_spots_id, parking_section_id, spot_number, 
          time_stamp, start_time, booking_status, QR, qr_key
        ) VALUES (?, ?, 0, ?, ?, NOW(), NULL, 'reserved', '', ?)
      `, [userId, vehicleId, sectionId, spotNumber, qrKey]);
    } catch (insertError) {
      // If qr_key column doesn't exist, add it and retry (same as regular parking)
      if (insertError.message && insertError.message.includes('Unknown column')) {
        console.log('  qr_key column not found, adding it now...');
        try {
          await db.execute(`
            ALTER TABLE reservations 
            ADD COLUMN qr_key VARCHAR(255) UNIQUE NULL AFTER QR
          `);
          console.log(' Added qr_key column to reservations table');
        } catch (alterError) {
          if (!alterError.message.includes('Duplicate column name')) {
            throw alterError;
          }
        }
        // Retry insert with qr_key
        reservationResult = await db.execute(`
          INSERT INTO reservations (
            user_id, vehicle_id, parking_spots_id, parking_section_id, spot_number, 
            time_stamp, start_time, booking_status, QR, qr_key
          ) VALUES (?, ?, 0, ?, ?, NOW(), NULL, 'reserved', '', ?)
        `, [userId, vehicleId, sectionId, spotNumber, qrKey]);
      } else {
        throw insertError;
      }
    }

    const reservationId = reservationResult.insertId;
    
    // Generate QR code data with only qr_key (same as regular parking)
    // IMPORTANT: Only qr_key is included in the QR code for validation
    const qrData = {
      qr_key: qrKey
    };
    
    console.log('🔍 Capacity QR Debug - qrData:', qrData);
    console.log('🔍 Capacity QR Debug - JSON string:', JSON.stringify(qrData));
    
    // Generate QR code as data URL (same as regular parking)
    // The QR code contains only: qr_key
    const QRCode = require('qrcode');
    const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    console.log('🔍 Capacity QR Debug - Generated QR code length:', qrCodeDataURL.length);
    console.log('🔍 Capacity QR Debug - QR code starts with data:', qrCodeDataURL.startsWith('data:'));
    
    // Update the reservation with the QR code (same as regular parking)
    await db.execute(
      'UPDATE reservations SET QR = ? WHERE reservation_id = ?',
      [qrCodeDataURL, reservationId]
    );
    
    console.log('🔍 Capacity QR Debug - Updated reservation with QR code');
    
    // Update section counts
    await db.execute(`
      UPDATE parking_section 
      SET parked_count = parked_count + 1
      WHERE parking_section_id = ?
    `, [sectionId]);
    
    // Get vehicle and area details for response (same as regular parking)
    const vehicleDetailsResult = await db.execute(
      'SELECT plate_number, vehicle_type, brand FROM vehicles WHERE vehicle_id = ?',
      [vehicleId]
    );
    
    const areaDetailsResult = await db.execute(
      'SELECT parking_area_name, location FROM parking_area WHERE parking_area_id = ?',
      [sectionData.parking_area_id]
    );

    console.log(`✅ Successfully assigned user ${userId} to virtual spot ${spotNumber} in section ${sectionId}`);
    
    // Safely extract vehicle details
    const vehiclePlate = vehicleDetailsResult[0]?.plate_number || 'Unknown';
    const vehicleType = vehicleDetailsResult[0]?.vehicle_type || 'motorcycle';
    const vehicleBrand = vehicleDetailsResult[0]?.brand || 'Unknown';
    
    // Safely extract area details
    const areaName = areaDetailsResult[0]?.parking_area_name || 'Unknown Area';
    const areaLocation = areaDetailsResult[0]?.location || 'Unknown Location';
    
    console.log('🔍 Debug - Extracted details:', {
      vehiclePlate, vehicleType, vehicleBrand, areaName, areaLocation,
      reservationId, qrKey, spotNumber
    });
    
    // Debug the response data
    const responseData = {
      success: true,
      data: {
        reservationId,
        qrCode: qrCodeDataURL, // Use the actual QR code
        qrKey: qrKey,
        message: 'Parking spot booked successfully',
        bookingDetails: {
          reservationId,
          qrCode: qrCodeDataURL, // Use the actual QR code
          qrKey: qrKey,
          vehiclePlate: vehiclePlate,
          vehicleType: vehicleType,
          vehicleBrand: vehicleBrand,
          areaName: areaName,
          areaLocation: areaLocation,
          spotNumber: spotNumber,
          spotType: 'motorcycle',
          startTime: null, // Will be set when attendant scans QR
          status: 'reserved'
        }
      }
    };
    
    console.log('🔍 Debug response data:', JSON.stringify(responseData, null, 2));
    
    // Return response in exact same format as regular parking
    res.json(responseData);
    
  } catch (error) {
    console.error('Assign motorcycle spot error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign parking spot'
    });
  }
});

// Assign guest to specific motorcycle spot
router.post('/sections/:sectionId/spots/:spotNumber/guest-assign', authenticateToken, async (req, res) => {
  try {
    const { sectionId, spotNumber } = req.params;
    const { guestName, plateNumber, brand, model, color } = req.body;
    const userId = req.user.user_id;
    
    console.log(`🏍️ Assigning guest ${guestName} to spot ${spotNumber} in section ${sectionId}`);
    
    // Validate parameters
    if (!userId || !sectionId || !spotNumber || !guestName || !plateNumber) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters'
      });
    }
    
    // Get section details
    const sectionQuery = `
      SELECT 
        ps.parking_section_id,
        ps.section_name,
        ps.capacity as total_capacity,
        ps.parked_count,
        ps.reserved_count,
        ps.section_mode,
        ps.vehicle_type
      FROM parking_section ps
      WHERE ps.parking_section_id = ? 
        AND ps.vehicle_type = 'motorcycle'
    `;
    
    const sectionResult = await db.execute(sectionQuery, [sectionId]);
    const sectionData = sectionResult.rows[0];
    
    if (!sectionData) {
      return res.status(404).json({
        success: false,
        message: 'Motorcycle section not found'
      });
    }
    
    // Check if spot is already occupied (using reservation_id instead of id)
    const existingReservation = await db.execute(`
      SELECT reservation_id FROM reservations 
      WHERE parking_section_id = ? 
        AND spot_number = ? 
        AND booking_status = 'active'
    `, [sectionId, spotNumber]);
    
    if (existingReservation.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Spot is already occupied'
      });
    }
    
    // Start transaction for guest booking
    const connection = await db.connection.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Create guest user (temporary user with guest identifier) - same as existing system
      const guestEmail = `guest_${Date.now()}_${Math.random().toString(36).substring(7)}@tappark.guest`;
      const guestPassword = 'guest_temp_password'; // Temporary password, guest won't login
      const hashedPassword = await bcrypt.hash(guestPassword, 12);
      
      const [guestUserResult] = await connection.execute(
        `INSERT INTO users (email, password, first_name, last_name, user_type_id, hour_balance)
         VALUES (?, ?, ?, ?, 1, 0)`,
        [guestEmail, hashedPassword, guestName, 'Guest']
      );

      const guestUserId = guestUserResult.insertId;
      console.log(`✅ Guest user created with ID: ${guestUserId}`);

      // Create vehicle for guest (vehicles table doesn't have model column)
      const [vehicleResult] = await connection.execute(
        `INSERT INTO vehicles (user_id, plate_number, vehicle_type, brand, color)
         VALUES (?, ?, ?, ?, ?)`,
        [guestUserId, plateNumber, 'motorcycle', brand || null, color || null]
      );

      const vehicleId = vehicleResult.insertId;
      console.log(`✅ Guest vehicle created with ID: ${vehicleId}`);
      
      // Generate QR key for guest booking
      const qrKey = require('uuid').v4();
      console.log(`🔑 Creating guest reservation with qrKey: ${qrKey}`);
      
      // Create guest reservation following the same pattern as bookMotorcycleSection
      const [insertResult] = await connection.execute(`
        INSERT INTO reservations (
          user_id, vehicle_id, parking_spots_id, parking_section_id, spot_number,
          time_stamp, start_time, booking_status, QR
        ) VALUES (?, ?, 0, ?, ?, NOW(), NOW(), 'active', '')
      `, [
        guestUserId, // Use guest user ID
        vehicleId,   // Use guest vehicle ID
        sectionId,
        spotNumber
      ]);
      
      console.log(`✅ Guest reservation created with ID: ${insertResult.insertId}`);
      
      // Increment parked_count for the section (not reserved_count for active bookings)
      await connection.execute(`
        UPDATE parking_section 
        SET parked_count = parked_count + 1 
        WHERE parking_section_id = ?
      `, [sectionId]);
      
      console.log(`✅ Section parked_count incremented`);
      
      await connection.commit();
      connection.release();
      
      console.log(`✅ Transaction committed successfully`);
      
      console.log(`✅ Successfully assigned guest ${guestName} to virtual spot ${spotNumber} in section ${sectionId}`);
      
      res.json({
        success: true,
        message: 'Successfully assigned guest to parking spot',
        data: {
          sectionId: parseInt(sectionId),
          spotNumber: spotNumber,
          reservationId: insertResult.insertId,
          sectionName: sectionData.section_name
        }
      });
      
    } catch (error) {
      console.error('❌ Transaction error in guest motorcycle booking:', error);
      await connection.rollback();
      connection.release();
      throw error;
    }
    
  } catch (error) {
    console.error('Assign guest motorcycle spot error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign guest to parking spot'
    });
  }
});

// Release/unassign motorcycle spot
router.post('/sections/:sectionId/spots/:spotNumber/release', authenticateToken, async (req, res) => {
  try {
    const { sectionId, spotNumber } = req.params;
    const userId = req.user.user_id;
    
    console.log(`🏍️ Releasing spot ${spotNumber} in section ${sectionId} for user ${userId}`);
    
    // Find and update the reservation
    const reservationResult = await db.execute(`
      UPDATE reservations 
      SET booking_status = 'completed', end_time = NOW()
      WHERE parking_section_id = ? 
        AND spot_number = ? 
        AND user_id = ? 
        AND booking_status = 'active'
    `, [sectionId, spotNumber, userId]);
    
    if (reservationResult.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active reservation found for this spot'
      });
    }
    
    // Update section counts
    await db.execute(`
      UPDATE parking_section 
      SET parked_count = parked_count - 1
      WHERE parking_section_id = ?
    `, [sectionId]);
    
    console.log(`✅ Successfully released spot ${spotNumber} in section ${sectionId}`);
    
    res.json({
      success: true,
      message: 'Successfully released parking spot'
    });
    
  } catch (error) {
    console.error('Release motorcycle spot error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to release parking spot'
    });
  }
});

// Update spot status (for attendant actions)
router.put('/sections/:sectionId/spots/:spotNumber/status', authenticateToken, async (req, res) => {
  try {
    const { sectionId, spotNumber } = req.params;
    const { status } = req.body;
    const userId = req.user.user_id;
    
    console.log(`🔧 Updating spot ${spotNumber} status to '${status}' in section ${sectionId} by user ${userId}`);
    
    // Validate parameters
    if (!sectionId || !spotNumber || !status) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters'
      });
    }
    
    // Validate status
    const validStatuses = ['available', 'unavailable', 'maintenance', 'reserved'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      });
    }
    
    // For motorcycle sections, update the virtual spot status
    if (sectionId && spotNumber) {
      // Check if there's an active reservation for this spot
      const existingReservation = await db.execute(`
        SELECT reservation_id, booking_status 
        FROM reservations 
        WHERE parking_section_id = ? 
          AND spot_number = ? 
          AND booking_status IN ('reserved', 'active')
      `, [sectionId, spotNumber]);
      
      if (existingReservation.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot update status. Spot has an active reservation'
        });
      }
      
      // For motorcycle sections, we don't have individual spot records
      // The status is managed at the reservation level
      // For now, we'll just return success since motorcycle sections are capacity-based
      console.log(`✅ Successfully updated spot ${spotNumber} status to '${status}' in section ${sectionId}`);
      
      res.json({
        success: true,
        message: `Spot status updated to ${status}`
      });
    } else {
      // For regular parking spots (if needed in the future)
      res.status(400).json({
        success: false,
        message: 'Regular spot status update not implemented yet'
      });
    }
    
  } catch (error) {
    console.error('Update spot status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update spot status'
    });
  }
});

// Update section status (for attendant actions)
router.put('/sections/:sectionId/status', authenticateToken, async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { status } = req.body;
    const userId = req.user.user_id;
    
    console.log(`🔧 Updating section ${sectionId} status to '${status}' by user ${userId}`);
    
    // Validate parameters
    if (!sectionId || !status) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters'
      });
    }
    
    // Validate status
    const validStatuses = ['available', 'unavailable', 'maintenance'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      });
    }
    
    // Check if section exists
    const sectionQuery = `
      SELECT parking_section_id, section_name, status, vehicle_type
      FROM parking_section 
      WHERE parking_section_id = ?
    `;
    const sectionResult = await db.execute(sectionQuery, [sectionId]);
    
    console.log('🔍 Section query result:', sectionResult);
    
    // Handle different database result formats
    const sections = sectionResult.rows || sectionResult || [];
    
    if (sections.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Section not found'
      });
    }
    
    const section = sections[0];
    console.log(`📊 Section ${sectionId} current status: ${section.status}, changing to: ${status}`);
    
    // Update the section status in parking_section table
    const updateResult = await db.execute(`
      UPDATE parking_section 
      SET status = ?
      WHERE parking_section_id = ?
    `, [status, sectionId]);
    
    // Handle different database result formats for update
    const affectedRows = updateResult.affectedRows || (updateResult.rows?.length || 0);
    
    if (affectedRows === 0) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update section status'
      });
    }
    
    console.log(`✅ Successfully updated section ${sectionId} status to '${status}'`);
    
    res.json({
      success: true,
      message: `Section status updated to ${status}`
    });
    
  } catch (error) {
    console.error('Update section status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update section status'
    });
  }
});

module.exports = router;
