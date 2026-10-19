import { pool } from '../config/db.js';

export const getDiseases = async (req, res) => {
  try {
    const { q, query: searchQuery, category } = req.query;
    const term = (q || searchQuery || '').trim();

    let sql = 'SELECT * FROM "Disease" WHERE 1=1';
    const params = [];

    if (category && category !== 'All') {
      params.push(category);
      sql += ` AND category = $${params.length}`;
    }

    if (term) {
      params.push(`%${term}%`);
      const pIdx = params.length;
      sql += ` AND (
        name ILIKE $${pIdx} OR
        common_name ILIKE $${pIdx} OR
        symtom ILIKE $${pIdx} OR
        solution ILIKE $${pIdx} OR
        transmission ILIKE $${pIdx} OR
        description ILIKE $${pIdx} OR
        category ILIKE $${pIdx}
      )`;
    }

    sql += ' ORDER BY name ASC';

    const response = await pool.query(sql, params);
    const diseases = response.rows;
    res.json({ success: true, count: diseases.length, data: diseases });
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
