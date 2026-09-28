import { pool } from '../config/db.js';
import bcrypt from 'bcryptjs';
import { validatePassword } from '../utils/security.js';

// GET /api/doctor/info/detail
export const getDoctorDetail = async (req, res) => {
  const doctorId = req.user.id;

  try {
    // PostgreSQL uses .query() which returns an object containing a 'rows' array
    const result = await pool.query(
      `SELECT "id", "name", "email", "number", "age", "gender", "hospital", "speciality", "created_at", "updated_at"
       FROM "Doctor"
       WHERE "id" = $1`,
      [doctorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('getDoctorDetail error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// PATCH /api/doctor/info/update
// Body: any subset of { name, number, age, gender, hospital, speciality, password }
export const updateDoctorDetail = async (req, res) => {
  const doctorId = req.user.id;
  const { name, number, age, gender, hospital, speciality, password } = req.body;

  const allowedFields = { name, number, age, gender, hospital, speciality };
  const updates = {};

  // Only include fields that were actually sent
  for (const [key, value] of Object.entries(allowedFields)) {
    if (value !== undefined && value !== null && value !== '') {
      updates[key] = value;
    }
  }

  // Handle password separately — hash before storing
  if (password) {
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.isValid) {
      return res.status(400).json({ success: false, message: passwordCheck.message });
    }
    updates.password = await bcrypt.hash(password, 10);
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, message: 'No valid fields provided to update' });
  }

  try {
    const values = [];
    const assignments = [];
    let paramIndex = 1;

    // Dynamically build the assignment structure ($1, $2, etc.) for PostgreSQL
    for (const [key, value] of Object.entries(updates)) {
      assignments.push(`"${key}" = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }

    // Add doctorId as the final variable constraint
    values.push(doctorId);
    const whereClauseIndex = paramIndex; 

    await pool.query(
      `UPDATE "Doctor" 
       SET ${assignments.join(', ')}, "updated_at" = NOW() 
       WHERE "id" = $${whereClauseIndex}`,
      values
    );

    // Return fresh record (exclude password)
    const result = await pool.query(
      `SELECT "id", "name", "email", "number", "age", "gender", "hospital", "speciality", "updated_at"
       FROM "Doctor" WHERE "id" = $1`,
      [doctorId]
    );

    res.status(200).json({ success: true, message: 'Profile updated successfully', data: result.rows[0] });
  } catch (error) {
    console.error('updateDoctorDetail error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// DELETE /api/doctor/info/delete
export const deleteDoctorAccount = async (req, res) => {
  const doctorId = req.user.id;

  // For modern 'pg' pools, transaction controls are handled via client checkouts
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Block deletion if active upcoming appointments exist (Fixed CURDATE() to CURRENT_DATE)
    const active = await client.query(
      `SELECT "id" FROM "Appointments"
       WHERE "doctorId" = $1 AND "status" IN ('pending', 'confirmed')
       AND "appointmentDate" >= CURRENT_DATE`,
      [doctorId]
    );

    if (active.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: `Cannot delete account. ${active.rows.length} upcoming appointment(s) still pending. Resolve them first.`,
      });
    }

    // Detach any users who had this doctor registered
    await client.query(
      `UPDATE "User" SET "registeredDoctorId" = NULL WHERE "registeredDoctorId" = $1`,
      [doctorId]
    );

    // Free all slots
    await client.query(`DELETE FROM "Slots" WHERE "doctorId" = $1`, [doctorId]);

    // Delete all appointments (historical)
    await client.query(`DELETE FROM "Appointments" WHERE "doctorId" = $1`, [doctorId]);

    // Delete doctor
    await client.query(`DELETE FROM "Doctor" WHERE "id" = $1`, [doctorId]);

    await client.query('COMMIT');

    res.clearCookie('token');
    res.status(200).json({ success: true, message: 'Doctor account deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('deleteDoctorAccount error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
  }
};