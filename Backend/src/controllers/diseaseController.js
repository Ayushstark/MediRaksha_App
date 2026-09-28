import { pool } from '../config/db.js';

export const getDiseases = async (req, res) => {
  try {
    const response = await pool.query('SELECT * FROM "Disease"');
    const diseases = response.rows;
    res.json({ success: true, data: diseases });
  } catch (err) {
    console.error('Error fetching diseases:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const getDiseaseById = async (req, res) => {
  try {
    const { id } = req.params;
    const response = await pool.query('SELECT * FROM "Disease" WHERE id = $1', [id]);
    const disease = response.rows[0];

    if (!disease) {
      return res.status(404).json({ success: false, error: 'Disease not found' });
    }

    res.json({ success: true, data: disease });
  } catch (err) {
    console.error('Error fetching disease:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
