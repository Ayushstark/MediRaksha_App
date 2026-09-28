import { pool } from '../config/db.js';

const VALID_APPOINTMENT_STATUSES = new Set(['pending', 'confirmed', 'cancelled', 'completed']);
const REPORT_METADATA_COLUMNS = `
  r."id", r."userId", r."uploadedBy", r."doctorId", r."title", r."category",
  r."fileSize", r."mimeType", r."visibility", r."originalFileName",
  r."created_at", r."updated_at"
`;

// GET /api/doctor/meetings/all
export const getAllMeetings = async (req, res) => {
  const doctorId = req.user.id;
  const { status, date } = req.query; // optional filters ?status=pending&date=2026-06-01

  if (status && !VALID_APPOINTMENT_STATUSES.has(status)) {
    return res.status(400).json({ success: false, message: 'Invalid appointment status' });
  }

  try {
    let query = `
      SELECT
        a.id AS "Id", TO_CHAR(a."appointmentDate", 'YYYY-MM-DD') AS "appointmentDate", a."slotTime", a.status, a."reasonOfAppointment",
        a."created_at",
        u.id AS "patientId", u.name AS "patientName", u.email AS "patientEmail",
        u.number AS "patientContact", u.age AS "patientAge", u.gender AS "patientGender",
        TO_CHAR(s."bookingDate", 'YYYY-MM-DD') AS "bookingDate", s.status AS "slotStatus"
      FROM "Appointment" a
      JOIN "User" u ON a."userId" = u.id
      JOIN "Slot" s ON a."slotId" = s.id
      WHERE a."doctorId" = $1`;

    const params = [doctorId];
    let paramIndex = 2;

    if (status) {
      query += ` AND a.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    if (date) {
      query += ` AND a."appointmentDate" = $${paramIndex}`;
      params.push(date);
      paramIndex++;
    }

    query += ` ORDER BY a."appointmentDate" ASC, a."slotTime" ASC`;

    const { rows: appointments } = await pool.query(query, params);

    res.status(200).json({ success: true, count: appointments.length, data: appointments });
  } catch (error) {
    console.error('getAllMeetings error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/doctor/meetings/:id
export const getMeetingById = async (req, res) => {
  const doctorId = req.user.id;
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ success: false, message: 'Invalid appointment ID' });
  }

  try {
    const { rows: appointments } = await pool.query(
      `SELECT
        a.id AS "Id", TO_CHAR(a."appointmentDate", 'YYYY-MM-DD') AS "appointmentDate", a."slotTime", a.status, a."reasonOfAppointment",
        a."requestGroupId", a."created_at", a."updated_at",
        u.id AS "patientId", u.name AS "patientName", u.email AS "patientEmail",
        u.number AS "patientContact", u.age AS "patientAge", u.gender AS "patientGender",
        s.id AS "slotId", TO_CHAR(s."bookingDate", 'YYYY-MM-DD') AS "bookingDate", s.status AS "slotStatus"
       FROM "Appointment" a
       JOIN "User" u ON a."userId" = u.id
       JOIN "Slot" s ON a."slotId" = s.id
       WHERE a.id = $1 AND a."doctorId" = $2`,
      [id, doctorId]
    );

    if (appointments.length === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    res.status(200).json({ success: true, data: appointments[0] });
  } catch (error) {
    console.error('getMeetingById error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// DELETE /api/doctor/meetings/:id  — doctor denies/cancels an appointment
export const deleteMeeting = async (req, res) => {
  const doctorId = req.user.id;
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ success: false, message: 'Invalid appointment ID' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: appointments } = await client.query(
      `SELECT id, "slotId", status, "userId" FROM "Appointment"
       WHERE id = $1 AND "doctorId" = $2
       FOR UPDATE`,
      [id, doctorId]
    );

    if (appointments.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    const targetAppointment = appointments[0];

    if (targetAppointment.status === 'completed') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Cannot deny a completed appointment' });
    }

    if (targetAppointment.status === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Appointment is already cancelled' });
    }

    await client.query(
      `UPDATE "Appointment" SET status = 'cancelled', "updated_at" = NOW() WHERE id = $1`,
      [id]
    );

    await client.query(
      `UPDATE "Slot" SET status = 'available', "userId" = NULL, "updated_at" = NOW() WHERE id = $1`,
      [targetAppointment.slotId]
    );

    await client.query('COMMIT');

    res.status(200).json({ success: true, message: 'Appointment denied and slot released successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('deleteMeeting (doctor) error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
  }
};

export const confirmMeeting = async (req, res) => {
  const doctorId = req.user.id;
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `UPDATE "Appointment"
       SET status = 'confirmed', "updated_at" = NOW()
       WHERE id = $1 AND "doctorId" = $2 AND status = 'pending'
       RETURNING id`,
      [id, doctorId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pending appointment not found.' });
    }

    return res.status(200).json({ success: true, message: 'Appointment confirmed.' });
  } catch (error) {
    console.error('confirmMeeting error:', error);
    return res.status(500).json({ success: false, message: 'Unable to confirm appointment.' });
  }
};

export const completeMeeting = async (req, res) => {
  const doctorId = req.user.id;
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows: appointments } = await client.query(
      `SELECT id, "userId", status FROM "Appointment"
       WHERE id = $1 AND "doctorId" = $2
       FOR UPDATE`,
      [id, doctorId]
    );

    if (appointments.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    const appointment = appointments[0];
    if (appointment.status === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Cancelled appointments cannot be completed.' });
    }

    await client.query(
      `UPDATE "Appointment" SET status = 'completed', "updated_at" = NOW() WHERE id = $1`,
      [id]
    );

    const { rowCount: deletedReports } = await client.query(
      `DELETE FROM "Report"
       WHERE "userId" = $1
         AND visibility = 'doctor'
         AND ("doctorId" IS NULL OR "doctorId" = $2)`,
      [appointment.userId, doctorId]
    );

    await client.query('COMMIT');
    return res.status(200).json({
      success: true,
      message: 'Appointment completed. Shared reports were removed.',
      deletedReports
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('completeMeeting error:', error);
    return res.status(500).json({ success: false, message: 'Unable to complete appointment.' });
  } finally {
    client.release();
  }
};

export const getMeetingReports = async (req, res) => {
  const doctorId = req.user.id;
  const { id } = req.params;

  try {
    const { rows: appointments } = await pool.query(
      `SELECT "userId" FROM "Appointment" WHERE id = $1 AND "doctorId" = $2`,
      [id, doctorId]
    );

    if (appointments.length === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    const { rows: reports } = await pool.query(
      `SELECT ${REPORT_METADATA_COLUMNS}
       FROM "Report" r
       WHERE r."userId" = $1
         AND r.visibility = 'doctor'
         AND (r."doctorId" IS NULL OR r."doctorId" = $2)
       ORDER BY r."created_at" DESC`,
      [appointments[0].userId, doctorId]
    );

    return res.status(200).json({ success: true, count: reports.length, data: reports });
  } catch (error) {
    console.error('getMeetingReports error:', error);
    return res.status(500).json({ success: false, message: 'Unable to load appointment reports.' });
  }
};

export const getMeetingReportById = async (req, res) => {
  const doctorId = req.user.id;
  const { id, reportId } = req.params;

  try {
    const { rows: appointments } = await pool.query(
      `SELECT "userId" FROM "Appointment" WHERE id = $1 AND "doctorId" = $2`,
      [id, doctorId]
    );

    if (appointments.length === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    const { rows: reports } = await pool.query(
      `SELECT ${REPORT_METADATA_COLUMNS}, r."fileData"
       FROM "Report" r
       WHERE r.id = $1
         AND r."userId" = $2
         AND r.visibility = 'doctor'
         AND (r."doctorId" IS NULL OR r."doctorId" = $3)`,
      [reportId, appointments[0].userId, doctorId]
    );

    if (reports.length === 0) {
      return res.status(404).json({ success: false, message: 'Report not found or not shared with this doctor.' });
    }

    return res.status(200).json({ success: true, data: reports[0] });
  } catch (error) {
    console.error('getMeetingReportById error:', error);
    return res.status(500).json({ success: false, message: 'Unable to load report preview.' });
  }
};
