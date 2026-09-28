import { pool } from '../../config/db.js';

// ── Constants ─────────────────────────────────────────────────────────────────

export const VALID_HOSPITAL_TYPES = new Set([
  'MULTISPECIALITY', 'GOVERNMENT', 'PRIVATE',
  'TRAUMA_CENTER', 'CARDIAC_CENTER', 'CHILDREN_HOSPITAL',
]);

export const VALID_FACILITY_TYPES = new Set([
  'ICU', 'VENTILATOR', 'TRAUMA_CENTER', 'CT_SCAN', 'MRI',
  'BLOOD_BANK', 'EMERGENCY_OT', 'CARDIOLOGY', 'NEUROLOGY',
  'ORTHOPEDICS', 'PEDIATRICS', 'MATERNITY', 'DIALYSIS',
  'ONCOLOGY', 'PHARMACY',
]);

// ── Internal audit helper ─────────────────────────────────────────────────────

const auditHospital = async (hospitalId, actorId, action, metadata = {}, client = null) => {
  const db = client || pool;
  await db.query(
    `INSERT INTO hospital_admin_audit_logs (hospital_id, actor_id, action, metadata)
     VALUES ($1, $2, $3, $4)`,
    [hospitalId, actorId ?? null, action, JSON.stringify(metadata)]
  );
};

// ── Hospital CRUD ─────────────────────────────────────────────────────────────

export const createHospital = async (data, actorId = null) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      hospital_name, hospital_type, address, city, state, country,
      pincode, latitude, longitude, phone, email, website,
      rating, reliability_score, is_active,
    } = data;

    const { rows: [newHosp] } = await client.query(
      `INSERT INTO hospitals
         (hospital_name, hospital_type, address, city, state, country,
          pincode, latitude, longitude, phone, email, website,
          rating, reliability_score, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING id, created_at`,
      [
        hospital_name, hospital_type,
        address ?? null, city ?? null, state ?? null, country ?? 'India', pincode ?? null,
        latitude, longitude,
        phone ?? null, email ?? null, website ?? null,
        rating ?? 0.00, reliability_score ?? 100.00, is_active !== false,
      ]
    );

    const hospitalCode = `HOSP-${String(newHosp.id).padStart(6, '0')}`;
    await client.query(
      `UPDATE hospitals SET hospital_code = $1 WHERE id = $2`,
      [hospitalCode, newHosp.id]
    );

    await auditHospital(newHosp.id, actorId, 'HOSPITAL_CREATED',
      { hospital_name, hospital_code: hospitalCode }, client);

    await client.query('COMMIT');
    return { id: newHosp.id, hospital_code: hospitalCode, created_at: newHosp.created_at };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const updateHospital = async (hospitalId, data, actorId = null) => {
  const MUTABLE = [
    'hospital_name', 'hospital_type', 'address', 'city', 'state',
    'country', 'pincode', 'latitude', 'longitude', 'phone', 'email',
    'website', 'rating', 'reliability_score', 'is_active',
  ];

  const sets   = [];
  const values = [];

  for (const field of MUTABLE) {
    if (data[field] !== undefined) {
      sets.push(`${field} = $${values.length + 1}`);
      values.push(data[field]);
    }
  }

  if (sets.length === 0) return null;

  sets.push('updated_at = CURRENT_TIMESTAMP');
  values.push(hospitalId);

  const { rows } = await pool.query(
    `UPDATE hospitals SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING id`,
    values
  );

  if (rows.length === 0) return null;

  await auditHospital(hospitalId, actorId, 'HOSPITAL_UPDATED',
    { updated_fields: MUTABLE.filter(f => data[f] !== undefined) });

  return rows[0];
};

export const getHospitalById = async (hospitalId) => {
  const { rows: [hospital] } = await pool.query(
    `SELECT id, hospital_code, hospital_name, hospital_type,
            address, city, state, country, pincode,
            latitude, longitude, phone, email, website,
            rating, reliability_score, is_active, created_at, updated_at
     FROM hospitals
     WHERE id = $1`,
    [hospitalId]
  );
  if (!hospital) return null;

  const [{ rows: facilities }, { rows: departments }, { rows: contacts }] = await Promise.all([
    pool.query(
      `SELECT id, facility_code, facility_name, facility_type, is_available, created_at
       FROM hospital_facilities WHERE hospital_id = $1 ORDER BY facility_type, facility_name`,
      [hospitalId]
    ),
    pool.query(
      `SELECT id, department_name, is_active FROM hospital_departments
       WHERE hospital_id = $1 AND is_active = TRUE ORDER BY department_name`,
      [hospitalId]
    ),
    pool.query(
      `SELECT id, contact_name, designation, phone, email
       FROM hospital_contacts WHERE hospital_id = $1`,
      [hospitalId]
    ),
  ]);

  return { ...hospital, facilities, departments, contacts };
};

// ── Facilities ────────────────────────────────────────────────────────────────

export const addFacility = async (hospitalId, facilityData) => {
  const { facility_code, facility_name, facility_type, is_available } = facilityData;
  const { rows } = await pool.query(
    `INSERT INTO hospital_facilities
       (hospital_id, facility_code, facility_name, facility_type, is_available)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (hospital_id, facility_code) DO UPDATE
       SET facility_name = EXCLUDED.facility_name,
           facility_type = EXCLUDED.facility_type,
           is_available  = EXCLUDED.is_available
     RETURNING id, facility_code, facility_name, facility_type, is_available, created_at`,
    [hospitalId, facility_code, facility_name, facility_type, is_available !== false]
  );
  return rows[0];
};

export const updateFacility = async (facilityId, hospitalId, isAvailable) => {
  const { rows } = await pool.query(
    `UPDATE hospital_facilities SET is_available = $1
     WHERE id = $2 AND hospital_id = $3
     RETURNING id, facility_code, facility_name, facility_type, is_available`,
    [isAvailable, facilityId, hospitalId]
  );
  return rows[0] ?? null;
};

export const getFacilities = async (hospitalId) => {
  const { rows } = await pool.query(
    `SELECT id, facility_code, facility_name, facility_type, is_available, created_at
     FROM hospital_facilities WHERE hospital_id = $1
     ORDER BY facility_type, facility_name`,
    [hospitalId]
  );
  return rows;
};

// ── Departments ───────────────────────────────────────────────────────────────

export const addDepartment = async (hospitalId, departmentName) => {
  const { rows } = await pool.query(
    `INSERT INTO hospital_departments (hospital_id, department_name, is_active)
     VALUES ($1, $2, TRUE)
     ON CONFLICT (hospital_id, department_name) DO UPDATE SET is_active = TRUE
     RETURNING id, department_name, is_active`,
    [hospitalId, departmentName]
  );
  return rows[0];
};

// ── Contacts ──────────────────────────────────────────────────────────────────

export const addContact = async (hospitalId, contactData) => {
  const { contact_name, designation, phone, email } = contactData;
  const { rows } = await pool.query(
    `INSERT INTO hospital_contacts (hospital_id, contact_name, designation, phone, email)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, contact_name, designation, phone, email`,
    [hospitalId, contact_name ?? null, designation ?? null, phone ?? null, email ?? null]
  );
  return rows[0];
};

// ── Hospital existence check ──────────────────────────────────────────────────

export const hospitalExists = async (hospitalId) => {
  const { rows } = await pool.query(
    'SELECT id FROM hospitals WHERE id = $1 AND is_active = TRUE',
    [hospitalId]
  );
  return rows.length > 0;
};
