import { pool } from '../config/db.js';

const VALID_SLOT_STATUSES = new Set(['available', 'booked', 'blocked', 'completed', 'missed']);
const VALID_WEEK_DAYS = new Set([0, 1, 2, 3, 4, 5, 6]);
const DEFAULT_SLOT_DURATION_MINUTES = 60;
const MAX_GENERATED_SLOTS = 500;

const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
};

const isValidTime = (value) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const parseTimeTo24H = (value) => {
  if (typeof value !== 'string') return null;
  const str = value.trim();
  const match24 = str.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
  if (match24) {
    const hours = parseInt(match24[1], 10).toString().padStart(2, '0');
    return `${hours}:${match24[2]}`;
  }
  const match12 = str.match(/^(\d{1,2}):([0-5]\d)\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = match12[2];
    const ampm = match12[3].toUpperCase();
    if (hours < 1 || hours > 12) return null;
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }
  if (str.includes('-')) {
    const startPart = str.split('-')[0].trim();
    return parseTimeTo24H(startPart);
  }
  return null;
};

const timeToMinutes = (value) => {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (value) => {
  const hours = Math.floor(value / 60).toString().padStart(2, '0');
  const minutes = (value % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const formatDate = (date) => date.toISOString().split('T')[0];

const buildSlotRequests = ({ bookingDate, slotTime, startTime, endTime, startDate, endDate, weeklyRules, slotDurationMinutes }) => {
  if (bookingDate) {
    const normalizedDate = normalizeDate(bookingDate);
    if (!normalizedDate) {
      return { error: 'bookingDate must be a valid date.' };
    }

    const effectiveStart = startTime || slotTime;
    const effectiveEnd = endTime;

    if (effectiveStart && effectiveEnd) {
      const parsedStart = parseTimeTo24H(effectiveStart);
      const parsedEnd = parseTimeTo24H(effectiveEnd);

      if (!parsedStart || !parsedEnd) {
        return { error: 'Start time and end time must be valid (HH:MM or HH:MM AM/PM).' };
      }

      const startMin = timeToMinutes(parsedStart);
      const endMin = timeToMinutes(parsedEnd);

      if (endMin <= startMin) {
        return { error: 'End time must be after start time.' };
      }

      const duration = Number(slotDurationMinutes || (endMin - startMin));
      const validDuration = Number.isInteger(duration) && duration >= 15 ? duration : (endMin - startMin);

      const generated = [];
      for (let min = startMin; min + validDuration <= endMin; min += validDuration) {
        generated.push({ bookingDate: normalizedDate, slotTime: minutesToTime(min) });
        if (generated.length > MAX_GENERATED_SLOTS) {
          return { error: `Too many slots generated. Limit is ${MAX_GENERATED_SLOTS}.` };
        }
      }

      if (generated.length === 0) {
        generated.push({ bookingDate: normalizedDate, slotTime: parsedStart });
      }

      return { slots: generated };
    }

    const parsedTime = parseTimeTo24H(slotTime || startTime);
    const normalizedTime = parsedTime || (isValidTime(slotTime || startTime) ? (slotTime || startTime) : '09:00');

    if (!isValidTime(normalizedTime)) {
      return { error: 'A valid slotTime or startTime is required.' };
    }

    return { slots: [{ bookingDate: normalizedDate, slotTime: normalizedTime }] };
  }

  const normalizedStart = normalizeDate(startDate);
  const normalizedEnd = normalizeDate(endDate);
  const duration = Number(slotDurationMinutes || DEFAULT_SLOT_DURATION_MINUTES);

  if (!normalizedStart || !normalizedEnd || !Array.isArray(weeklyRules) || weeklyRules.length === 0) {
    return { error: 'startDate, endDate, and weeklyRules are required.' };
  }

  if (new Date(`${normalizedEnd}T00:00:00Z`) < new Date(`${normalizedStart}T00:00:00Z`)) {
    return { error: 'endDate cannot be before startDate.' };
  }

  if (!Number.isInteger(duration) || duration < 15 || duration > 240) {
    return { error: 'slotDurationMinutes must be between 15 and 240.' };
  }

  const rules = new Map();
  for (const rule of weeklyRules) {
    const dayOfWeek = Number(rule.dayOfWeek);
    if (!VALID_WEEK_DAYS.has(dayOfWeek) || !isValidTime(rule.startTime) || !isValidTime(rule.endTime)) {
      return { error: 'Each weekly rule must have a valid dayOfWeek, startTime, and endTime.' };
    }

    const start = timeToMinutes(rule.startTime);
    const end = timeToMinutes(rule.endTime);
    if (end <= start) {
      return { error: 'Rule endTime must be after startTime.' };
    }

    rules.set(dayOfWeek, { start, end });
  }

  const generated = [];
  let cursor = new Date(`${normalizedStart}T00:00:00Z`);
  const last = new Date(`${normalizedEnd}T00:00:00Z`);

  while (cursor <= last) {
    const rule = rules.get(cursor.getUTCDay());
    if (rule) {
      for (let minutes = rule.start; minutes + duration <= rule.end; minutes += duration) {
        generated.push({ bookingDate: formatDate(cursor), slotTime: minutesToTime(minutes) });
        if (generated.length > MAX_GENERATED_SLOTS) {
          return { error: `Too many slots generated. Limit is ${MAX_GENERATED_SLOTS}.` };
        }
      }
    }
    cursor = addDays(cursor, 1);
  }

  if (generated.length === 0) {
    return { error: 'No slots were generated for the selected schedule.' };
  }

  return { slots: generated };
};

// GET /api/doctor/slot/all
export async function getAllSlots(req, res) {
  const doctorId = req.user.id;
  const { status, fromDate, toDate } = req.query;

  try {
    // Immediately remove passed unbooked slots from the database so they vanish completely
    await pool.query(
      `DELETE FROM "Slot"
       WHERE "doctorId" = $1 AND status = 'available'
         AND ("bookingDate" < CURRENT_DATE OR ("bookingDate" = CURRENT_DATE AND "slotTime"::time <= CURRENT_TIME))`,
      [doctorId]
    );

    // Sync slot status with completed and missed appointments
    await pool.query(
      `UPDATE "Slot" s
       SET status = 'completed', "updated_at" = NOW()
       FROM "Appointment" a
       WHERE s.id = a."slotId" AND s."doctorId" = $1 AND a.status = 'completed' AND s.status != 'completed'`,
      [doctorId]
    );

    await pool.query(
      `UPDATE "Slot" s
       SET status = 'missed', "updated_at" = NOW()
       FROM "Appointment" a
       WHERE s.id = a."slotId" AND s."doctorId" = $1 AND a.status = 'missed' AND s.status != 'missed'`,
      [doctorId]
    );

    const params = [doctorId];
    const conditions = ['"doctorId" = $1'];

    if (status) {
      if (!VALID_SLOT_STATUSES.has(status)) {
        return res.status(400).json({ success: false, message: 'Invalid slot status.' });
      }
      params.push(status);
      conditions.push(`status = $${params.length}`);
      if (status === 'available') {
        conditions.push(`("bookingDate" > CURRENT_DATE OR ("bookingDate" = CURRENT_DATE AND "slotTime"::time > CURRENT_TIME))`);
      }
    }

    if (fromDate) {
      const normalizedFromDate = normalizeDate(fromDate);
      if (!normalizedFromDate) {
        return res.status(400).json({ success: false, message: 'Invalid fromDate.' });
      }
      params.push(normalizedFromDate);
      conditions.push(`"bookingDate" >= $${params.length}`);
    }

    if (toDate) {
      const normalizedToDate = normalizeDate(toDate);
      if (!normalizedToDate) {
        return res.status(400).json({ success: false, message: 'Invalid toDate.' });
      }
      params.push(normalizedToDate);
      conditions.push(`"bookingDate" <= $${params.length}`);
    }

    const { rows } = await pool.query(
      `SELECT id, "userId", "doctorId", TO_CHAR("bookingDate", 'YYYY-MM-DD') AS "bookingDate", TO_CHAR("slotTime", 'HH24:MI') AS "slotTime", status, created_at, updated_at
       FROM "Slot"
       WHERE ${conditions.join(' AND ')}
       ORDER BY "bookingDate" ASC, "slotTime" ASC, id ASC`,
      params
    );

    res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('getAllSlots error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// POST /api/doctor/slot/publish
// Body: { bookingDate, slotTime } or { startDate, endDate, slotDurationMinutes, weeklyRules }
export async function addSlot(req, res) {
  const doctorId = req.user.id;
  const { slots, error } = buildSlotRequests(req.body);

  if (error) {
    return res.status(400).json({ success: false, message: error });
  }

  try {
    const inserted = [];
    const skipped = [];

    const now = new Date();
    const currentDateStr = now.toISOString().split('T')[0];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const isSlotInPast = (bDate, sTime) => {
      if (bDate < currentDateStr) return true;
      if (bDate > currentDateStr) return false;
      const [h, m] = sTime.split(':').map(Number);
      return (h * 60 + m) <= currentMinutes;
    };

    const futureSlots = slots.filter(slot => !isSlotInPast(slot.bookingDate, slot.slotTime));

    if (futureSlots.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot publish time slots that have already passed.',
      });
    }

    for (const slot of futureSlots) {
      const { rows: duplicate } = await pool.query(
        `SELECT id FROM "Slot"
         WHERE "doctorId" = $1 AND "bookingDate" = $2 AND "slotTime" = $3 AND status != 'blocked'`,
        [doctorId, slot.bookingDate, slot.slotTime]
      );

      if (duplicate.length > 0) {
        skipped.push(slot);
        continue;
      }

      const { rows } = await pool.query(
        `INSERT INTO "Slot" ("doctorId", "bookingDate", "slotTime", status)
         VALUES ($1, $2, $3, 'available')
         RETURNING id, "userId", "doctorId", TO_CHAR("bookingDate", 'YYYY-MM-DD') AS "bookingDate", TO_CHAR("slotTime", 'HH24:MI') AS "slotTime", status, created_at, updated_at`,
        [doctorId, slot.bookingDate, slot.slotTime]
      );
      inserted.push(rows[0]);
    }

    res.status(201).json({
      success: true,
      message: `${inserted.length} slot${inserted.length === 1 ? '' : 's'} published successfully`,
      data: inserted,
      skippedCount: skipped.length + (slots.length - futureSlots.length)
    });
  } catch (error) {
    console.error('addSlot error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// DELETE /api/doctor/slot/:id
export async function deleteSlotsByRange(req, res) {
  const doctorId = req.user.id;
  const { fromDate, toDate } = req.query;

  if (!fromDate || !toDate) {
    return res.status(400).json({ success: false, message: 'fromDate and toDate are required.' });
  }

  const normalizedFromDate = normalizeDate(fromDate);
  const normalizedToDate = normalizeDate(toDate);

  if (!normalizedFromDate || !normalizedToDate) {
    return res.status(400).json({ success: false, message: 'Invalid date range.' });
  }

  if (new Date(`${normalizedToDate}T00:00:00Z`) < new Date(`${normalizedFromDate}T00:00:00Z`)) {
    return res.status(400).json({ success: false, message: 'toDate cannot be earlier than fromDate.' });
  }

  try {
    const { rows: bookedRows } = await pool.query(
      `SELECT COUNT(*) AS "bookedCount"
       FROM "Slot"
       WHERE "doctorId" = $1
         AND "bookingDate" >= $2
         AND "bookingDate" <= $3
         AND status = 'booked'`,
      [doctorId, normalizedFromDate, normalizedToDate]
    );

    const bookedCount = Number(bookedRows[0]?.bookedCount || 0);

    const { rows: deletedRows } = await pool.query(
      `DELETE FROM "Slot"
       WHERE "doctorId" = $1
         AND "bookingDate" >= $2
         AND "bookingDate" <= $3
         AND status != 'booked'
       RETURNING id`,
      [doctorId, normalizedFromDate, normalizedToDate]
    );

    res.status(200).json({
      success: true,
      message: `Deleted ${deletedRows.length} slot${deletedRows.length === 1 ? '' : 's'} from the selected range.`,
      deletedCount: deletedRows.length,
      skippedBookedCount: bookedCount,
      fromDate: normalizedFromDate,
      toDate: normalizedToDate,
    });
  } catch (error) {
    console.error('deleteSlotsByRange error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

export async function deleteSlot(req, res) {
  const doctorId = req.user.id;
  const { id } = req.params;

  try {
    const { rows: slots } = await pool.query(
      `SELECT id, status FROM "Slot" WHERE id = $1 AND "doctorId" = $2`,
      [id, doctorId]
    );

    if (slots.length === 0) {
      return res.status(404).json({ success: false, message: 'Slot not found.' });
    }

    if (slots[0].status === 'booked') {
      return res.status(400).json({ success: false, message: 'Booked slots cannot be deleted.' });
    }

    await pool.query(`DELETE FROM "Slot" WHERE id = $1 AND "doctorId" = $2`, [id, doctorId]);

    res.status(200).json({
      success: true,
      message: 'Slot deleted successfully',
      deletedSlotId: id
    });
  } catch (error) {
    console.error('deleteSlot error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
