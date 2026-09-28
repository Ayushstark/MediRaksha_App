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

// GET /api/user/doctor/search/:name
export const getDoctorByName = async (req, res) => {
  const { name } = req.params;

  if (!name || name.trim().length < 2) {
    return res.status(400).json({ success: false, message: 'Name must be at least 2 characters' });
  }

  try {
    // FIX 1: { rows } destructuring
    // FIX 3: Was LIKE ? (MySQL) — pg uses ILIKE $1 for case-insensitive matching
    const { rows: doctors } = await pool.query(
      `SELECT id, name, email, number, age, gender, hospital, speciality
       FROM "Doctor"
       WHERE name ILIKE $1
       ORDER BY name ASC`,
      [`%${name.trim()}%`]
    );

    // Empty result is valid (no match) — 200 with empty array, not 404
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

  // FIX 4: isNaN(doctorId) always returns false for UUID strings since they're
  //         non-numeric — this guard blocked every request with a UUID doctor id.
  //         Removed: let the DB query fail naturally if the id is malformed,
  //         or validate as UUID if your schema uses UUIDs.
  if (!doctorId) {
    return res.status(400).json({ success: false, message: 'Doctor ID is required' });
  }

  try {
    // FIX 1 & 2: { rows } + WHERE id (lowercase)
    const { rows: doctors } = await pool.query(
      `SELECT id, name, email, number, age, gender, hospital, speciality, created_at
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