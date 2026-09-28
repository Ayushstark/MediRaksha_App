import { pool } from '../config/db.js';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png'
]);

const REPORT_SELECT_COLUMNS = `
  "id",
  "appointmentId" AS "appointment_id",
  "fileName" AS "file_name",
  "fileUrl" AS "file_url",
  "fileSize" AS "file_size",
  "mimeType" AS "mime_type",
  "uploaded_at"
`;

const buildFileUrl = (req, appointmentId, reportId) => (
  `${req.protocol}://${req.get('host')}/api/user/meetings/${appointmentId}/reports/${reportId}`
);

const buildDoctorFileUrl = (req, appointmentId, reportId) => (
  `${req.protocol}://${req.get('host')}/api/doctor/meetings/${appointmentId}/reports/${reportId}`
);

const ensurePatientAppointment = async (appointmentId, userId) => {
  const { rows } = await pool.query(
    `SELECT id, status FROM "Appointment" WHERE id = $1 AND "userId" = $2`,
    [appointmentId, userId]
  );

  return rows[0] || null;
};

const ensureDoctorAppointment = async (appointmentId, doctorId) => {
  const { rows } = await pool.query(
    `SELECT id FROM "Appointment" WHERE id = $1 AND "doctorId" = $2`,
    [appointmentId, doctorId]
  );

  return rows[0] || null;
};

export const uploadAppointmentReports = async (req, res) => {
  const userId = req.user.id;
  const { id: appointmentId } = req.params;
  const files = req.files || [];

  if (files.length === 0) {
    return res.status(400).json({ success: false, message: 'No report files uploaded.' });
  }

  try {
    const appointment = await ensurePatientAppointment(appointmentId, userId);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    if (appointment.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Cannot upload reports after appointment is completed.' });
    }

    const invalidFile = files.find((file) => !ALLOWED_MIME_TYPES.has(file.mimetype));
    if (invalidFile) {
      return res.status(400).json({ success: false, message: 'Only PDF, JPG, and PNG files are allowed.' });
    }

    const insertedReports = [];
    for (const file of files) {
      const { rows } = await pool.query(
        `INSERT INTO "AppointmentReport"
         ("appointmentId", "userId", "fileName", "fileUrl", "fileData", "fileSize", "mimeType", "uploaded_at")
         VALUES ($1, $2, $3, '', $4, $5, $6, NOW())
         RETURNING ${REPORT_SELECT_COLUMNS}`,
        [
          appointmentId,
          userId,
          file.originalname,
          file.buffer.toString('base64'),
          file.size,
          file.mimetype
        ]
      );

      const report = rows[0];
      const fileUrl = buildFileUrl(req, appointmentId, report.id);
      await pool.query(
        `UPDATE "AppointmentReport" SET "fileUrl" = $1 WHERE id = $2`,
        [fileUrl, report.id]
      );

      insertedReports.push({ ...report, file_url: fileUrl });
    }

    return res.status(201).json({
      success: true,
      message: 'Report uploaded successfully',
      data: insertedReports
    });
  } catch (error) {
    console.error('uploadAppointmentReports error:', error);
    return res.status(500).json({ success: false, message: 'Unable to upload appointment reports.' });
  }
};

export const getUserAppointmentReports = async (req, res) => {
  const userId = req.user.id;
  const { id: appointmentId } = req.params;

  try {
    const appointment = await ensurePatientAppointment(appointmentId, userId);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    const { rows } = await pool.query(
      `SELECT ${REPORT_SELECT_COLUMNS}
       FROM "AppointmentReport" ar
       WHERE ar."appointmentId" = $1 AND ar."userId" = $2
       ORDER BY ar."uploaded_at" DESC`,
      [appointmentId, userId]
    );

    const reports = rows.map((report) => ({
      ...report,
      file_url: buildFileUrl(req, appointmentId, report.id)
    }));

    return res.status(200).json({ success: true, count: reports.length, data: reports });
  } catch (error) {
    console.error('getUserAppointmentReports error:', error);
    return res.status(500).json({ success: false, message: 'Unable to load appointment reports.' });
  }
};

export const getUserAppointmentReportById = async (req, res) => {
  const userId = req.user.id;
  const { id: appointmentId, reportId } = req.params;

  try {
    const appointment = await ensurePatientAppointment(appointmentId, userId);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    const { rows } = await pool.query(
      `SELECT ${REPORT_SELECT_COLUMNS}, ar."fileData" AS "file_data"
       FROM "AppointmentReport" ar
       WHERE ar.id = $1 AND ar."appointmentId" = $2 AND ar."userId" = $3`,
      [reportId, appointmentId, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...rows[0],
        file_url: buildFileUrl(req, appointmentId, rows[0].id)
      }
    });
  } catch (error) {
    console.error('getUserAppointmentReportById error:', error);
    return res.status(500).json({ success: false, message: 'Unable to load appointment report.' });
  }
};

export const getDoctorAppointmentReports = async (req, res) => {
  const doctorId = req.user.id;
  const { id: appointmentId } = req.params;

  try {
    const appointment = await ensureDoctorAppointment(appointmentId, doctorId);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    const { rows } = await pool.query(
      `SELECT ${REPORT_SELECT_COLUMNS}
       FROM "AppointmentReport" ar
       WHERE ar."appointmentId" = $1
       ORDER BY ar."uploaded_at" DESC`,
      [appointmentId]
    );

    const reports = rows.map((report) => ({
      ...report,
      file_url: buildDoctorFileUrl(req, appointmentId, report.id)
    }));

    return res.status(200).json({ success: true, count: reports.length, data: reports });
  } catch (error) {
    console.error('getDoctorAppointmentReports error:', error);
    return res.status(500).json({ success: false, message: 'Unable to load appointment reports.' });
  }
};

export const getDoctorAppointmentReportById = async (req, res) => {
  const doctorId = req.user.id;
  const { id: appointmentId, reportId } = req.params;

  try {
    const appointment = await ensureDoctorAppointment(appointmentId, doctorId);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    const { rows } = await pool.query(
      `SELECT ${REPORT_SELECT_COLUMNS}, ar."fileData" AS "file_data"
       FROM "AppointmentReport" ar
       WHERE ar.id = $1 AND ar."appointmentId" = $2`,
      [reportId, appointmentId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Report not found for this appointment.' });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...rows[0],
        file_url: buildDoctorFileUrl(req, appointmentId, rows[0].id)
      }
    });
  } catch (error) {
    console.error('getDoctorAppointmentReportById error:', error);
    return res.status(500).json({ success: false, message: 'Unable to load appointment report.' });
  }
};
