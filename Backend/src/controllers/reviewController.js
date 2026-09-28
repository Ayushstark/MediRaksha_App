import { pool } from '../config/db.js';

const ensureTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "Reviews" (
      "id" SERIAL PRIMARY KEY,
      "entityType" VARCHAR(20) NOT NULL CHECK ("entityType" IN ('hospital','doctor')),
      "entityId"   INTEGER,
      "rating"     SMALLINT NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
      "reviewText" TEXT,
      "authorName" VARCHAR(120) NOT NULL DEFAULT 'Anonymous',
      "userId"     INTEGER,
      "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

export const createReview = async (req, res) => {
  const { entityType, entityId, rating, reviewText, authorName } = req.body;
  await ensureTable();

  if (!entityType || !entityId || !rating || rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, message: 'entityType, entityId and rating (1-5) are required.' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO "Reviews" ("entityType","entityId","rating","reviewText","authorName","userId","created_at")
       VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING *`,
      [entityType, entityId, rating, reviewText || null, authorName || 'Anonymous', req.user?.id || null]
    );
    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('createReview error:', err);
    return res.status(500).json({ success: false, message: 'Unable to create review.' });
  }
};

export const getReviews = async (req, res) => {
  const { type, entityId } = req.query;
  await ensureTable();

  if (!type || !entityId) {
    return res.status(400).json({ success: false, message: 'type and entityId query params are required.' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT * FROM "Reviews" WHERE "entityType"=$1 AND "entityId"=$2 ORDER BY "created_at" DESC`,
      [type, entityId]
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('getReviews error:', err);
    return res.status(500).json({ success: false, message: 'Unable to get reviews.' });
  }
};
