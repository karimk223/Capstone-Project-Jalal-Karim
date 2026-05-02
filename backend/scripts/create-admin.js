/**
 * One-shot script to create the very first Admin account, because /admin/staff
 * requires an existing Admin to call it (chicken-and-egg).
 *
 * Usage:
 *   node scripts/create-admin.js
 *
 * Edit the values below before running. Run it once, log in, then create the
 * rest of your test users through the API.
 */

const db = require('../src/config/db');
const { hashPassword } = require('../src/utils/password');

async function main() {
  // ─── EDIT THESE BEFORE RUNNING ────────────────────────────────────────────
  const full_name = 'Karim Khalil';
  const email = 'karim@ministry.lb';
  const password = 'ChangeMe123!';
  const role_id = 1; // 1 = Admin (from ROLES seed)
  // ──────────────────────────────────────────────────────────────────────────

  try {
    const password_hash = await hashPassword(password);
    const [result] = await db.execute(
      `INSERT INTO STAFF (role_id, full_name, email, password_hash)
       VALUES (?, ?, ?, ?)`,
      [role_id, full_name, email, password_hash]
    );
    console.log(`[seed] created Admin staff_id=${result.insertId} email=${email}`);
    console.log(`[seed] password: ${password}  (change it after first login)`);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      console.error(`[seed] a staff row with email "${email}" already exists.`);
    } else {
      console.error('[seed] failed:', err.message);
    }
  } finally {
    // The mysql2 pool keeps Node alive; close it so the script exits.
    await db.end();
  }
}

main();
