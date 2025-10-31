import dotenv from 'dotenv';
import fs from 'fs';
import mysql from 'mysql2';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
   ssl: {
    ca: fs.readFileSync('./ca.pem'),
    rejectUnauthorized: true
  }
});

const promisePool = pool.promise();

export { promisePool };
