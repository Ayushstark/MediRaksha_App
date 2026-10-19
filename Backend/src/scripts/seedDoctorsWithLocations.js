import { pool } from '../config/db.js';

export async function upgradeAndSeedDoctors() {
  try {
    console.log('Ensuring Doctor table columns for location and proximity...');
    await pool.query(`
      ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "latitude" NUMERIC(10, 7);
      ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "longitude" NUMERIC(10, 7);
      ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "address" TEXT;
      ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "experience" INTEGER DEFAULT 8;
      ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "rating" NUMERIC(3, 2) DEFAULT 4.8;
    `);

    // Sample comprehensive doctors with locations (covering major medical centers in Delhi/NCR & nearby)
    const doctors = [
      {
        name: 'Dr. Sarah Wilson',
        email: 'sarah.wilson@mediraksha.com',
        number: '+91 98765 43210',
        age: 38,
        gender: 'female',
        hospital: 'City General Hospital',
        speciality: 'General Physician',
        latitude: 28.5355,
        longitude: 77.2600,
        address: 'Okhla Phase III, Near IIIT Delhi, New Delhi',
        experience: 12,
        rating: 4.9,
      },
      {
        name: 'Dr. Rajesh Sharma',
        email: 'rajesh.sharma@mediraksha.com',
        number: '+91 98765 43211',
        age: 45,
        gender: 'male',
        hospital: 'Max Super Speciality Hospital',
        speciality: 'Cardiologist',
        latitude: 28.5284,
        longitude: 77.2185,
        address: '1, 2 Press Enclave Marg, Saket, New Delhi',
        experience: 18,
        rating: 4.95,
      },
      {
        name: 'Dr. Priya Nair',
        email: 'priya.nair@mediraksha.com',
        number: '+91 98765 43212',
        age: 35,
        gender: 'female',
        hospital: 'Rainbow Children\'s Hospital',
        speciality: 'Pediatrics',
        latitude: 28.5450,
        longitude: 77.2450,
        address: 'CR Park Road, Kalkaji, New Delhi',
        experience: 9,
        rating: 4.85,
      },
      {
        name: 'Dr. Suresh Narayan',
        email: 'suresh.narayan@mediraksha.com',
        number: '+91 98765 43213',
        age: 50,
        gender: 'male',
        hospital: 'Galaxy Super Hospital',
        speciality: 'Orthopedics',
        latitude: 28.5672,
        longitude: 77.2433,
        address: 'Lajpat Nagar IV, Ring Road, New Delhi',
        experience: 22,
        rating: 4.88,
      },
      {
        name: 'Dr. Ananya Roy',
        email: 'ananya.roy@mediraksha.com',
        number: '+91 98765 43214',
        age: 39,
        gender: 'female',
        hospital: 'Apollo Spectra Hospital',
        speciality: 'Neurologist',
        latitude: 28.5583,
        longitude: 77.2750,
        address: 'Mathura Road, Jasola, New Delhi',
        experience: 14,
        rating: 4.92,
      },
      {
        name: 'Dr. Amit Patel',
        email: 'amit.patel@mediraksha.com',
        number: '+91 98765 43215',
        age: 41,
        gender: 'male',
        hospital: 'Fortis Escorts Heart Institute',
        speciality: 'Cardiologist',
        latitude: 28.5601,
        longitude: 77.2789,
        address: 'Okhla Road, Sukhdev Vihar, New Delhi',
        experience: 16,
        rating: 4.96,
      },
      {
        name: 'Dr. Meera Sen',
        email: 'meera.sen@mediraksha.com',
        number: '+91 98765 43216',
        age: 36,
        gender: 'female',
        hospital: 'Skin & Aesthetics Care Clinic',
        speciality: 'Dermatology',
        latitude: 28.5400,
        longitude: 77.2500,
        address: 'Greater Kailash II, New Delhi',
        experience: 10,
        rating: 4.87,
      },
      {
        name: 'Dr. Vikram Malhotra',
        email: 'vikram.malhotra@mediraksha.com',
        number: '+91 98765 43217',
        age: 48,
        gender: 'male',
        hospital: 'AIIMS Care & Research Center',
        speciality: 'General Physician',
        latitude: 28.5670,
        longitude: 77.2100,
        address: 'Ansari Nagar East, New Delhi',
        experience: 20,
        rating: 4.98,
      }
    ];

    for (const doc of doctors) {
      const res = await pool.query(
        `INSERT INTO "Doctor" (name, email, number, age, gender, hospital, speciality, latitude, longitude, address, experience, rating, password)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, '$2b$10$abcdefghijklmnopqrstuu')
         ON CONFLICT (email) DO UPDATE SET
           name = EXCLUDED.name,
           number = EXCLUDED.number,
           age = EXCLUDED.age,
           gender = EXCLUDED.gender,
           hospital = EXCLUDED.hospital,
           speciality = EXCLUDED.speciality,
           latitude = EXCLUDED.latitude,
           longitude = EXCLUDED.longitude,
           address = EXCLUDED.address,
           experience = EXCLUDED.experience,
           rating = EXCLUDED.rating
         RETURNING id`,
        [
          doc.name, doc.email, doc.number, doc.age, doc.gender, doc.hospital,
          doc.speciality, doc.latitude, doc.longitude, doc.address, doc.experience, doc.rating
        ]
      );

      const doctorId = res.rows[0]?.id;
      if (doctorId) {
        // Add sample upcoming slots for today and next 3 days
        const today = new Date();
        for (let i = 0; i <= 3; i++) {
          const d = new Date(today);
          d.setDate(d.getDate() + i);
          const dateStr = d.toISOString().split('T')[0];
          const times = ['09:30', '11:00', '14:30', '16:00', '17:30'];
          for (const t of times) {
            await pool.query(
              `INSERT INTO "Slot" ("doctorId", "bookingDate", "slotTime", status)
               SELECT $1, $2, $3, 'available'::slot_status_enum
               WHERE NOT EXISTS (
                 SELECT 1 FROM "Slot" WHERE "doctorId" = $1 AND "bookingDate" = $2 AND "slotTime" = $3
               )`,
              [doctorId, dateStr, t]
            );
          }
        }
      }
    }

    // Also update any pre-existing doctors that had null coordinates with default coordinates near Okhla/Delhi
    await pool.query(`
      UPDATE "Doctor"
      SET latitude = 28.5355, longitude = 77.2600, address = 'Okhla, New Delhi'
      WHERE latitude IS NULL OR longitude IS NULL
    `);

    console.log('Doctors updated and seeded with location coordinates successfully.');
  } catch (err) {
    console.error('Error upgrading doctors:', err);
    throw err;
  }
}

if (process.argv[1]?.endsWith('seedDoctorsWithLocations.js')) {
  upgradeAndSeedDoctors().then(() => pool.end());
}
