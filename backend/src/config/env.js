/**
 * Loads environment variables from .env and exposes them as a typed object.
 * This is the single place the rest of the app reads configuration from — no
 * other file should touch `process.env` directly.
 *
 * See coding-conventions.md §1: "No secrets in code."
 */

require('dotenv').config();

// Fail fast if a required variable is missing. Better to crash on boot than
// to run with an undefined JWT_SECRET and produce unverifiable tokens.
const REQUIRED = ['DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    throw new Error(`Missing required env variable: ${key}. Copy .env.example to .env and fill it in.`);
  }
}

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',

  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
    bcryptCost: parseInt(process.env.BCRYPT_COST, 10) || 10,
  },

  uploads: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxSizeMb: parseInt(process.env.MAX_UPLOAD_SIZE_MB, 10) || 10,
  },
};
