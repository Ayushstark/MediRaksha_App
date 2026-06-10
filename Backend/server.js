const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET;

if (!process.env.DB_URL) throw new Error('DB_URL is required in Backend/.env');
if (!JWT_SECRET) throw new Error('JWT_SECRET is required in Backend/.env');

const dbUrl = new URL(process.env.DB_URL);
const sslMode = dbUrl.searchParams.get('sslmode');
const shouldUseSsl = sslMode && sslMode !== 'disable';

const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: shouldUseSsl ? { rejectUnauthorized: sslMode !== 'no-verify' } : false,
});
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(cors({ origin: process.env.FRONTEND_URL || true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

const q = (text, params) => pool.query(text, params);
const data = (value) => ({ data: value });
const id = (row) => String(row.id);
const apiError = (res, status, message) => res.status(status).json({ detail: message, message, msg: message });
const roleName = (role) => role === 'doctor' ? 'Doctor' : 'Patient';
const userDto = (row) => ({
  id: id(row), _id: id(row), name: row.name, email: row.email, number: row.phone,
  phoneNumber: row.phone, age: row.age, gender: row.gender, role: roleName(row.role),
  hospital: row.hospital, speciality: row.speciality, specialization: row.speciality,
  doctorId: row.role === 'doctor' ? id(row) : undefined, createdAt: row.created_at,
});
const slotDto = (row) => ({
  id: id(row), _id: id(row), doctorId: String(row.doctor_id), bookingDate: row.booking_date,
  date: row.booking_date, slotTime: row.slot_time, time: String(row.slot_time).slice(0, 5), status: row.status,
});
const appointmentDto = (row) => ({
  id: id(row), _id: id(row), Id: id(row), patientId: String(row.patient_id),
  doctorId: String(row.doctor_id), slotId: String(row.slot_id), appointmentDate: row.appointment_date,
  slotTime: String(row.slot_time).slice(0, 5), doctorName: row.doctor_name,
  speciality: row.speciality, hospitalName: row.hospital_name, patientName: row.patient_name,
  patientContact: row.patient_contact, patientAge: row.patient_age, patientGender: row.patient_gender,
  patientEmail: row.patient_email, reasonOfAppointment: row.reason, status: row.status,
  patient: {
    id: row.patient_id ? String(row.patient_id) : undefined, name: row.patient_name, age: row.patient_age,
    gender: row.patient_gender, email: row.patient_email, phoneNumber: row.patient_contact,
  },
  latestReports: row.latest_reports || [],
});
const reportDto = (row, includeFile = false) => ({
  id: id(row), _id: id(row), reportId: id(row), userId: String(row.user_id), patientId: String(row.user_id),
  title: row.title, category: row.category, visibility: row.visibility, originalFileName: row.original_file_name,
  fileName: row.original_file_name, mimeType: row.mime_type, fileSize: Number(row.file_size || 0),
  uploadedBy: row.uploaded_by, created_at: row.created_at, updated_at: row.updated_at,
  createdAt: row.created_at, updatedAt: row.updated_at,
  ...(includeFile ? { fileData: row.file_data?.toString('base64') } : {}),
});
const bookingDto = (row) => ({
  id: id(row), _id: id(row), hospitalId: String(row.hospital_id), wardId: String(row.ward_id),
  patientId: String(row.patient_id), patientName: row.patient_name, patientContact: row.patient_contact,
  reason: row.reason, expectedArrival: row.expected_arrival, status: row.status,
  holdExpiresAt: row.hold_expires_at, createdAt: row.created_at, hospitalName: row.hospital_name,
  wardLabel: row.ward_label, wardType: row.ward_type,
});
const activityDto = (row) => ({
  id: id(row), _id: id(row), description: row.description, createdAt: row.created_at,
});
const hospitalDto = (row) => ({
  id: id(row), _id: id(row), place_id: row.geoapify_place_id, geoapifyPlaceId: row.geoapify_place_id,
  name: row.name, address: row.address, latitude: Number(row.latitude), longitude: Number(row.longitude),
  phone: row.phone, amenities: row.amenities, isPartner: row.is_partner, speciality: row.speciality || 'General',
  emergency: row.emergency || false, distance: row.distance == null ? undefined : Number(row.distance),
  availableBeds: Number(row.available_beds || 0), updatedAt: row.updated_at,
});

function auth(requiredRole) {
  return (req, res, next) => {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return apiError(res, 401, 'Authentication required');
    try {
      req.auth = jwt.verify(token, JWT_SECRET);
      if (requiredRole && req.auth.role !== requiredRole) return apiError(res, 403, `${roleName(requiredRole)} access required`);
      next();
    } catch {
      return apiError(res, 401, 'Invalid or expired token');
    }
  };
}

async function initDatabase() {
  await q(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
  await q(`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, email text UNIQUE NOT NULL,
      password_hash text NOT NULL, role text NOT NULL CHECK (role IN ('patient','doctor')),
      phone text, age integer, gender text, hospital text, speciality text, created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS hospitals (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, geoapify_place_id text UNIQUE,
      address text, latitude double precision DEFAULT 0, longitude double precision DEFAULT 0,
      phone text, speciality text DEFAULT 'General', emergency boolean DEFAULT false,
      amenities jsonb DEFAULT '["beds","rooms","oxygen"]', is_partner boolean DEFAULT true,
      updated_at timestamptz DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS hospital_wards (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), hospital_id uuid REFERENCES hospitals(id) ON DELETE CASCADE,
      ward_type text NOT NULL DEFAULT 'general', label text NOT NULL DEFAULT 'General Beds',
      total_beds integer NOT NULL DEFAULT 0, reserved_beds integer NOT NULL DEFAULT 0,
      UNIQUE(hospital_id, ward_type)
    );
    CREATE TABLE IF NOT EXISTS slots (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), doctor_id uuid REFERENCES users(id) ON DELETE CASCADE,
      booking_date date NOT NULL, slot_time time NOT NULL, status text NOT NULL DEFAULT 'available',
      created_at timestamptz DEFAULT now(), UNIQUE(doctor_id, booking_date, slot_time)
    );
    CREATE TABLE IF NOT EXISTS appointments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), patient_id uuid REFERENCES users(id), doctor_id uuid REFERENCES users(id),
      slot_id uuid REFERENCES slots(id), appointment_date date NOT NULL, slot_time time NOT NULL,
      reason text, status text NOT NULL DEFAULT 'confirmed', created_at timestamptz DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS reports (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users(id) ON DELETE CASCADE,
      title text NOT NULL, category text, visibility text DEFAULT 'private', original_file_name text,
      mime_type text, file_size bigint DEFAULT 0, file_data bytea, uploaded_by text DEFAULT 'Patient',
      status text DEFAULT 'active', created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS bed_bookings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), hospital_id uuid REFERENCES hospitals(id), ward_id uuid REFERENCES hospital_wards(id),
      patient_id uuid REFERENCES users(id), patient_name text NOT NULL, patient_contact text NOT NULL, reason text NOT NULL,
      expected_arrival timestamptz, status text DEFAULT 'pending', hold_expires_at timestamptz DEFAULT now() + interval '15 minutes',
      created_at timestamptz DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sender_id uuid REFERENCES users(id), receiver_id text,
      content text NOT NULL, created_at timestamptz DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS activities (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users(id), description text NOT NULL,
      created_at timestamptz DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS doctor_reviews (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), doctor_id uuid REFERENCES users(id), patient_id uuid REFERENCES users(id),
      rating numeric DEFAULT 0, review text, created_at timestamptz DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS diagnoses (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users(id) ON DELETE CASCADE,
      symptoms text NOT NULL, result jsonb NOT NULL, created_at timestamptz DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS report_analyses (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), report_id uuid REFERENCES reports(id) ON DELETE CASCADE,
      requested_by uuid REFERENCES users(id) ON DELETE CASCADE, result jsonb NOT NULL,
      created_at timestamptz DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS password_reset_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users(id) ON DELETE CASCADE,
      requested_at timestamptz DEFAULT now(), status text DEFAULT 'requested'
    );
  `);
  await q("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS speciality text DEFAULT 'General'");
  await q("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS emergency boolean DEFAULT false");
}

const stablePartnerPick = (value) => [...String(value)].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3 === 0;
async function upsertPartnerHospital(client, hospital) {
  const placeId = String(hospital.placeId || hospital.place_id || hospital.id || '').trim();
  if (!placeId || !hospital.name) return null;
  const result = await client.query(
    `INSERT INTO hospitals(name,geoapify_place_id,address,latitude,longitude,phone,speciality,emergency,amenities,is_partner,updated_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,true,now())
     ON CONFLICT(geoapify_place_id) DO UPDATE SET name=EXCLUDED.name,address=EXCLUDED.address,
       latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,phone=COALESCE(EXCLUDED.phone,hospitals.phone),
       speciality=EXCLUDED.speciality,emergency=EXCLUDED.emergency,is_partner=true,updated_at=now()
     RETURNING *`,
    [hospital.name, placeId, hospital.address || hospital.name, Number(hospital.latitude || 0), Number(hospital.longitude || 0),
      hospital.phone || null, hospital.speciality || 'General', Boolean(hospital.emergency), JSON.stringify(['beds', 'icu', 'oxygen', 'emergency'])]
  );
  const partner = result.rows[0];
  const wards = [
    ['general', 'General Beds', 20 + (placeId.length % 15)],
    ['icu', 'ICU Beds', 5 + (placeId.length % 6)],
    ['emergency', 'Emergency Beds', 8 + (placeId.length % 8)],
  ];
  for (const [wardType, label, totalBeds] of wards) {
    await client.query(
      `INSERT INTO hospital_wards(hospital_id,ward_type,label,total_beds) VALUES($1,$2,$3,$4)
       ON CONFLICT(hospital_id,ward_type) DO UPDATE SET label=EXCLUDED.label,total_beds=EXCLUDED.total_beds`,
      [partner.id, wardType, label, totalBeds]
    );
  }
  return partner;
}

async function groqJson(system, content) {
  if (!process.env.GROQ_API_KEY) throw Object.assign(new Error('GROQ_API_KEY is not configured'), { status: 503 });
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.GROQ_CHAT_MODEL || 'llama-3.1-8b-instant',
      messages: [{ role: 'system', content: system }, { role: 'user', content }],
      response_format: { type: 'json_object' },
      max_tokens: 700,
    }),
  });
  const body = await response.json();
  if (!response.ok) throw Object.assign(new Error(body.error?.message || 'AI service failed'), { status: 502 });
  return JSON.parse(body.choices[0].message.content);
}

const displayText = (value, fallback = '') => {
  if (typeof value === 'string') return value.trim() || fallback;
  if (Array.isArray(value)) return value.map(item => displayText(item)).filter(Boolean).join('\n');
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([key, item]) => `${key.replace(/[_-]+/g, ' ')}: ${displayText(item)}`)
      .filter(line => !line.endsWith(': '))
      .join('\n');
  }
  return value == null ? fallback : String(value);
};

app.get('/api/health', async (_req, res) => {
  try {
    const result = await q('SELECT current_database() AS database, now() AS time');
    const database = ['localhost', '127.0.0.1'].includes(dbUrl.hostname) ? 'local-postgresql' : 'aiven-postgresql';
    res.json({ status: 'ok', backend: 'express', database, connection: result.rows[0] });
  } catch (error) {
    apiError(res, 503, `Database unavailable: ${error.message}`);
  }
});

async function signup(req, res, role) {
  const { name, email, password, number, phone, age, gender, hospital, speciality, specialization } = req.body;
  if (!name || !email || !password) return apiError(res, 400, 'Name, email, and password are required');
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await q(
      `INSERT INTO users(name,email,password_hash,role,phone,age,gender,hospital,speciality)
       VALUES($1,lower($2),$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [name, email, passwordHash, role, number || phone || null, age || null, gender || null, hospital || null, speciality || specialization || null]
    );
    const user = userDto(result.rows[0]);
    const token = jwt.sign({ id: user.id, role }, JWT_SECRET, { expiresIn: '2d' });
    res.status(201).json({ token, msg: token, user, doctor: role === 'doctor' ? user : undefined });
  } catch (error) {
    apiError(res, error.code === '23505' ? 409 : 500, error.code === '23505' ? 'Email already registered' : error.message);
  }
}
async function login(req, res, role) {
  const result = await q('SELECT * FROM users WHERE lower(email)=lower($1) AND role=$2', [req.body.email, role]);
  const row = result.rows[0];
  if (!row || !(await bcrypt.compare(req.body.password || '', row.password_hash))) return apiError(res, 401, 'Invalid email or password');
  const user = userDto(row);
  const token = jwt.sign({ id: user.id, role }, JWT_SECRET, { expiresIn: '2d' });
  res.json({ token, msg: token, user, doctor: role === 'doctor' ? user : undefined });
}
app.post('/api/auth/signup', (req, res) => signup(req, res, 'patient'));
app.post('/api/auth/doctor/signup', (req, res) => signup(req, res, 'doctor'));
app.post('/api/auth/login', (req, res) => login(req, res, 'patient'));
app.post('/api/auth/doctor/login', (req, res) => login(req, res, 'doctor'));
app.post('/api/auth/logout', (_req, res) => res.json({ message: 'Logged out' }));
app.post('/api/auth/forgot-password', async (req, res) => {
  const user = (await q('SELECT id FROM users WHERE lower(email)=lower($1)', [req.body.email || ''])).rows[0];
  if (user) await q('INSERT INTO password_reset_requests(user_id) VALUES($1)', [user.id]);
  res.json({ message: 'If the account exists, a password reset request has been recorded' });
});

app.get('/api/auth/profile', auth(), async (req, res) => {
  const result = await q('SELECT * FROM users WHERE id=$1', [req.auth.id]);
  const user = userDto(result.rows[0]);
  res.json({ user, profile: user });
});
app.get(['/api/user/info/detail', '/api/doctor/info/detail'], auth(), async (req, res) => {
  const result = await q('SELECT * FROM users WHERE id=$1', [req.auth.id]);
  res.json(data(userDto(result.rows[0])));
});
app.patch(['/api/user/info/update', '/api/doctor/info/update'], auth(), async (req, res) => {
  const { name, number, phone, age, gender, hospital, speciality, specialization } = req.body;
  const result = await q(
    `UPDATE users SET name=COALESCE($2,name), phone=COALESCE($3,phone), age=COALESCE($4,age),
     gender=COALESCE($5,gender), hospital=COALESCE($6,hospital), speciality=COALESCE($7,speciality), updated_at=now()
     WHERE id=$1 RETURNING *`,
    [req.auth.id, name, number || phone, age, gender, hospital, speciality || specialization]
  );
  res.json(data(userDto(result.rows[0])));
});

app.get('/api/user/doctor/search/:search', async (req, res) => {
  const term = `%${req.params.search === 'Dr' ? '' : req.params.search}%`;
  const result = await q(
    `SELECT u.*, COALESCE(json_agg(to_char(s.booking_date,'YYYY-MM-DD') || ' | ' || to_char(s.slot_time,'HH24:MI'))
     FILTER (WHERE s.id IS NOT NULL AND s.status='available'),'[]') availability
     FROM users u LEFT JOIN slots s ON s.doctor_id=u.id WHERE u.role='doctor' AND u.name ILIKE $1 GROUP BY u.id ORDER BY u.name`, [term]
  );
  res.json(data(result.rows.map(row => ({ ...userDto(row), availability: row.availability }))));
});
app.get('/api/doctor', async (_req, res) => {
  const result = await q("SELECT * FROM users WHERE role='doctor' ORDER BY name");
  res.json(result.rows.map(userDto));
});
app.get('/api/doctors/by-hospital', async (req, res) => {
  const hospital = String(req.query.hospital || '').trim();
  const speciality = String(req.query.speciality || '').trim();
  const result = await q(
    `SELECT * FROM users WHERE role='doctor'
     AND ($1='' OR hospital ILIKE $2)
     AND ($3='' OR speciality ILIKE $4 OR speciality ILIKE 'General')
     ORDER BY name`,
    [hospital, `%${hospital}%`, speciality, `%${speciality}%`]
  );
  res.json(data(result.rows.map(userDto)));
});

app.post('/api/doctor/slot/publish', auth('doctor'), async (req, res) => {
  const { bookingDate, slotTime } = req.body;
  const result = await q(
    `INSERT INTO slots(doctor_id,booking_date,slot_time) VALUES($1,$2,$3)
     ON CONFLICT(doctor_id,booking_date,slot_time) DO UPDATE SET status='available' RETURNING *`,
    [req.auth.id, bookingDate, slotTime]
  );
  res.status(201).json(data(slotDto(result.rows[0])));
});
app.get('/api/doctor/slot/all', auth('doctor'), async (req, res) => {
  const result = await q('SELECT * FROM slots WHERE doctor_id=$1 ORDER BY booking_date,slot_time', [req.auth.id]);
  res.json(data(result.rows.map(slotDto)));
});
app.delete('/api/doctor/slot/:slotId', auth('doctor'), async (req, res) => {
  await q("UPDATE slots SET status='cancelled' WHERE id=$1 AND doctor_id=$2", [req.params.slotId, req.auth.id]);
  res.json({ message: 'Slot cancelled' });
});
app.get('/api/user/meetings/slot/:doctorId', async (req, res) => {
  const result = await q(
    "SELECT * FROM slots WHERE doctor_id=$1 AND booking_date=$2 AND status='available' ORDER BY slot_time",
    [req.params.doctorId, req.query.date]
  );
  res.json({ availableSlots: result.rows.map(slotDto) });
});
app.post('/api/user/meetings/book', auth('patient'), async (req, res) => {
  if (!req.body.slotId || !req.body.doctorId) return apiError(res, 400, 'Doctor and slot are required');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const slotResult = await client.query("SELECT * FROM slots WHERE id=$1 AND doctor_id=$2 AND status='available' FOR UPDATE", [req.body.slotId, req.body.doctorId]);
    const slot = slotResult.rows[0];
    if (!slot) { await client.query('ROLLBACK'); return apiError(res, 409, 'Slot is no longer available'); }
    await client.query("UPDATE slots SET status='booked' WHERE id=$1", [slot.id]);
    const result = await client.query(
      `INSERT INTO appointments(patient_id,doctor_id,slot_id,appointment_date,slot_time,reason)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
      [req.auth.id, slot.doctor_id, slot.id, slot.booking_date, slot.slot_time, req.body.reasonOfAppointment]
    );
    await client.query('COMMIT');
    res.status(201).json(data({ appointmentId: id(result.rows[0]) }));
  } catch (error) {
    await client.query('ROLLBACK'); apiError(res, 500, error.message);
  } finally { client.release(); }
});

async function appointmentRows(where, params) {
  return q(
    `SELECT a.*, d.name doctor_name, d.speciality, d.hospital hospital_name,
     p.name patient_name, p.phone patient_contact, p.age patient_age, p.gender patient_gender, p.email patient_email,
     COALESCE((SELECT json_agg(json_build_object('_id',r.id,'title',r.title,'originalFileName',r.original_file_name,
       'category',r.category,'uploadedAt',r.created_at) ORDER BY r.created_at DESC)
       FROM (SELECT * FROM reports WHERE user_id=a.patient_id AND status='active' AND visibility<>'private'
       ORDER BY created_at DESC LIMIT 3) r),'[]') latest_reports
     FROM appointments a JOIN users d ON d.id=a.doctor_id JOIN users p ON p.id=a.patient_id
     WHERE ${where} ORDER BY a.appointment_date,a.slot_time`, params
  );
}
app.get('/api/user/meetings/all', auth('patient'), async (req, res) => res.json(data((await appointmentRows('a.patient_id=$1', [req.auth.id])).rows.map(appointmentDto))));
app.get('/api/doctor/meetings/all', auth('doctor'), async (req, res) => res.json(data((await appointmentRows('a.doctor_id=$1', [req.auth.id])).rows.map(appointmentDto))));
app.delete('/api/doctor/meetings/:id', auth('doctor'), async (req, res) => {
  const result = await q("UPDATE appointments SET status='cancelled' WHERE id=$1 AND doctor_id=$2 RETURNING slot_id", [req.params.id, req.auth.id]);
  if (result.rows[0]) await q("UPDATE slots SET status='available' WHERE id=$1", [result.rows[0].slot_id]);
  res.json({ message: 'Appointment cancelled' });
});
app.patch('/api/doctor/meetings/:id/status', auth('doctor'), async (req, res) => {
  const allowed = ['confirmed', 'cancelled', 'completed'];
  if (!allowed.includes(req.body.status)) return apiError(res, 400, 'Invalid appointment status');
  const result = await q(
    'UPDATE appointments SET status=$3 WHERE id=$1 AND doctor_id=$2 RETURNING *',
    [req.params.id, req.auth.id, req.body.status]
  );
  if (!result.rows[0]) return apiError(res, 404, 'Appointment not found');
  if (req.body.status === 'cancelled') await q("UPDATE slots SET status='available' WHERE id=$1", [result.rows[0].slot_id]);
  if (req.body.status === 'completed' && Array.isArray(req.body.reportIds) && req.body.reportIds.length) {
    await q("UPDATE reports SET visibility='private',updated_at=now() WHERE user_id=$1 AND id=ANY($2::uuid[])", [result.rows[0].patient_id, req.body.reportIds]);
  }
  res.json({ message: `Appointment ${req.body.status}`, appointment: result.rows[0] });
});
app.get('/api/doctor/user/my', auth('doctor'), async (req, res) => {
  const result = await q(
    `SELECT p.*, COALESCE(json_agg(json_build_object('id',a.id,'date',a.appointment_date,'status',a.status,
     'reason',a.reason) ORDER BY a.appointment_date DESC),'[]') appointment_history
     FROM users p JOIN appointments a ON a.patient_id=p.id WHERE a.doctor_id=$1
     GROUP BY p.id ORDER BY p.name`, [req.auth.id]
  );
  res.json(data(result.rows.map(row => ({ ...userDto(row), appointmentHistory: row.appointment_history }))));
});
app.get('/api/doctor/reviews', auth('doctor'), async (req, res) => {
  const result = await q(
    'SELECT r.*,p.name patient_name FROM doctor_reviews r JOIN users p ON p.id=r.patient_id WHERE doctor_id=$1 ORDER BY created_at DESC',
    [req.auth.id]
  );
  const averageRating = result.rows.length ? result.rows.reduce((sum, row) => sum + Number(row.rating), 0) / result.rows.length : 0;
  res.json({ averageRating: Number(averageRating.toFixed(1)), count: result.rows.length, reviews: result.rows.map(r => ({ ...r, _id: id(r), patientName: r.patient_name, comment: r.review })) });
});
app.post('/api/doctors/:doctorId/reviews', auth('patient'), async (req, res) => {
  const rating = Number(req.body.rating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) return apiError(res, 400, 'Rating must be between 1 and 5');
  const appointment = (await q('SELECT 1 FROM appointments WHERE patient_id=$1 AND doctor_id=$2 LIMIT 1', [req.auth.id, req.params.doctorId])).rows[0];
  if (!appointment) return apiError(res, 403, 'Only patients of this doctor can leave a review');
  const result = await q('INSERT INTO doctor_reviews(doctor_id,patient_id,rating,review) VALUES($1,$2,$3,$4) RETURNING *', [req.params.doctorId, req.auth.id, rating, req.body.review]);
  res.status(201).json({ ...result.rows[0], _id: id(result.rows[0]) });
});

app.get('/api/hospital/all', async (_req, res) => {
  const result = await q(`SELECT h.*, COALESCE(sum(w.total_beds-w.reserved_beds),0) available_beds FROM hospitals h LEFT JOIN hospital_wards w ON w.hospital_id=h.id GROUP BY h.id ORDER BY h.name`);
  res.json(data(result.rows.map(hospitalDto)));
});
app.post('/api/hospitals/register-partners', async (req, res) => {
  const candidates = Array.isArray(req.body.hospitals) ? req.body.hospitals.slice(0, 50) : [];
  const selected = candidates.filter((hospital, index) => stablePartnerPick(hospital.placeId || hospital.id || index));
  if (selected.length < 2) selected.push(...candidates.filter((_, index) => index % 4 === 0).slice(0, 2 - selected.length));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const partners = [];
    for (const hospital of selected) {
      const partner = await upsertPartnerHospital(client, hospital);
      if (partner) partners.push(hospitalDto(partner));
    }
    await client.query('COMMIT');
    res.json(data(partners));
  } catch (error) {
    await client.query('ROLLBACK');
    apiError(res, 500, error.message);
  } finally { client.release(); }
});
app.post('/api/hospitals/seed-nearby', async (req, res) => {
  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return apiError(res, 400, 'Valid latitude and longitude are required');
  const names = ['MediRaksha City Hospital', 'Sanjeevani Partner Hospital', 'Aarogya Multispeciality Centre', 'Jeevan Emergency Hospital'];
  const offsets = [[0.008, 0.004], [-0.006, 0.009], [0.011, -0.007], [-0.009, -0.006]];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const partners = [];
    for (let index = 0; index < names.length; index++) {
      const partner = await upsertPartnerHospital(client, {
        placeId: `local-partner-${latitude.toFixed(2)}-${longitude.toFixed(2)}-${index + 1}`,
        name: names[index], address: `Partner hospital near ${latitude.toFixed(3)}, ${longitude.toFixed(3)}`,
        latitude: latitude + offsets[index][0], longitude: longitude + offsets[index][1],
        speciality: index === 3 ? 'Emergency' : 'General', emergency: index === 3,
      });
      if (partner) partners.push(hospitalDto(partner));
    }
    await client.query('COMMIT');
    res.json(data(partners));
  } catch (error) {
    await client.query('ROLLBACK');
    apiError(res, 500, error.message);
  } finally { client.release(); }
});
app.get('/api/hospitals/by-place/:placeId', async (req, res) => {
  const result = await q('SELECT * FROM hospitals WHERE geoapify_place_id=$1 OR id::text=$1', [req.params.placeId]);
  if (!result.rows[0]) return apiError(res, 404, 'Hospital not found');
  res.json(data(hospitalDto(result.rows[0])));
});
app.get('/api/hospitals/:hospitalId/availability', async (req, res) => {
  const hospital = (await q('SELECT * FROM hospitals WHERE id=$1', [req.params.hospitalId])).rows[0];
  if (!hospital) return apiError(res, 404, 'Hospital not found');
  const wards = (await q('SELECT * FROM hospital_wards WHERE hospital_id=$1 ORDER BY label', [hospital.id])).rows;
  res.json({
    hospitalId: id(hospital), hospitalName: hospital.name, lastInventoryUpdate: hospital.updated_at,
    amenities: hospital.amenities, wards: wards.map(w => ({
      wardId: id(w), wardType: w.ward_type, label: w.label, totalBeds: w.total_beds, availableBeds: w.total_beds - w.reserved_beds,
    })),
  });
});
app.post('/api/bed-bookings', auth('patient'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ward = (await client.query('SELECT * FROM hospital_wards WHERE id=$1 AND hospital_id=$2 FOR UPDATE', [req.body.wardId, req.body.hospitalId])).rows[0];
    if (!ward || ward.reserved_beds >= ward.total_beds) { await client.query('ROLLBACK'); return apiError(res, 409, 'No beds available'); }
    await client.query('UPDATE hospital_wards SET reserved_beds=reserved_beds+1 WHERE id=$1', [ward.id]);
    const result = await client.query(
      `INSERT INTO bed_bookings(hospital_id,ward_id,patient_id,patient_name,patient_contact,reason,expected_arrival)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.body.hospitalId, req.body.wardId, req.auth.id, req.body.patientName, req.body.patientContact, req.body.reason, req.body.expectedArrival]
    );
    await client.query('COMMIT');
    res.status(201).json(bookingDto(result.rows[0]));
  } catch (error) { await client.query('ROLLBACK'); apiError(res, 500, error.message); } finally { client.release(); }
});
app.get('/api/bed-bookings/my', auth('patient'), async (req, res) => {
  const expired = await q("UPDATE bed_bookings SET status='expired' WHERE patient_id=$1 AND status='pending' AND hold_expires_at<now() RETURNING ward_id", [req.auth.id]);
  for (const booking of expired.rows) {
    await q('UPDATE hospital_wards SET reserved_beds=GREATEST(0,reserved_beds-1) WHERE id=$1', [booking.ward_id]);
  }
  const result = await q(
    `SELECT b.*,h.name hospital_name,w.label ward_label,w.ward_type FROM bed_bookings b
     JOIN hospitals h ON h.id=b.hospital_id JOIN hospital_wards w ON w.id=b.ward_id WHERE b.patient_id=$1 ORDER BY b.created_at DESC`, [req.auth.id]
  );
  res.json(result.rows.map(bookingDto));
});
app.patch('/api/bed-bookings/:id/cancel', auth('patient'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const booking = (await client.query("UPDATE bed_bookings SET status='cancelled' WHERE id=$1 AND patient_id=$2 AND status IN ('pending','confirmed') RETURNING *", [req.params.id, req.auth.id])).rows[0];
    if (booking) await client.query('UPDATE hospital_wards SET reserved_beds=GREATEST(0,reserved_beds-1) WHERE id=$1', [booking.ward_id]);
    await client.query('COMMIT'); res.json({ message: 'Booking cancelled' });
  } catch (error) { await client.query('ROLLBACK'); apiError(res, 500, error.message); } finally { client.release(); }
});

app.get('/api/user/report/all', auth('patient'), async (req, res) => {
  const result = await q("SELECT * FROM reports WHERE user_id=$1 AND status='active' ORDER BY created_at DESC", [req.auth.id]);
  res.json(data(result.rows.map(reportDto)));
});
app.post('/api/user/report/upload', auth('patient'), upload.single('file'), async (req, res) => {
  if (!req.file) return apiError(res, 400, 'File is required');
  const result = await q(
    `INSERT INTO reports(user_id,title,category,visibility,original_file_name,mime_type,file_size,file_data)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [req.auth.id, req.body.title || req.file.originalname, req.body.category, req.body.visibility, req.file.originalname, req.file.mimetype, req.file.size, req.file.buffer]
  );
  res.status(201).json(data(reportDto(result.rows[0])));
});
app.get('/api/user/report/:id', auth(), async (req, res) => {
  const result = await q(
    `SELECT r.* FROM reports r WHERE r.id=$1 AND
     (r.user_id=$2 OR ($3='doctor' AND r.visibility<>'private' AND EXISTS
       (SELECT 1 FROM appointments a WHERE a.patient_id=r.user_id AND a.doctor_id=$2)))`,
    [req.params.id, req.auth.id, req.auth.role]
  );
  if (!result.rows[0]) return apiError(res, 404, 'Report not found');
  res.json(data(reportDto(result.rows[0], true)));
});
app.delete('/api/user/report/:id', auth('patient'), async (req, res) => {
  await q("UPDATE reports SET status='deleted',updated_at=now() WHERE id=$1 AND user_id=$2", [req.params.id, req.auth.id]);
  res.json({ message: 'Report deleted' });
});
app.patch('/api/user/report/:id/visibility', auth('patient'), async (req, res) => {
  if (!['private', 'shared'].includes(req.body.visibility)) return apiError(res, 400, 'Visibility must be private or shared');
  const result = await q(
    'UPDATE reports SET visibility=$3,updated_at=now() WHERE id=$1 AND user_id=$2 AND status=$4 RETURNING *',
    [req.params.id, req.auth.id, req.body.visibility, 'active']
  );
  if (!result.rows[0]) return apiError(res, 404, 'Report not found');
  res.json(data(reportDto(result.rows[0])));
});
app.get('/api/doctor/shared-reports', auth('doctor'), async (req, res) => {
  const result = await q(
    `SELECT DISTINCT r.*,u.name patient_name FROM reports r JOIN users u ON u.id=r.user_id
     JOIN appointments a ON a.patient_id=r.user_id WHERE a.doctor_id=$1 AND r.status='active' AND r.visibility<>'private' ORDER BY r.created_at DESC`, [req.auth.id]
  );
  res.json(result.rows.map(row => ({ ...reportDto(row), patientName: row.patient_name })));
});

app.get('/api/messages', auth(), async (req, res) => {
  const result = await q("SELECT id,sender_id,receiver_id,content,created_at FROM messages WHERE sender_id::text=$1 OR receiver_id=$1 OR receiver_id='admin' ORDER BY created_at DESC", [req.auth.id]);
  res.json(result.rows.map(r => ({ ...r, _id: id(r), senderId: String(r.sender_id), receiverId: r.receiver_id, createdAt: r.created_at })));
});
app.post('/api/messages', auth(), async (req, res) => {
  const result = await q('INSERT INTO messages(sender_id,receiver_id,content) VALUES($1,$2,$3) RETURNING *', [req.auth.id, req.body.receiverId || 'admin', req.body.content]);
  const row = result.rows[0]; res.status(201).json({ ...row, _id: id(row), senderId: String(row.sender_id), receiverId: row.receiver_id, createdAt: row.created_at });
});
app.post('/api/chat/upload', auth(), upload.single('file'), (req, res) => {
  if (!req.file) return apiError(res, 400, 'File is required');
  res.json({ fileUrl: `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}` });
});
app.post('/api/activities', auth('patient'), async (req, res) => {
  if (!String(req.body.description || '').trim()) return apiError(res, 400, 'Description is required');
  const result = await q('INSERT INTO activities(user_id,description) VALUES($1,$2) RETURNING *', [req.auth.id, req.body.description]);
  res.status(201).json(activityDto(result.rows[0]));
});
app.get('/api/activities', auth('patient'), async (req, res) => {
  const result = await q('SELECT * FROM activities WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20', [req.auth.id]);
  res.json(data(result.rows.map(activityDto)));
});
app.delete('/api/activities/:id', auth('patient'), async (req, res) => {
  await q('DELETE FROM activities WHERE id=$1 AND user_id=$2', [req.params.id, req.auth.id]);
  res.json({ message: 'Activity deleted' });
});
app.post('/api/appointments', auth('patient'), (_req, res) => apiError(res, 400, 'Appointments must be created by booking an available doctor slot'));

app.post('/api/diagnoses', auth('patient'), async (req, res) => {
  const symptoms = String(req.body.symptoms || '').trim();
  if (!symptoms) return apiError(res, 400, 'Symptoms are required');
  let result;
  try {
    result = await groqJson(
      'You are a cautious medical triage assistant. Return a JSON object with exactly these string fields: condition, severity, advice, and specialist. The advice value must be one concise plain-text string, never an object or array. Do not claim certainty or prescribe medication. Highlight emergency care when red flags are possible.',
      symptoms
    );
    result = {
      condition: displayText(result.condition, 'Unable to determine'),
      severity: displayText(result.severity, 'unknown'),
      advice: displayText(result.advice, 'Consult a qualified clinician.'),
      specialist: displayText(result.specialist, 'General'),
    };
  } catch (error) {
    result = {
      condition: 'Assessment unavailable',
      severity: 'unknown',
      advice: 'Monitor your symptoms and consult a qualified clinician. Seek emergency care for severe or rapidly worsening symptoms.',
      specialist: 'General',
      aiAvailable: false,
    };
  }
  const saved = await q('INSERT INTO diagnoses(user_id,symptoms,result) VALUES($1,$2,$3) RETURNING id,created_at', [req.auth.id, symptoms, result]);
  res.status(201).json({ ...result, id: id(saved.rows[0]), createdAt: saved.rows[0].created_at });
});
app.get('/api/diagnoses', auth('patient'), async (req, res) => {
  const result = await q('SELECT id,symptoms,result,created_at FROM diagnoses WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20', [req.auth.id]);
  res.json(data(result.rows.map(row => ({ id: id(row), symptoms: row.symptoms, ...row.result, createdAt: row.created_at }))));
});

app.post('/api/assistant/chat', async (req, res) => {
  if (!process.env.GROQ_API_KEY) return apiError(res, 503, 'GROQ_API_KEY is not configured');
  const message = String(req.body.message || '').trim();
  if (!message) return apiError(res, 400, 'Message is required');
  const history = Array.isArray(req.body.history)
    ? req.body.history.slice(-10).flatMap(item => {
      const role = item?.role === 'assistant' ? 'assistant' : item?.role === 'user' ? 'user' : null;
      const content = String(item?.content || '').trim().slice(0, 2000);
      return role && content ? [{ role, content }] : [];
    })
    : [];
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.GROQ_CHAT_MODEL || 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `You are MediRaksha, a cautious conversational healthcare triage assistant.
Use the clinical reasoning behind OPQRST and OLD CART internally, but NEVER mention, define, list, or recite those framework names or letters.
Respond naturally to the patient's specific symptom and conversation history. Ask only one concise, relevant follow-up question at a time, choosing the most important missing detail such as onset, location, duration, character, severity, timing, triggers, relieving factors, or associated symptoms.
Do not repeat a question already answered. If the message suggests a medical emergency, stop routine questioning and clearly advise immediate emergency care.
Do not diagnose, claim certainty, or prescribe medication. Keep responses brief and empathetic. Include a short medical disclaimer only when giving guidance, not after every follow-up question.`,
          },
          ...history,
          { role: 'user', content: message },
        ],
        max_tokens: 220,
        temperature: 0.3,
      }),
    });
    const body = await response.json();
    if (!response.ok) return apiError(res, 502, body.error?.message || 'AI service failed');
    res.json({ response: body.choices[0].message.content });
  } catch (error) { apiError(res, 502, error.message); }
});
app.post('/api/assistant/classify', auth('patient'), async (req, res) => {
  const labels = Array.isArray(req.body.candidateLabels) ? req.body.candidateLabels.filter(Boolean) : [];
  if (!String(req.body.text || '').trim() || !labels.length) return apiError(res, 400, 'Text and candidateLabels are required');
  try {
    const result = await groqJson(
      `Choose exactly one medical specialty from this list and return JSON with only a label field: ${labels.join(', ')}`,
      req.body.text
    );
    const label = labels.find(item => item.toLowerCase() === String(result.label || '').toLowerCase()) || 'General';
    res.json({ label });
  } catch {
    const matchingLabel = labels.find(label => String(req.body.text).toLowerCase().includes(label.toLowerCase()));
    res.json({ label: matchingLabel || labels.find(label => label.toLowerCase() === 'general') || labels[0], aiAvailable: false });
  }
});
app.post('/api/analyze-report', auth(), async (req, res) => {
  const reportId = req.body.fileId || req.body.reportId;
  const report = (await q(
    `SELECT r.* FROM reports r WHERE r.id=$1 AND
     (r.user_id=$2 OR ($3='doctor' AND r.visibility<>'private' AND EXISTS
       (SELECT 1 FROM appointments a WHERE a.patient_id=r.user_id AND a.doctor_id=$2)))`,
    [reportId, req.auth.id, req.auth.role]
  )).rows[0];
  if (!report) return apiError(res, 404, 'Report not found or not shared');
  const cached = (await q('SELECT result FROM report_analyses WHERE report_id=$1 ORDER BY created_at DESC LIMIT 1', [report.id])).rows[0];
  if (cached && !req.body.refresh) return res.json(cached.result);
  const readableText = report.mime_type?.startsWith('text/') ? report.file_data?.toString('utf8').slice(0, 12000) : '';
  let result;
  try {
    result = await groqJson(
      'You are a cautious medical report assistant. Return JSON with history as a concise summary and mandatory_care as an array. State limitations when report contents are unavailable. Do not diagnose or prescribe.',
      readableText || `Only report metadata is available. Filename: ${report.original_file_name}; category: ${report.category}; mime type: ${report.mime_type}.`
    );
  } catch {
    result = {
      history: `Automated analysis is unavailable. Report metadata: ${report.original_file_name || report.title} (${report.category || 'uncategorized'}).`,
      mandatory_care: ['Have a qualified clinician review the original report before making medical decisions.'],
      aiAvailable: false,
    };
  }
  await q('INSERT INTO report_analyses(report_id,requested_by,result) VALUES($1,$2,$3)', [report.id, req.auth.id, result]);
  res.json(result);
});

app.use((error, _req, res, _next) => {
  console.error(error);
  apiError(res, 500, error.message || 'Internal server error');
});

initDatabase()
  .then(() => app.listen(PORT, '0.0.0.0', () => console.log(`MediRaksha Express API listening on port ${PORT}`)))
  .catch((error) => {
    console.error('Aiven PostgreSQL initialization failed:', error);
    process.exit(1);
  });
