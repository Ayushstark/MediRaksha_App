import pkg from 'pg';
import dotenv from 'dotenv';
import dns from 'dns';

dotenv.config();

// Fix for Node.js DNS resolution order on some platforms
if (dns && typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first'); 
}

const { Pool } = pkg;

const dbUrl = process.env.DB_URL || '';
const isLocalhost = !dbUrl || dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('database');

const pool = new Pool({
  connectionString: dbUrl || 'postgres://postgres:postgres@localhost:5432/mediraksha',
  ssl: isLocalhost ? false : {
    rejectUnauthorized: false
  },
  max: 20, // Max clients in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const connectDB = async () => {
  if (!process.env.DB_URL) {
    console.warn('Warning: DB_URL environment variable is not set. Database operations will fail until configured.');
    return;
  }

  try {
    const client = await pool.connect();
    console.log('PostgreSQL Connected Successfully to Cloud/Docker!');
    client.release();
    try {
      const { default: seed } = await import('../seed.js');
      await seed();
    } catch (seedErr) {
      console.warn('Seeding note:', seedErr.message);
    }
  } catch (err) {
    console.error('Error connecting to PostgreSQL database:', err.message);
    if (process.env.NODE_ENV === 'production') {
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    }
  }   
};

export { connectDB, pool };