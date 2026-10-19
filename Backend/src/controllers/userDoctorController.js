import { pool } from '../config/db.js';

// GET /api/user/doctor/my
export const getMyDoctor = async (req, res) => {
  const userId = req.user.id;

  try {
    // FIX 1: pg returns { rows } not [rows]
    const { rows: users } = await pool.query(
      `SELECT "registeredDoctorId" FROM "User" WHERE id = $1`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!users[0].registeredDoctorId) {
      return res.status(404).json({ success: false, message: 'No doctor registered yet' });
    }

    // FIX 2: Was WHERE Id = $1 — wrong casing; pg column is "id"
    const { rows: doctors } = await pool.query(
      `SELECT id, name, email, number, age, gender, hospital, speciality, created_at
       FROM "Doctor"
       WHERE id = $1`,
      [users[0].registeredDoctorId]
    );

    if (doctors.length === 0) {
      return res.status(404).json({ success: false, message: 'Registered doctor no longer exists' });
    }

    res.status(200).json({ success: true, data: doctors[0] });
  } catch (error) {
    console.error('getMyDoctor error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/user/doctor/all
export const getAllDoctors = async (req, res) => {
  try {
    const { q, query: term, specialty, hospital, lat, lon, latitude, longitude, radius, nearby } = req.query;
    const search = (q || term || '').trim();
    const userLat = parseFloat(lat ?? latitude);
    const userLon = parseFloat(lon ?? longitude);
    const hasLocation = Number.isFinite(userLat) && Number.isFinite(userLon);
    const searchRadius = parseFloat(radius) || null; // in km

    let sql = `
      SELECT d.id, d.name, d.email, d.number, d.age, d.gender, d.hospital, d.speciality, d.created_at,
             d.latitude, d.longitude, d.address, d.experience, d.rating,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', s.id,
                   '_id', s.id,
                   'bookingDate', TO_CHAR(s."bookingDate", 'YYYY-MM-DD'),
                   'date', TO_CHAR(s."bookingDate", 'YYYY-MM-DD'),
                   'slotTime', TO_CHAR(s."slotTime", 'HH24:MI'),
                   'time', TO_CHAR(s."slotTime", 'HH24:MI'),
                   'status', s.status
                 ) ORDER BY s."bookingDate" ASC, s."slotTime" ASC
               ) FILTER (WHERE s.id IS NOT NULL AND s.status = 'available' AND (s."bookingDate" > CURRENT_DATE OR (s."bookingDate" = CURRENT_DATE AND s."slotTime" >= CURRENT_TIME))),
               '[]'
             ) AS "availableSlots"
      FROM "Doctor" d
      LEFT JOIN "Slot" s ON d.id = s."doctorId"
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      const pIdx = params.length;
      sql += ` AND (d.name ILIKE $${pIdx} OR d.hospital ILIKE $${pIdx} OR d.speciality ILIKE $${pIdx} OR COALESCE(d.address, '') ILIKE $${pIdx})`;
    }

    if (specialty && specialty !== 'All') {
      params.push(`%${specialty.trim()}%`);
      sql += ` AND d.speciality ILIKE $${params.length}`;
    }

    if (hospital) {
      params.push(`%${hospital.trim()}%`);
      sql += ` AND d.hospital ILIKE $${params.length}`;
    }

    sql += ` GROUP BY d.id ORDER BY d.name ASC`;

    const { rows: doctors } = await pool.query(sql, params);

    // Calculate distance and sort if user coordinates are provided
    const haversineKm = (lat1, lon1, lat2, lon2) => {
      const R = 6371; // Earth radius in km
      const toRad = deg => (deg * Math.PI) / 180;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(a));
    };

    let processedDoctors = doctors.map(doc => {
      const docLat = parseFloat(doc.latitude);
      const docLon = parseFloat(doc.longitude);
      let distance = null;
      if (hasLocation && Number.isFinite(docLat) && Number.isFinite(docLon)) {
        distance = parseFloat(haversineKm(userLat, userLon, docLat, docLon).toFixed(2));
      }
      return {
        ...doc,
        distance,
      };
    });

    if (hasLocation && (nearby === 'true' || searchRadius)) {
      if (searchRadius) {
        processedDoctors = processedDoctors.filter(d => d.distance === null || d.distance <= searchRadius);
      }
      processedDoctors.sort((a, b) => {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
    }

    res.status(200).json({ success: true, count: processedDoctors.length, data: processedDoctors });
  } catch (error) {
    console.error('getAllDoctors error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/user/doctor/search/:name
export const getDoctorByName = async (req, res) => {
  const { name } = req.params;

  if (!name || name.trim().length < 2) {
    return res.status(400).json({ success: false, message: 'Name must be at least 2 characters' });
  }

  try {
    const { rows: doctors } = await pool.query(
      `SELECT id, name, email, number, age, gender, hospital, speciality, latitude, longitude, address, experience, rating
       FROM "Doctor"
       WHERE name ILIKE $1 OR hospital ILIKE $1 OR speciality ILIKE $1 OR COALESCE(address, '') ILIKE $1
       ORDER BY name ASC`,
      [`%${name.trim()}%`]
    );

    res.status(200).json({ success: true, count: doctors.length, data: doctors });
  } catch (error) {
    console.error('getDoctorByName error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/user/doctor/:doctorId
export const getDoctorById = async (req, res) => {
  const userId = req.user.id;
  const { doctorId } = req.params;

  if (!doctorId) {
    return res.status(400).json({ success: false, message: 'Doctor ID is required' });
  }

  try {
    const { rows: doctors } = await pool.query(
      `SELECT id, name, email, number, age, gender, hospital, speciality, latitude, longitude, address, experience, rating, created_at
       FROM "Doctor"
       WHERE id = $1`,
      [doctorId]
    );

    if (doctors.length === 0) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    const { rows: users } = await pool.query(
      `SELECT "registeredDoctorId" FROM "User" WHERE id = $1`,
      [userId]
    );

    let registered = false;
    let message = 'Doctor fetched successfully';

    if (!users[0].registeredDoctorId) {
      await pool.query(
        `UPDATE "User" SET "registeredDoctorId" = $1, "updated_at" = NOW() WHERE id = $2`,
        [doctorId, userId]
      );
      registered = true;
      message = 'Doctor fetched and registered to your account';
    // FIX 7: Was parseInt(doctorId) — breaks with UUIDs (parseInt of UUID = NaN).
    //         Compare as strings directly; both are the same type from the DB.
    } else if (String(users[0].registeredDoctorId) === String(doctorId)) {
      registered = true;
      message = 'Doctor fetched (already your registered doctor)';
    }

    res.status(200).json({
      success: true,
      message,
      isRegisteredToYou: registered,
      data: doctors[0]
    });
  } catch (error) {
    console.error('getDoctorById error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// DELETE /api/user/doctor/:doctorId
export const removeRegisteredDoctor = async (req, res) => {
  const userId = req.user.id;
  const { doctorId } = req.params;

  // FIX 4: Same isNaN issue — removed for UUID compatibility
  if (!doctorId) {
    return res.status(400).json({ success: false, message: 'Doctor ID is required' });
  }

  try {
    // FIX 1: { rows } destructuring
    const { rows: users } = await pool.query(
      `SELECT "registeredDoctorId" FROM "User" WHERE id = $1`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!users[0].registeredDoctorId) {
      return res.status(400).json({ success: false, message: 'No doctor is currently registered' });
    }

    // FIX 7: String comparison instead of parseInt
    if (String(users[0].registeredDoctorId) !== String(doctorId)) {
      return res.status(403).json({ success: false, message: 'This doctor is not registered to your account' });
    }

    // FIX 5: CURDATE() is MySQL — pg uses CURRENT_DATE
    const { rows: activeAppointments } = await pool.query(
      `SELECT id FROM "Appointment"
       WHERE "userId" = $1 AND "doctorId" = $2
         AND status IN ('pending', 'confirmed')
         AND "appointmentDate" >= CURRENT_DATE`,
      [userId, doctorId]
    );

    if (activeAppointments.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot remove doctor. You have ${activeAppointments.length} upcoming appointment(s). Cancel them first.`,
        activeAppointments: activeAppointments.length
      });
    }

    // FIX 6: Was UPDATE User SET — missing quotes; pg needs "User" for case-sensitive table name
    await pool.query(
      `UPDATE "User" SET "registeredDoctorId" = NULL, "updated_at" = NOW() WHERE id = $1`,
      [userId]
    );

    res.status(200).json({ success: true, message: 'Doctor removed from your profile successfully' });
  } catch (error) {
    console.error('removeRegisteredDoctor error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};