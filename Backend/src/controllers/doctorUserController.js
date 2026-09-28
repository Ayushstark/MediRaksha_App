import { pool } from '../config/db.js';

// GET /api/doctor/user/my — all patients registered to this doctor
export const getAllPatients = async (req, res) => {
  const doctorId = req.user.id;

  try {
    const { rows: patients } = await pool.query(
      `SELECT
        u.id, u.name, u.email, u.number, u.age, u.gender, u.created_at,
        COUNT(a.id) AS "totalAppointments",
        MAX(a."appointmentDate") AS "lastAppointmentDate"
       FROM "User" u
       LEFT JOIN "Appointment" a ON a."userId" = u.id AND a."doctorId" = $1
       WHERE u."registeredDoctorId" = $2
       GROUP BY u.id, u.name, u.email, u.number, u.age, u.gender, u.created_at
       ORDER BY u.name ASC`,
      [doctorId, doctorId]
    );

    res.status(200).json({ success: true, count: patients.length, data: patients });
  } catch (error) {
    console.error('getAllPatients error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/doctor/user/:id — single patient detail + their appointment history with this doctor
export const getPatientById = async (req, res) => {
  const doctorId = req.user.id;
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ success: false, message: 'Invalid patient ID' });
  }

  try {
    const { rows: users } = await pool.query(
      `SELECT id, name, email, number, age, gender, created_at
       FROM "User"
       WHERE id = $1 AND "registeredDoctorId" = $2`,
      [id, doctorId]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'Patient not found or not registered to you' });
    }

    const { rows: appointments } = await pool.query(
      `SELECT
        a.id AS "Id", a."appointmentDate", a."slotTime", a.status,
        a."reasonOfAppointment", a."created_at"
       FROM "Appointment" a
       WHERE a."userId" = $1 AND a."doctorId" = $2
       ORDER BY a."appointmentDate" DESC`,
      [id, doctorId]
    );

    res.status(200).json({
      success: true,
      data: {
        patient: users[0],
        appointmentHistory: appointments,
        totalAppointments: appointments.length,
      },
    });
  } catch (error) {
    console.error('getPatientById error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// DELETE /api/doctor/user/:id — remove patient registration from this doctor
export const removePatient = async (req, res) => {
  const doctorId = req.user.id;
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ success: false, message: 'Invalid patient ID' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: users } = await client.query(
      `SELECT "id", "registeredDoctorId" FROM "User" WHERE "id" = $1`,
      [id]
    );

    if (users.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    if (String(users[0].registeredDoctorId) !== String(doctorId)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'This patient is not registered to you' });
    }

    const { rows: activeAppointments } = await client.query(
      `SELECT id FROM "Appointment"
       WHERE "userId" = $1 AND "doctorId" = $2
       AND status IN ('pending', 'confirmed')
       AND "appointmentDate" >= CURRENT_DATE`,
      [id, doctorId]
    );

    if (activeAppointments.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: `Cannot remove patient. ${activeAppointments.length} upcoming appointment(s) still active.`,
        activeAppointments: activeAppointments.length,
      });
    }

    await client.query(
      `UPDATE "User" SET "registeredDoctorId" = NULL, "updated_at" = NOW() WHERE id = $1`,
      [id]
    );

    await client.query('COMMIT');
    res.status(200).json({ success: true, message: 'Patient removed from your profile successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('removePatient error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
  }
};
