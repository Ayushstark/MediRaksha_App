import { pool } from '../../config/db.js';

// ── Geospatial search using Haversine formula ─────────────────────────────────
//
// Strategy: bounding-box pre-filter on indexed (latitude, longitude) columns
// narrows candidates cheaply, then the Haversine formula computes exact
// great-circle distances from those candidates.
//
// Accuracy note: this is the standard Haversine implementation (±0.3% error).
// For sub-metre accuracy, switch to the Vincenty formula or PostGIS ST_Distance.

const haversineExpr = (latPlaceholder, lngPlaceholder) => `
  (6371.0 * acos(LEAST(1.0, GREATEST(-1.0,
    cos(radians(${latPlaceholder})) * cos(radians(h.latitude)) *
    cos(radians(h.longitude) - radians(${lngPlaceholder})) +
    sin(radians(${latPlaceholder})) * sin(radians(h.latitude))
  )))
)`.trim();

// Build a sequential parameter helper — avoids manual index tracking
const makeParams = () => {
  const list = [];
  const p = (val) => { list.push(val); return '$' + list.length; };
  return { list, p };
};

// ── findHospitalsNearby ───────────────────────────────────────────────────────

export const findHospitalsNearby = async (lat, lng, radiusKm = 10, options = {}) => {
  const { hospitalType = null, facilityType = null, limit = 20 } = options;

  const { list: params, p } = makeParams();

  // Register lat/lng first so their positions are stable (reused in haversine)
  const latP = p(lat);
  const lngP = p(lng);

  // Bounding-box deltas in degrees
  const latDelta = radiusKm / 111.0;
  const cosLat   = Math.cos((lat * Math.PI) / 180);
  const lngDelta = cosLat > 0.001 ? radiusKm / (111.0 * cosLat) : radiusKm / 111.0;

  const latMinP = p(lat - latDelta);
  const latMaxP = p(lat + latDelta);
  const lngMinP = p(lng - lngDelta);
  const lngMaxP = p(lng + lngDelta);

  const distanceExpr = haversineExpr(latP, lngP);

  const conditions = [
    'h.is_active = TRUE',
    `h.latitude  BETWEEN ${latMinP} AND ${latMaxP}`,
    `h.longitude BETWEEN ${lngMinP} AND ${lngMaxP}`,
  ];

  if (hospitalType) {
    conditions.push(`h.hospital_type = ${p(hospitalType)}`);
  }

  if (facilityType) {
    // EXISTS subquery avoids fan-out from JOIN when hospital has multiple matching facilities
    conditions.push(`
      EXISTS (
        SELECT 1 FROM hospital_facilities hf
        WHERE hf.hospital_id = h.id
          AND hf.facility_type = ${p(facilityType)}
          AND hf.is_available  = TRUE
      )`);
  }

  const radiusP = p(radiusKm);
  const limitP  = p(Math.min(limit, 50));

  const query = `
    SELECT sub.id, sub.hospital_code, sub.hospital_name, sub.hospital_type,
           sub.address, sub.city, sub.state, sub.country, sub.pincode,
           sub.latitude, sub.longitude, sub.phone, sub.email,
           sub.rating, sub.reliability_score,
           ROUND(sub.distance_km::NUMERIC, 3) AS distance_km
    FROM (
      SELECT h.*,
             ${distanceExpr} AS distance_km
      FROM hospitals h
      WHERE ${conditions.join(' AND ')}
    ) sub
    WHERE sub.distance_km <= ${radiusP}
    ORDER BY sub.distance_km ASC
    LIMIT ${limitP}
  `;

  const { rows } = await pool.query(query, params);
  return rows;
};

// ── searchHospitals ───────────────────────────────────────────────────────────

export const searchHospitals = async (filters = {}) => {
  const {
    city           = null,
    facilityType   = null,
    departmentName = null,
    hospitalType   = null,
    page           = 1,
    limit          = 20,
  } = filters;

  const { list: params, p } = makeParams();
  const conditions = ['h.is_active = TRUE'];
  const offset = (page - 1) * limit;

  if (city) {
    conditions.push(`LOWER(h.city) LIKE ${p(`%${city.toLowerCase()}%`)}`);
  }

  if (hospitalType) {
    conditions.push(`h.hospital_type = ${p(hospitalType)}`);
  }

  if (facilityType) {
    conditions.push(`
      EXISTS (
        SELECT 1 FROM hospital_facilities hf
        WHERE hf.hospital_id = h.id
          AND hf.facility_type = ${p(facilityType)}
          AND hf.is_available  = TRUE
      )`);
  }

  if (departmentName) {
    conditions.push(`
      EXISTS (
        SELECT 1 FROM hospital_departments hd
        WHERE hd.hospital_id = h.id
          AND LOWER(hd.department_name) LIKE ${p(`%${departmentName.toLowerCase()}%`)}
          AND hd.is_active = TRUE
      )`);
  }

  const limitP  = p(limit);
  const offsetP = p(offset);

  const query = `
    SELECT h.id, h.hospital_code, h.hospital_name, h.hospital_type,
           h.city, h.state, h.country, h.phone, h.email,
           h.rating, h.reliability_score, h.is_active
    FROM hospitals h
    WHERE ${conditions.join(' AND ')}
    ORDER BY h.rating DESC, h.hospital_name ASC
    LIMIT  ${limitP}
    OFFSET ${offsetP}
  `;

  const { rows } = await pool.query(query, params);
  return rows;
};
