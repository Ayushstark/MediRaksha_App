import { pool } from '../config/db.js';

export const getCollections = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `SELECT
         c.*,
         COUNT(cr."reportId")::int as "recordCount",
         COUNT(CASE WHEN r.category = 'prescription' THEN 1 END)::int as "prescriptionCount",
         COUNT(CASE WHEN r.category = 'lab' THEN 1 END)::int as "labCount",
         COUNT(CASE WHEN r.category = 'scan' THEN 1 END)::int as "scanCount",
         COUNT(CASE WHEN r."isImportant" = true THEN 1 END)::int as "importantCount",
         COALESCE(
           (SELECT json_agg(sub.row_data)
            FROM (
              SELECT json_build_object(
                'category', r2.category,
                'title', r2.title,
                'visitDate', r2."visitDate"
              ) as row_data
              FROM "Report" r2
              JOIN "CollectionRecord" cr2 ON cr2."reportId" = r2.id
              WHERE cr2."collectionId" = c.id
              ORDER BY COALESCE(r2."visitDate", r2."created_at") DESC
              LIMIT 3
            ) sub),
           '[]'::json
         ) as "recentRecords"
       FROM "Collection" c
       LEFT JOIN "CollectionRecord" cr ON cr."collectionId" = c.id
       LEFT JOIN "Report" r ON r.id = cr."reportId"
       WHERE c."userId" = $1
       GROUP BY c.id ORDER BY c."updated_at" DESC`,
      [userId]
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('getCollections error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

export const createCollection = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Collection name is required.' });
    const result = await pool.query(
      `INSERT INTO "Collection" ("userId","name","description","created_at","updated_at")
       VALUES ($1,$2,$3,NOW(),NOW()) RETURNING *`,
      [userId, name.trim(), description?.trim() || null]
    );
    return res.status(201).json({ success: true, data: { ...result.rows[0], recordCount: 0 } });
  } catch (err) {
    console.error('createCollection error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

export const updateCollection = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, description } = req.body;
    const result = await pool.query(
      `UPDATE "Collection" SET
        "name" = COALESCE(NULLIF(TRIM($3),''), "name"),
        "description" = $4, "updated_at" = NOW()
       WHERE "id"=$1 AND "userId"=$2 RETURNING *`,
      [id, userId, name || '', description?.trim() || null]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Collection not found.' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('updateCollection error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

export const deleteCollection = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM "Collection" WHERE "id"=$1 AND "userId"=$2 RETURNING id`,
      [id, userId]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Collection not found.' });
    return res.json({ success: true });
  } catch (err) {
    console.error('deleteCollection error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

export const getCollectionDetail = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const [colRes, recRes] = await Promise.all([
      pool.query(`SELECT * FROM "Collection" WHERE "id"=$1 AND "userId"=$2`, [id, userId]),
      pool.query(
        `SELECT r."id",r."recordId",r."title",r."category",r."doctorName",
                r."specialization",r."hospital",r."visitDate",
                r."created_at",r."isImportant",r."isPinned",r."originalFileName",r."mimeType",
                cr."addedAt",
                COALESCE(
                  (SELECT COUNT(*) FROM "ReportConnection" rc
                   WHERE rc."sourceReportId" = r.id OR rc."targetReportId" = r.id),
                0)::int as "connectionCount",
                COALESCE(
                  (SELECT json_agg(
                     json_build_object('id', t.id, 'name', t.name, 'color', t.color)
                     ORDER BY t.name
                   )
                   FROM "ReportTagAssignment" rta
                   JOIN "RecordTag" t ON t.id = rta."tagId"
                   WHERE rta."reportId" = r.id),
                  '[]'::json
                ) as "tags"
         FROM "Report" r
         JOIN "CollectionRecord" cr ON cr."reportId" = r.id
         WHERE cr."collectionId" = $1 AND r."userId" = $2
         ORDER BY r."visitDate" DESC NULLS LAST, r."created_at" DESC`,
        [id, userId]
      ),
    ]);
    if (!colRes.rows.length) return res.status(404).json({ success: false, message: 'Collection not found.' });
    return res.json({ success: true, data: { ...colRes.rows[0], records: recRes.rows } });
  } catch (err) {
    console.error('getCollectionDetail error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

export const addRecordToCollection = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id, recordId } = req.params;
    const [colCheck, recCheck] = await Promise.all([
      pool.query(`SELECT id FROM "Collection" WHERE "id"=$1 AND "userId"=$2`, [id, userId]),
      pool.query(`SELECT id FROM "Report" WHERE "id"=$1 AND "userId"=$2`, [recordId, userId]),
    ]);
    if (!colCheck.rows.length || !recCheck.rows.length) {
      return res.status(404).json({ success: false, message: 'Collection or record not found.' });
    }
    await pool.query(
      `INSERT INTO "CollectionRecord" ("collectionId","reportId") VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [id, recordId]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('addRecordToCollection error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

export const removeRecordFromCollection = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id, recordId } = req.params;
    const check = await pool.query(`SELECT id FROM "Collection" WHERE "id"=$1 AND "userId"=$2`, [id, userId]);
    if (!check.rows.length) return res.status(404).json({ success: false, message: 'Collection not found.' });
    await pool.query(`DELETE FROM "CollectionRecord" WHERE "collectionId"=$1 AND "reportId"=$2`, [id, recordId]);
    return res.json({ success: true });
  } catch (err) {
    console.error('removeRecordFromCollection error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

export const getRecordCollections = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const check = await pool.query(`SELECT id FROM "Report" WHERE "id"=$1 AND "userId"=$2`, [id, userId]);
    if (!check.rows.length) return res.status(404).json({ success: false, message: 'Record not found.' });
    const result = await pool.query(
      `SELECT c.id, c.name, c.description FROM "Collection" c
       JOIN "CollectionRecord" cr ON cr."collectionId" = c.id
       WHERE cr."reportId" = $1 AND c."userId" = $2 ORDER BY c.name`,
      [id, userId]
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('getRecordCollections error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};
