import { pool } from '../config/db.js';

const PREFIX_MAP = { prescription: 'PRES', lab: 'LAB', scan: 'IMG', discharge: 'DIS', other: 'REC' };
const TAG_COLORS = ['indigo', 'emerald', 'violet', 'amber', 'rose', 'sky', 'teal', 'orange', 'pink', 'lime'];
const ALLOWED_VIS = new Set(['private', 'shared', 'emergency']);

const generateRecordId = async (category) => {
  const result = await pool.query(`SELECT COUNT(*) as cnt FROM "Report" WHERE "category" = $1`, [category]);
  const nextNum = parseInt(result.rows[0].cnt) + 1;
  const prefix = PREFIX_MAP[category] || 'REC';
  return `${prefix}-${String(nextNum).padStart(5, '0')}`;
};

const RECORD_COLUMNS = `
  r."id", r."recordId", r."userId", r."title", r."category", r."doctorName",
  r."specialization", r."hospital", r."visitDate", r."notes", r."visibility",
  r."originalFileName", r."mimeType", r."fileSize", r."created_at", r."updated_at",
  r."isImportant", r."isArchived", r."isPinned",
  COALESCE(
    (SELECT COUNT(*) FROM "ReportConnection" rc
     WHERE rc."sourceReportId" = r.id OR rc."targetReportId" = r.id),
  0) as "connectionCount",
  COALESCE(
    (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color) ORDER BY t.name)
     FROM "ReportTagAssignment" rta
     JOIN "RecordTag" t ON t.id = rta."tagId"
     WHERE rta."reportId" = r.id),
    '[]'::json
  ) as "tags",
  COALESCE(
    (SELECT json_agg(json_build_object('id', c.id, 'name', c.name) ORDER BY c.name)
     FROM "CollectionRecord" cr
     JOIN "Collection" c ON c.id = cr."collectionId"
     WHERE cr."reportId" = r.id),
    '[]'::json
  ) as "collections"
`;

const logActivity = async (reportId, userId, action, detail = null) => {
  try {
    await pool.query(
      `INSERT INTO "RecordActivity" ("reportId","userId","action","detail","createdAt") VALUES ($1,$2,$3,$4,NOW())`,
      [reportId, userId, action, detail]
    );
  } catch (e) { console.warn('Activity log failed:', e.message); }
};

const assignTags = async (reportId, userId, tagNames) => {
  for (let i = 0; i < tagNames.length; i++) {
    const name = String(tagNames[i]).replace(/^#/, '').trim();
    if (!name) continue;
    const color = TAG_COLORS[i % TAG_COLORS.length];
    let tagRes = await pool.query(
      `SELECT id FROM "RecordTag" WHERE "userId"=$1 AND LOWER("name")=LOWER($2)`,
      [userId, name]
    );
    if (!tagRes.rows.length) {
      tagRes = await pool.query(
        `INSERT INTO "RecordTag" ("userId","name","color") VALUES ($1,$2,$3) RETURNING id`,
        [userId, name, color]
      );
    }
    await pool.query(
      `INSERT INTO "ReportTagAssignment" ("reportId","tagId") VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [reportId, tagRes.rows[0].id]
    );
  }
};

export const getAllRecords = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `SELECT ${RECORD_COLUMNS} FROM "Report" r WHERE r."userId" = $1
       ORDER BY r."isPinned" DESC, r."created_at" DESC`,
      [userId]
    );
    return res.json({ success: true, count: result.rowCount, data: result.rows });
  } catch (err) {
    console.error('getAllRecords error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

export const getRecordById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const result = await pool.query(
      `SELECT ${RECORD_COLUMNS}, r."fileData" FROM "Report" r WHERE r."id" = $1 AND r."userId" = $2`,
      [id, userId]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Record not found.' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('getRecordById error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

export const createRecord = async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, category = 'other', doctorName, specialization, hospital, visitDate, notes, visibility = 'private', doctorId } = req.body;
    let tags = [];
    try { tags = req.body.tags ? JSON.parse(req.body.tags) : []; } catch {}

    if (!title?.trim()) return res.status(400).json({ success: false, message: 'Title is required.' });

    const ALLOWED_CAT = new Set(['lab', 'prescription', 'scan', 'discharge', 'other']);
    if (!ALLOWED_CAT.has(category)) return res.status(400).json({ success: false, message: 'Invalid category.' });

    const finalVis = ALLOWED_VIS.has(visibility) ? visibility : 'private';

    let fileData = null, mimeType = null, originalFileName = null, fileSize = null;
    if (req.file) {
      fileData = req.file.buffer.toString('base64');
      mimeType = req.file.mimetype;
      originalFileName = req.file.originalname;
      fileSize = req.file.size;
    }

    const recordId = await generateRecordId(category);

    const result = await pool.query(
      `INSERT INTO "Report" (
        "userId","recordId","title","category","doctorName","specialization",
        "hospital","visitDate","notes","visibility","doctorId",
        "fileData","mimeType","originalFileName","fileSize","uploadedBy",
        "isImportant","isArchived","isPinned","created_at","updated_at"
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,FALSE,FALSE,FALSE,NOW(),NOW())
      RETURNING "id","recordId"`,
      [userId, recordId, title.trim(), category,
        doctorName || null, specialization || null, hospital || null,
        visitDate || null, notes || null, finalVis,
        doctorId || null, fileData, mimeType, originalFileName, fileSize, 'user']
    );

    const newId = result.rows[0].id;
    await logActivity(newId, userId, 'Created', `${recordId} — ${title.trim()}`);

    if (Array.isArray(tags) && tags.length > 0) {
      await assignTags(newId, userId, tags);
    }

    const fullRes = await pool.query(
      `SELECT ${RECORD_COLUMNS} FROM "Report" r WHERE r."id"=$1`, [newId]
    );
    return res.status(201).json({ success: true, data: fullRes.rows[0] });
  } catch (err) {
    console.error('createRecord error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

export const updateRecord = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const body = req.body;

    const fields = [];
    const params = [id, userId];
    let idx = 3;

    const set = (col, val) => { fields.push(`"${col}" = $${idx++}`); params.push(val); };

    if ('title' in body && body.title?.trim()) set('title', body.title.trim());
    if ('doctorName' in body) set('doctorName', body.doctorName || null);
    if ('specialization' in body) set('specialization', body.specialization || null);
    if ('hospital' in body) set('hospital', body.hospital || null);
    if ('visitDate' in body) set('visitDate', body.visitDate || null);
    if ('notes' in body) set('notes', body.notes || null);
    if ('visibility' in body && ALLOWED_VIS.has(body.visibility)) set('visibility', body.visibility);

    if (fields.length === 0) return res.status(400).json({ success: false, message: 'No fields to update.' });

    fields.push('"updated_at" = NOW()');

    const result = await pool.query(
      `UPDATE "Report" SET ${fields.join(', ')}
       WHERE "id" = $1 AND "userId" = $2
       RETURNING "id","recordId","title","category","doctorName","specialization",
                 "hospital","visitDate","notes","visibility","originalFileName",
                 "mimeType","fileSize","created_at","updated_at","isImportant","isArchived","isPinned"`,
      params
    );

    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Record not found.' });
    await logActivity(id, userId, 'Updated details');
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('updateRecord error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

export const deleteRecord = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM "Report" WHERE "id" = $1 AND "userId" = $2 RETURNING id`,
      [id, userId]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Record not found.' });
    return res.json({ success: true, message: 'Record deleted.' });
  } catch (err) {
    console.error('deleteRecord error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

export const toggleArchive = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE "Report" SET "isArchived" = NOT "isArchived", "updated_at" = NOW()
       WHERE "id" = $1 AND "userId" = $2 RETURNING "isArchived","recordId"`,
      [id, userId]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Record not found.' });
    const { isArchived, recordId } = result.rows[0];
    await logActivity(id, userId, isArchived ? 'Archived' : 'Unarchived', recordId);
    return res.json({ success: true, isArchived });
  } catch (err) {
    console.error('toggleArchive error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

export const toggleImportant = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE "Report" SET "isImportant" = NOT "isImportant", "updated_at" = NOW()
       WHERE "id" = $1 AND "userId" = $2 RETURNING "isImportant","recordId"`,
      [id, userId]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Record not found.' });
    const { isImportant, recordId } = result.rows[0];
    await logActivity(id, userId, isImportant ? 'Marked as Important' : 'Unmarked as Important', recordId);
    return res.json({ success: true, isImportant });
  } catch (err) {
    console.error('toggleImportant error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

export const togglePin = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE "Report" SET "isPinned" = NOT "isPinned", "updated_at" = NOW()
       WHERE "id" = $1 AND "userId" = $2 RETURNING "isPinned","recordId"`,
      [id, userId]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Record not found.' });
    const { isPinned, recordId } = result.rows[0];
    await logActivity(id, userId, isPinned ? 'Pinned' : 'Unpinned', recordId);
    return res.json({ success: true, isPinned });
  } catch (err) {
    console.error('togglePin error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

export const duplicateRecord = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const src = await pool.query(`SELECT * FROM "Report" WHERE "id" = $1 AND "userId" = $2`, [id, userId]);
    if (!src.rows.length) return res.status(404).json({ success: false, message: 'Record not found.' });

    const s = src.rows[0];
    const newRecordId = await generateRecordId(s.category);

    const result = await pool.query(
      `INSERT INTO "Report" (
        "userId","recordId","title","category","doctorName","specialization",
        "hospital","visitDate","notes","visibility",
        "fileData","mimeType","originalFileName","fileSize","uploadedBy",
        "isImportant","isArchived","isPinned","created_at","updated_at"
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'user',FALSE,FALSE,FALSE,NOW(),NOW())
      RETURNING "id","recordId"`,
      [userId, newRecordId, `${s.title} (Copy)`, s.category, s.doctorName, s.specialization,
        s.hospital, s.visitDate, s.notes, s.visibility,
        s.fileData, s.mimeType, s.originalFileName, s.fileSize]
    );

    const newId = result.rows[0].id;
    await logActivity(newId, userId, 'Created', `Duplicated from ${s.recordId}`);

    // Copy tags
    const srcTags = await pool.query(`SELECT "tagId" FROM "ReportTagAssignment" WHERE "reportId"=$1`, [id]);
    for (const row of srcTags.rows) {
      await pool.query(
        `INSERT INTO "ReportTagAssignment" ("reportId","tagId") VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [newId, row.tagId]
      );
    }

    const fullRes = await pool.query(`SELECT ${RECORD_COLUMNS} FROM "Report" r WHERE r."id"=$1`, [newId]);
    return res.status(201).json({ success: true, data: fullRes.rows[0] });
  } catch (err) {
    console.error('duplicateRecord error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

export const getActivity = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const check = await pool.query(`SELECT id FROM "Report" WHERE "id"=$1 AND "userId"=$2`, [id, userId]);
    if (!check.rows.length) return res.status(404).json({ success: false, message: 'Record not found.' });
    const result = await pool.query(
      `SELECT "id","action","detail","createdAt" FROM "RecordActivity"
       WHERE "reportId" = $1 ORDER BY "createdAt" DESC LIMIT 20`,
      [id]
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('getActivity error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

export const searchRecords = async (req, res) => {
  try {
    const userId = req.user.id;
    const { q = '', excludeId } = req.query;
    const search = `%${q.toLowerCase()}%`;
    const result = await pool.query(
      `SELECT "id","recordId","title","category","doctorName","visitDate","created_at",
              "isImportant","isArchived","isPinned"
       FROM "Report"
       WHERE "userId" = $1 AND "id" != $2 AND "isArchived" = FALSE
         AND (
           LOWER("recordId") LIKE $3 OR LOWER("title") LIKE $3 OR
           LOWER(COALESCE("doctorName",'')) LIKE $3 OR
           LOWER(COALESCE("notes",'')) LIKE $3 OR
           EXISTS (
             SELECT 1 FROM "ReportTagAssignment" rta
             JOIN "RecordTag" t ON t.id = rta."tagId"
             WHERE rta."reportId" = "Report".id AND LOWER(t.name) LIKE $3
           )
         )
       ORDER BY "created_at" DESC LIMIT 20`,
      [userId, excludeId || 0, search]
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('searchRecords error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

export const getConnections = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const result = await pool.query(
      `SELECT r."id",r."recordId",r."title",r."category",r."doctorName",r."visitDate",r."created_at"
       FROM "Report" r
       WHERE r."userId" = $2 AND r."id" IN (
         SELECT "targetReportId" FROM "ReportConnection" WHERE "sourceReportId" = $1
         UNION
         SELECT "sourceReportId" FROM "ReportConnection" WHERE "targetReportId" = $1
       )`,
      [id, userId]
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('getConnections error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

export const addConnection = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id, targetId } = req.params;
    const check = await pool.query(
      `SELECT id,"recordId" FROM "Report" WHERE "id" = ANY($1::int[]) AND "userId" = $2`,
      [[id, targetId], userId]
    );
    if (check.rowCount !== 2) return res.status(404).json({ success: false, message: 'One or both records not found.' });
    await pool.query(
      `INSERT INTO "ReportConnection" ("sourceReportId","targetReportId") VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [id, targetId]
    );
    const targetRecord = check.rows.find(r => String(r.id) === String(targetId));
    await logActivity(id, userId, 'Linked', targetRecord?.recordId);
    await logActivity(targetId, userId, 'Linked', check.rows.find(r => String(r.id) === String(id))?.recordId);
    return res.json({ success: true, message: 'Connection added.' });
  } catch (err) {
    console.error('addConnection error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

export const removeConnection = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id, targetId } = req.params;
    const check = await pool.query(
      `SELECT id,"recordId" FROM "Report" WHERE "id" = ANY($1::int[]) AND "userId" = $2`,
      [[id, targetId], userId]
    );
    if (check.rowCount !== 2) return res.status(404).json({ success: false, message: 'Not authorized.' });
    await pool.query(
      `DELETE FROM "ReportConnection"
       WHERE ("sourceReportId"=$1 AND "targetReportId"=$2) OR ("sourceReportId"=$2 AND "targetReportId"=$1)`,
      [id, targetId]
    );
    const targetRecord = check.rows.find(r => String(r.id) === String(targetId));
    await logActivity(id, userId, 'Unlinked', targetRecord?.recordId);
    return res.json({ success: true, message: 'Connection removed.' });
  } catch (err) {
    console.error('removeConnection error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

export const getPatientSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(`SELECT * FROM "PatientSummary" WHERE "userId" = $1`, [userId]);
    return res.json({ success: true, data: result.rows[0] || null });
  } catch (err) {
    console.error('getPatientSummary error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

export const upsertPatientSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bloodGroup, knownConditions, allergies, emergencyContact, healthRemarks } = req.body;
    const result = await pool.query(
      `INSERT INTO "PatientSummary" ("userId","bloodGroup","knownConditions","allergies","emergencyContact","healthRemarks","updated_at")
       VALUES ($1,$2,$3,$4,$5,$6,NOW())
       ON CONFLICT ("userId") DO UPDATE SET
         "bloodGroup"=EXCLUDED."bloodGroup","knownConditions"=EXCLUDED."knownConditions",
         "allergies"=EXCLUDED."allergies","emergencyContact"=EXCLUDED."emergencyContact",
         "healthRemarks"=EXCLUDED."healthRemarks","updated_at"=NOW()
       RETURNING *`,
      [userId, bloodGroup || null, knownConditions || null, allergies || null, emergencyContact || null, healthRemarks || null]
    );
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('upsertPatientSummary error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};
