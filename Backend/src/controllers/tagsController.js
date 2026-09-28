import { pool } from '../config/db.js';

const COLORS = ['indigo', 'emerald', 'violet', 'amber', 'rose', 'sky', 'teal', 'orange', 'pink', 'lime'];

export const getUserTags = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `SELECT t.id, t.name, t.color, COUNT(rta."reportId")::int as "usageCount"
       FROM "RecordTag" t
       LEFT JOIN "ReportTagAssignment" rta ON rta."tagId" = t.id
       WHERE t."userId" = $1
       GROUP BY t.id ORDER BY t.name ASC`,
      [userId]
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('getUserTags error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

export const createTag = async (req, res) => {
  try {
    const userId = req.user.id;
    let { name, color } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Tag name is required.' });
    name = name.trim().replace(/^#/, '');
    if (name.length > 50) return res.status(400).json({ success: false, message: 'Tag name too long.' });

    // Return existing tag if already exists (case-insensitive)
    const existing = await pool.query(
      `SELECT * FROM "RecordTag" WHERE "userId"=$1 AND LOWER("name")=LOWER($2)`,
      [userId, name]
    );
    if (existing.rows.length) return res.json({ success: true, data: existing.rows[0] });

    if (!color || !COLORS.includes(color)) {
      const countRes = await pool.query(`SELECT COUNT(*)::int as cnt FROM "RecordTag" WHERE "userId"=$1`, [userId]);
      color = COLORS[countRes.rows[0].cnt % COLORS.length];
    }

    const result = await pool.query(
      `INSERT INTO "RecordTag" ("userId","name","color") VALUES ($1,$2,$3) RETURNING *`,
      [userId, name, color]
    );
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('createTag error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

export const deleteTag = async (req, res) => {
  try {
    const userId = req.user.id;
    const { tagId } = req.params;
    await pool.query(`DELETE FROM "RecordTag" WHERE "id"=$1 AND "userId"=$2`, [tagId, userId]);
    return res.json({ success: true });
  } catch (err) {
    console.error('deleteTag error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

export const addTagToRecord = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id, tagId } = req.params;
    const [recCheck, tagCheck] = await Promise.all([
      pool.query(`SELECT id FROM "Report" WHERE "id"=$1 AND "userId"=$2`, [id, userId]),
      pool.query(`SELECT id FROM "RecordTag" WHERE "id"=$1 AND "userId"=$2`, [tagId, userId]),
    ]);
    if (!recCheck.rows.length || !tagCheck.rows.length) {
      return res.status(404).json({ success: false, message: 'Record or tag not found.' });
    }
    await pool.query(
      `INSERT INTO "ReportTagAssignment" ("reportId","tagId") VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [id, tagId]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('addTagToRecord error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

export const removeTagFromRecord = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id, tagId } = req.params;
    const check = await pool.query(`SELECT id FROM "Report" WHERE "id"=$1 AND "userId"=$2`, [id, userId]);
    if (!check.rows.length) return res.status(404).json({ success: false, message: 'Record not found.' });
    await pool.query(`DELETE FROM "ReportTagAssignment" WHERE "reportId"=$1 AND "tagId"=$2`, [id, tagId]);
    return res.json({ success: true });
  } catch (err) {
    console.error('removeTagFromRecord error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};
