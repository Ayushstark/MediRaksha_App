import { pool } from '../config/db.js';

const VALID_SLOT_STATUSES = new Set(['available', 'booked', 'blocked']);
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

const buildSlotRequests = ({ bookingDate, slotTime, startDate, endDate, weeklyRules, slotDurationMinutes }) => {
  if (bookingDate) {
    const normalizedDate = normalizeDate(bookingDate);
    const normalizedTime = slotTime || '09:00';

    if (!normalizedDate || !isValidTime(normalizedTime)) {
      return { error: 'bookingDate and slotTime must be valid.' };
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
    const params = [doctorId];
    const conditions = ['"doctorId" = $1'];

    if (status) {
      if (!VALID_SLOT_STATUSES.has(status)) {
        return res.status(400).json({ success: false, message: 'Invalid slot status.' });
      }
      params.push(status);
      conditions.push(`status = $${params.length}`);
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
      `SELECT id, "userId", "doctorId", "bookingDate", "slotTime", status, created_at, updated_at
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

    for (const slot of slots) {
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
         RETURNING id, "userId", "doctorId", "bookingDate", "slotTime", status, created_at, updated_at`,
        [doctorId, slot.bookingDate, slot.slotTime]
      );
      inserted.push(rows[0]);
    }

    res.status(201).json({
      success: true,
      message: `${inserted.length} slot${inserted.length === 1 ? '' : 's'} published successfully`,
      data: inserted,
      skippedCount: skipped.length
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
