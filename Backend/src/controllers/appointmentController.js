import { pool } from '../config/db.js';

// GET /api/user/meetings/all
export const getAllMeetings = async (req, res) => {
  const userId = req.user.id;

  try {
    // FIX 6: pg returns { rows } not [rows] — destructure correctly throughout
    // FIX 7: Fixed column aliasing — "a.Id" quoted the whole string as one identifier;
    //         correct form is a."columnName" or just the unquoted alias
    // FIX 8: No more backtick aliases — pg uses standard SQL double-quote identifiers
    const { rows: appointments } = await pool.query(
      `SELECT 
        a.id,
        TO_CHAR(a."appointmentDate", 'YYYY-MM-DD') AS "appointmentDate",
        a."slotTime",
        a.status,
        a."reasonOfAppointment",
        d.name       AS "doctorName",
        d.speciality AS "speciality",
        d.hospital   AS "hospital",
        TO_CHAR(s."bookingDate", 'YYYY-MM-DD') AS "bookingDate",
        s."slotTime" AS "availableSlotTime",
        s.status     AS "slotStatus"
       FROM "Appointment" a
       JOIN "Doctor" d ON a."doctorId" = d.id
       JOIN "Slot"   s ON a."slotId"   = s.id
       WHERE a."userId" = $1
       ORDER BY a."appointmentDate" DESC, a."slotTime" ASC`,
      [userId]
    );

    // FIX 13: Empty result is valid (new user has no appointments) — return 200 with []
    return res.status(200).json({ success: true, data: appointments });

  } catch (error) {
    console.error('getAllMeetings error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/user/meetings/:id
export const getMeetingById = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    // FIX 8: Was FROM "Appointments a — missing closing quote crashed every call
    const { rows } = await pool.query(
      `SELECT 
        a.id,
        TO_CHAR(a."appointmentDate", 'YYYY-MM-DD') AS "appointmentDate",
        a."slotTime",
        a.status,
        a."reasonOfAppointment",
        d.name       AS "doctorName",
        d.speciality AS "speciality",
        d.hospital   AS "hospital",
        d.number     AS "doctorContact",
        TO_CHAR(s."bookingDate", 'YYYY-MM-DD') AS "bookingDate",
        s."slotTime" AS "availableSlotTime",
        s.status     AS "slotStatus"
       FROM "Appointment" a
       JOIN "Doctor" d ON a."doctorId" = d.id
       JOIN "Slot"   s ON a."slotId"   = s.id
       WHERE a.id = $1 AND a."userId" = $2`,
      [id, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    res.status(200).json({ success: true, data: rows[0] });

  } catch (error) {
    console.error('getMeetingById error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// DELETE /api/user/meetings/:id
export const deleteMeeting = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT id, "slotId", status FROM "Appointment" WHERE id = $1 AND "userId" = $2`,
      [id, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    if (rows[0].status === 'completed') {
      return res.status(400).json({ success: false, message: 'Cannot cancel a completed appointment' });
    }

    // Free up the slot
    await pool.query(
      `UPDATE "Slot" SET status = 'available' WHERE id = $1`,
      [rows[0].slotId]
    );

    // FIX 9: Was using ? (MySQL placeholder) instead of $1 (PostgreSQL)
    await pool.query(`DELETE FROM "Appointment" WHERE id = $1`, [id]);

    res.status(200).json({ success: true, message: 'Appointment cancelled successfully' });

  } catch (error) {
    console.error('deleteMeeting error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/user/meetings/book
// Body: { doctorId, slotId, reasonOfAppointment }
export const bookMeeting = async (req, res) => {
  const userId = req.user.id;
  const { doctorId, slotId, appointmentDate, reasonOfAppointment } = req.body;

  if (!doctorId || !slotId) {
    return res.status(400).json({
      success: false,
      message: 'doctorId and slotId are required',
    });
  }

  // FIX 6: pg has no pool.getConnection() / beginTransaction() / release().
  //         Use a single client checked out from the pool for transactions.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the slot row to prevent race conditions
    const { rows: slot } = await client.query(
      `SELECT id, status, TO_CHAR("bookingDate", 'YYYY-MM-DD') AS "bookingDate", "slotTime" FROM "Slot"
       WHERE id = $1 AND "doctorId" = $2 AND status = 'available'
       FOR UPDATE`,
      [slotId, doctorId]
    );

    if (slot.length === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Slot is no longer available' });
    }

    const selectedSlot = slot[0];
    const selectedDate = selectedSlot.bookingDate;
    const selectedTime = selectedSlot.slotTime || '09:00';

    if (appointmentDate && appointmentDate !== selectedDate) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'appointmentDate does not match the selected slot.' });
    }

    // Duplicate appointment guard
    const { rows: duplicate } = await client.query(
      `SELECT id FROM "Appointment"
       WHERE "userId" = $1 AND "doctorId" = $2 AND "appointmentDate" = $3 AND status != 'cancelled'`,
      [userId, doctorId, selectedDate]
    );

    if (duplicate.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'You already have an appointment with this doctor on the selected date',
      });
    }

    // FIX 10: Was "userId' — mismatched quotes caused a syntax error
    await client.query(
      `UPDATE "Slot" SET status = 'booked', "userId" = $1 WHERE id = $2`,
      [userId, slotId]
    );

    // FIX 11: Column list was wrapped in quotes making it a string literal, not columns
    // FIX 12: pg has no result.insertId — use RETURNING id instead
    const { rows: inserted } = await client.query(
      `INSERT INTO "Appointment" ("userId", "doctorId", "slotId", "slotTime", "appointmentDate", "reasonOfAppointment", status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING id`,
      [userId, doctorId, slotId, selectedTime, selectedDate, reasonOfAppointment || null]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully',
      data: { appointmentId: inserted[0].id },
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('bookMeeting error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    // FIX 6: pg uses client.release() not conn.release()
    client.release();
  }
};

// GET /api/user/meetings/slot/:doctorId
// Query params: ?date=YYYY-MM-DD (optional, defaults to today onwards)
export const getAvailableSlots = async (req, res) => {
  const { doctorId } = req.params;
  const { date } = req.query;

  const fromDate = date || new Date().toISOString().split('T')[0];

  try {
    const { rows: doctor } = await pool.query(
      `SELECT id, name, speciality, hospital FROM "Doctor" WHERE id = $1`,
      [doctorId]
    );

    if (doctor.length === 0) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    const now = new Date();
  const currentDate = now.toISOString().split('T')[0];
  const currentTime = now.toTimeString().slice(0, 5);

  const isUsingToday = fromDate === currentDate;
  const queryBase = `
       SELECT id, TO_CHAR("bookingDate", 'YYYY-MM-DD') AS "bookingDate", "slotTime", status, created_at
       FROM "Slot"
       WHERE "doctorId" = $1 AND status = 'available' AND "bookingDate" >= $2`;

  let query;
  let queryParams;

  if (isUsingToday) {
    query = `${queryBase} AND ("bookingDate" > $2 OR ("bookingDate" = $2 AND "slotTime" > $3::time)) ORDER BY "bookingDate" ASC, "slotTime" ASC`;
    queryParams = [doctorId, fromDate, currentTime];
  } else {
    query = `${queryBase} ORDER BY "bookingDate" ASC, "slotTime" ASC`;
    queryParams = [doctorId, fromDate];
  }

  const { rows: slots } = await pool.query(query, queryParams);

    res.status(200).json({
      success: true,
      doctor: doctor[0],
      availableSlots: slots,
      count: slots.length,
    });

  } catch (error) {
    console.error('getAvailableSlots error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
