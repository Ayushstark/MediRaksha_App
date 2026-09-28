import { pool } from '../config/db.js';

// --- Messaging Handlers ---
export const getMessages = async (req, res) => {
  const userId = String(req.user.id);
  const otherId = req.query.otherId ? String(req.query.otherId) : null;

  try {
    let query = `
      SELECT * FROM messages 
      WHERE sender_id = $1 OR receiver_id = $1 
      ORDER BY created_at ASC
    `;
    let params = [userId];

    if (otherId) {
      query = `
        SELECT * FROM messages 
        WHERE (sender_id = $1 AND receiver_id = $2)
           OR (sender_id = $2 AND receiver_id = $1)
        ORDER BY created_at ASC
      `;
      params = [userId, otherId];
    }

    const { rows } = await pool.query(query, params);
    const formatted = rows.map((r) => ({
      ...r,
      _id: String(r.id),
      senderId: String(r.sender_id),
      receiverId: String(r.receiver_id),
      createdAt: r.created_at,
    }));

    return res.json({ success: true, data: formatted });
  } catch (err) {
    console.error('getMessages error:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving messages' });
  }
};

export const sendMessage = async (req, res) => {
  const senderId = String(req.user.id);
  const receiverId = String(req.body.receiverId || '').trim();
  const content = String(req.body.content || '').trim();

  if (!content) {
    return res.status(400).json({ success: false, message: 'Message content is required' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, content) VALUES ($1, $2, $3) RETURNING *`,
      [senderId, receiverId || null, content]
    );

    const row = rows[0];
    return res.status(201).json({
      success: true,
      data: {
        ...row,
        _id: String(row.id),
        senderId: String(row.sender_id),
        receiverId: row.receiver_id,
        createdAt: row.created_at,
      },
    });
  } catch (err) {
    console.error('sendMessage error:', err);
    return res.status(500).json({ success: false, message: 'Server error sending message' });
  }
};

export const uploadChatFile = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'File is required' });
  }
  const fileUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  return res.json({ success: true, fileUrl });
};

// --- Activities Handlers ---
export const createActivity = async (req, res) => {
  const userId = String(req.user.id);
  const description = String(req.body.description || '').trim();

  if (!description) {
    return res.status(400).json({ success: false, message: 'Description is required' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO activities (user_id, description) VALUES ($1, $2) RETURNING *`,
      [userId, description]
    );

    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('createActivity error:', err);
    return res.status(500).json({ success: false, message: 'Server error creating activity' });
  }
};

export const getActivities = async (req, res) => {
  const userId = String(req.user.id);

  try {
    const { rows } = await pool.query(
      `SELECT * FROM activities WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getActivities error:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving activities' });
  }
};

export const deleteActivity = async (req, res) => {
  const userId = String(req.user.id);
  const { id } = req.params;

  try {
    await pool.query(`DELETE FROM activities WHERE id = $1 AND user_id = $2`, [id, userId]);
    return res.json({ success: true, message: 'Activity deleted' });
  } catch (err) {
    console.error('deleteActivity error:', err);
    return res.status(500).json({ success: false, message: 'Server error deleting activity' });
  }
};

// --- Diagnoses Handlers ---
export const createDiagnosis = async (req, res) => {
  const userId = String(req.user.id);
  const symptoms = String(req.body.symptoms || '').trim();

  if (!symptoms) {
    return res.status(400).json({ success: false, message: 'Symptoms are required' });
  }

  let result = {
    condition: 'Assessment recorded',
    severity: 'Mild',
    advice: 'Rest, hydrate, and schedule an appointment with a clinician if symptoms persist.',
    specialist: 'General Physician',
  };

  try {
    const { rows } = await pool.query(
      `INSERT INTO diagnoses (user_id, symptoms, result) VALUES ($1, $2, $3) RETURNING id, created_at`,
      [userId, symptoms, JSON.stringify(result)]
    );

    return res.status(201).json({
      success: true,
      data: {
        id: rows[0].id,
        symptoms,
        ...result,
        createdAt: rows[0].created_at,
      },
    });
  } catch (err) {
    console.error('createDiagnosis error:', err);
    return res.status(500).json({ success: false, message: 'Server error saving diagnosis' });
  }
};

export const getDiagnoses = async (req, res) => {
  const userId = String(req.user.id);

  try {
    const { rows } = await pool.query(
      `SELECT id, symptoms, result, created_at FROM diagnoses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [userId]
    );

    const formatted = rows.map((r) => ({
      id: r.id,
      symptoms: r.symptoms,
      ...(typeof r.result === 'object' ? r.result : JSON.parse(r.result || '{}')),
      createdAt: r.created_at,
    }));

    return res.json({ success: true, data: formatted });
  } catch (err) {
    console.error('getDiagnoses error:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving diagnoses' });
  }
};
