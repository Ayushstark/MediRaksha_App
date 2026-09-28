import { pool } from '../config/db.js';

// Reusing your metadata-only strategy to keep performance high
const REPORT_METADATA_COLUMNS = `
  "id", "userId", "uploadedBy", "doctorId", "title", "category",
  "fileSize", "mimeType", "visibility", "originalFileName",
  "created_at", "updated_at"
`;

/**
 * @route   GET /api/doctor/reports
 * @desc    Get all patient reports shared with the logged-in doctor
 */
export async function getUserReport(req, res) {
  try {
    // Assuming req.user is populated by your auth middleware
    const doctorId = req.user.id; 

    // Query filters:
    // 1. The report must be explicitly assigned to this doctorId
    // 2. The patient must have set the visibility to 'doctor'
    const query = `
      SELECT 
        ${REPORT_METADATA_COLUMNS}
      FROM "Report"
      WHERE "doctorId" = $1 
        AND "visibility" = 'doctor'
      ORDER BY "created_at" DESC;
    `;

    const result = await pool.query(query, [doctorId]);

    return res.status(200).json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });

  } catch (err) {
    console.error("Error in getUserReport:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server Error fetching doctor accessible reports." 
    });
  }
}