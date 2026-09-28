import { pool } from '../config/db.js';

const ensureBedBookingTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BedBooking" (
      "id" SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL,
      "hospitalId" INTEGER,
      "hospitalPlaceId" VARCHAR,
      "hospitalName" VARCHAR NOT NULL,
      "bedsRequested" INTEGER NOT NULL DEFAULT 1,
      "contactName" VARCHAR,
      "contactNumber" VARCHAR,
      "notes" VARCHAR,
      "status" VARCHAR NOT NULL DEFAULT 'active',
      "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

export const getHospitals = async (req, res) => {
    try {
        // Implementation for fetching all hospitals
        const response = await pool.query('SELECT * FROM "Hospital" ORDER BY "name" ASC');
        const hospitals = response.rows;
        res.json({ success: true, data: hospitals });
    } catch (err) {
        console.error('Error fetching hospitals', err);
        res.status(500).json({ error: 'Internal server error' });
    }
  
};

export const getHospitalById = async (req, res) => {
  try {
    // Implementation for fetching a hospital by ID
    const { id } = req.params;
    const response = await pool.query('SELECT * FROM "Hospital" WHERE id = $1', [id]);

    const hospital = response.rows[0];
    if (!hospital) {
        return res.status(404).json({ error: 'Hospital not found' });
    }

    res.json({ success: true, data: hospital });
  } catch (err) {
    console.error('Error fetching hospital', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const searchGeoapifyHospitals = async (req, res) => {
  const { lat, lon, radius = 5000, limit = 30 } = req.query;
  const apiKey = process.env.GEOAPIFY_API_KEY;

  if (!apiKey) {
    return res.status(501).json({ success: false, message: 'GEOAPIFY_API_KEY is not configured.' });
  }

  const latitude = Number(lat);
  const longitude = Number(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res.status(400).json({ success: false, message: 'lat and lon query parameters are required.' });
  }

  try {
    const safeRadius = Math.min(Math.max(Number(radius) || 5000, 500), 20000);
    const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 50);
    const url = new URL('https://api.geoapify.com/v2/places');
    url.searchParams.set('categories', 'healthcare.hospital');
    url.searchParams.set('filter', `circle:${longitude},${latitude},${safeRadius}`);
    url.searchParams.set('bias', `proximity:${longitude},${latitude}`);
    url.searchParams.set('limit', String(safeLimit));
    url.searchParams.set('apiKey', apiKey);

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: data?.message || 'Geoapify hospital lookup failed.'
      });
    }

    const hospitals = (data.features || []).map((feature) => {
      const props = feature.properties || {};
      const [featureLon, featureLat] = feature.geometry?.coordinates || [];
      return {
        id: props.place_id,
        placeId: props.place_id,
        lat: props.lat ?? featureLat,
        lon: props.lon ?? featureLon,
        name: props.name || props.formatted || 'Hospital',
        address: props.formatted,
        distanceMeters: props.distance,
        categories: props.categories || [],
      };
    }).filter((item) => item.placeId && Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lon)));

    return res.status(200).json({ success: true, data: hospitals });
  } catch (error) {
    console.error('Geoapify search error:', error);
    return res.status(500).json({ success: false, message: 'Unable to search Geoapify hospitals.' });
  }
};

export const getGeoapifyHospitalByPlaceId = async (req, res) => {
  const { placeId } = req.params;
  const apiKey = process.env.GEOAPIFY_API_KEY;

  if (!apiKey) {
    return res.status(501).json({ success: false, message: 'GEOAPIFY_API_KEY is not configured.' });
  }

  try {
    const url = new URL('https://api.geoapify.com/v2/place-details');
    url.searchParams.set('id', placeId);
    url.searchParams.set('apiKey', apiKey);

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: data?.message || 'Geoapify place lookup failed.'
      });
    }

    const feature = data.features?.[0];
    if (!feature) {
      return res.status(404).json({ success: false, message: 'Hospital place not found.' });
    }

    const props = feature.properties || {};
    const [lon, lat] = feature.geometry?.coordinates || [];
    return res.status(200).json({
      success: true,
      data: {
        id: props.place_id,
        placeId: props.place_id,
        lat: props.lat ?? lat,
        lon: props.lon ?? lon,
        name: props.name || props.formatted || 'Hospital',
        address: props.formatted,
        categories: props.categories || [],
        phone: props.contact?.phone,
        website: props.website,
      }
    });
  } catch (error) {
    console.error('Geoapify place detail error:', error);
    return res.status(500).json({ success: false, message: 'Unable to load Geoapify place details.' });
  }
};

export const createBedBooking = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { bedsRequested = 1, contactName, contactNumber, notes, hospitalPlaceId, hospitalName } = req.body;
  const bedCount = Number(bedsRequested);

  if (!Number.isInteger(bedCount) || bedCount < 1 || bedCount > 10) {
    return res.status(400).json({ success: false, message: 'bedsRequested must be between 1 and 10.' });
  }

  await ensureBedBookingTable();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let resolvedHospitalName = hospitalName?.trim();
    let hospitalId = null;

    if (id !== 'geoapify') {
      const { rows } = await client.query(
        `SELECT id, name, bed FROM "Hospital" WHERE id = $1 FOR UPDATE`,
        [id]
      );

      if (rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Hospital not found.' });
      }

      const hospital = rows[0];
      if ((hospital.bed || 0) < bedCount) {
        await client.query('ROLLBACK');
        return res.status(409).json({ success: false, message: 'Not enough beds are available.' });
      }

      hospitalId = hospital.id;
      resolvedHospitalName = hospital.name;
      await client.query(
        `UPDATE "Hospital" SET bed = bed - $1, "updated_at" = NOW() WHERE id = $2`,
        [bedCount, hospitalId]
      );
    }

    if (!resolvedHospitalName) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'hospitalName is required for external hospitals.' });
    }

    const { rows: inserted } = await client.query(
      `INSERT INTO "BedBooking"
       ("userId", "hospitalId", "hospitalPlaceId", "hospitalName", "bedsRequested", "contactName", "contactNumber", "notes", "status", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', NOW(), NOW())
       RETURNING *`,
      [userId, hospitalId, hospitalPlaceId || null, resolvedHospitalName, bedCount, contactName || null, contactNumber || null, notes || null]
    );

    await client.query('COMMIT');
    return res.status(201).json({ success: true, message: 'Bed booking request created.', data: inserted[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('createBedBooking error:', error);
    return res.status(500).json({ success: false, message: 'Unable to create bed booking.' });
  } finally {
    client.release();
  }
};

export const getMyBedBookings = async (req, res) => {
  await ensureBedBookingTable();

  try {
    const { rows } = await pool.query(
      `SELECT * FROM "BedBooking" WHERE "userId" = $1 ORDER BY "created_at" DESC`,
      [req.user.id]
    );
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('getMyBedBookings error:', error);
    return res.status(500).json({ success: false, message: 'Unable to load bed bookings.' });
  }
};

export const cancelBedBooking = async (req, res) => {
  const { bookingId } = req.params;
  await ensureBedBookingTable();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT * FROM "BedBooking" WHERE id = $1 AND "userId" = $2 FOR UPDATE`,
      [bookingId, req.user.id]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Bed booking not found.' });
    }

    const booking = rows[0];
    if (booking.status === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Bed booking is already cancelled.' });
    }

    await client.query(
      `UPDATE "BedBooking" SET status = 'cancelled', "updated_at" = NOW() WHERE id = $1`,
      [bookingId]
    );

    if (booking.hospitalId) {
      await client.query(
        `UPDATE "Hospital" SET bed = COALESCE(bed, 0) + $1, "updated_at" = NOW() WHERE id = $2`,
        [booking.bedsRequested, booking.hospitalId]
      );
    }

    await client.query('COMMIT');
    return res.status(200).json({ success: true, message: 'Bed booking cancelled.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('cancelBedBooking error:', error);
    return res.status(500).json({ success: false, message: 'Unable to cancel bed booking.' });
  } finally {
    client.release();
  }
};
