import { pool } from '../config/db.js';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp'
]);

const ALLOWED_CATEGORIES = new Set(['lab', 'prescription', 'scan', 'other']);
const ALLOWED_VISIBILITIES = new Set(['private', 'doctor']);

const PREFIX_MAP = { prescription: 'PRES', lab: 'LAB', scan: 'IMG', discharge: 'DIS', other: 'REC' };

const generateRecordId = async (category) => {
  const result = await pool.query(`SELECT COUNT(*) as cnt FROM "Report" WHERE "category" = $1`, [category]);
  const nextNum = parseInt(result.rows[0].cnt) + 1;
  const prefix = PREFIX_MAP[category] || 'REC';
  return `${prefix}-${String(nextNum).padStart(5, '0')}`;
};
const REPORT_METADATA_COLUMNS = `
  "id", "userId", "uploadedBy", "doctorId", "title", "category",
  "fileSize", "mimeType", "visibility", "originalFileName",
  "created_at", "updated_at"
`;

const isReportStorageSchemaError = (error) => error.code === '42703' || error.code === '22P02';

const sendReportStorageSchemaError = (res) => res.status(500).json({
  success: false,
  message: 'Report storage columns are not ready for file data. Run the Report table migration.'
});

/**
 * @route   POST /api/user/report/upload
 * @desc    Upload a new medical report (Converts file buffer to Base64 and saves to DB)
 */
export const uploadReport = async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, category = 'lab', visibility = 'private', doctorId, uploadedBy } = req.body;

    // 1. Validate that the file was caught by Multer memory storage
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: 'Title is required.' });
    }

    if (!ALLOWED_MIME_TYPES.has(req.file.mimetype)) {
      return res.status(400).json({ success: false, message: 'Only PDF and image files are allowed.' });
    }

    if (!ALLOWED_CATEGORIES.has(category)) {
      return res.status(400).json({ success: false, message: 'Invalid report category.' });
    }

    if (!ALLOWED_VISIBILITIES.has(visibility)) {
      return res.status(400).json({ success: false, message: 'Invalid report visibility.' });
    }

    const originalFileName = req.file.originalname;
    const fileSize = req.file.size;
    const mimeType = req.file.mimetype;

    // Convert the binary RAM buffer into a text-safe value for storage in PostgreSQL.
    const fileData = req.file.buffer.toString('base64');

    const recordId = await generateRecordId(category);

    // 2. Insert into the database
    const query = `
      INSERT INTO "Report"
      ("userId", "uploadedBy", "doctorId", "recordId", "title", "category", "fileSize", "fileData", "mimeType", "visibility", "originalFileName", "created_at", "updated_at")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING ${REPORT_METADATA_COLUMNS};
    `;

    const values = [
      userId,
      uploadedBy || 'user',
      doctorId || null,
      recordId,
      title.trim(),
      category,
      fileSize,
      fileData,
      mimeType,
      visibility,
      originalFileName
    ];

    const result = await pool.query(query, values);

    return res.status(201).json({
      success: true,
      message: 'Report uploaded and saved successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error uploading report:', error);
    if (isReportStorageSchemaError(error)) {
      return sendReportStorageSchemaError(res);
    }
    return res.status(500).json({ success: false, message: 'Server error during upload.' });
  }
};

/**
 * @route   GET /api/user/report/all
 * @desc    Get all reports for the logged-in user
 */
export const getAllReports = async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT
        ${REPORT_METADATA_COLUMNS}
      FROM "Report"
      WHERE "userId" = $1
      ORDER BY "created_at" DESC;
    `;
    const result = await pool.query(query, [userId]);

    return res.status(200).json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    if (isReportStorageSchemaError(error)) {
      return sendReportStorageSchemaError(res);
    }
    return res.status(500).json({ success: false, message: 'Server error fetching reports.' });
  }
};

/**
 * @route   GET /api/user/report/:id
 * @desc    Get a specific report by ID (restricted to the owner)
 */
export const getReportById = async (req, res) => {
  try {
    const userId = req.user.id;
    const reportId = req.params.id;

    const query = `SELECT ${REPORT_METADATA_COLUMNS}, "fileData" FROM "Report" WHERE "id" = $1 AND "userId" = $2;`;
    const result = await pool.query(query, [reportId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Report not found or unauthorized access.' });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching report:', error);
    if (isReportStorageSchemaError(error)) {
      return sendReportStorageSchemaError(res);
    }
    return res.status(500).json({ success: false, message: 'Server error fetching report.' });
  }
};

/**
 * @route   DELETE /api/user/report/:id
 * @desc    Delete a report by ID (restricted to the owner)
 */
export const deleteReport = async (req, res) => {
  try {
    const userId = req.user.id;
    const reportId = req.params.id;

    const query = `DELETE FROM "Report" WHERE "id" = $1 AND "userId" = $2 RETURNING *;`;
    const result = await pool.query(query, [reportId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Report not found or unauthorized action.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Report deleted successfully',
      deletedReportId: reportId
    });
  } catch (error) {
    console.error('Error deleting report:', error);
    return res.status(500).json({ success: false, message: 'Server error deleting account.' });
  }
};
