/**
 * MySQL connection pool.
 * We use mysql2's promise-based API so every query is an `await` call and all
 * parameters are passed as a second argument (addresses coding-conventions.md
 * §4.2 — "Always parameterized").
 *
 * The pool is exported as a singleton; every module that needs the DB requires
 * this file and uses `db.execute(sql, params)` or grabs a connection for a
 * transaction via `db.getConnection()`.
 */

const mysql = require('mysql2/promise');
const env = require('./env');

const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: 10,     // plenty for a demo; tune if we ever benchmark
  queueLimit: 0,
  // Enforce UTF-8 for Arabic migration data (pen codes like "ودب" live in DEPARTMENTS.pen_code)
  charset: 'utf8mb4',
  // Make DATETIME values arrive as ISO strings — avoids TZ weirdness with Date objects
  dateStrings: true,
});

// Ping on boot so we fail fast if MySQL is unreachable.
(async () => {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log(`[db] connected to ${env.db.database} at ${env.db.host}:${env.db.port}`);
  } catch (err) {
    console.error('[db] failed to connect:', err.message);
    // Don't process.exit here — server.js decides whether to die on boot.
  }
})();

module.exports = pool;
