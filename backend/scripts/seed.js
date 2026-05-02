/**
 * Seed data script for demo/testing.
 * Creates: 4 staff users (Admin, Clerk, Director, Minister),
 *          15 complaints in various statuses,
 *          Some approvals, some attachments (dummy records).
 *
 * Run: node scripts/seed.js
 * Idempotent: checks for existing data before inserting.
 */

require('dotenv').config();
const db = require('../src/config/db');
const { hashPassword } = require('../src/utils/password');

async function seed() {
  console.log('[seed] starting...');

  try {
    // ── STAFF ────────────────────────────────────────────────────────────
    console.log('[seed] creating staff...');
    
    const users = [
      { email: 'admin@ministry.lb', full_name: 'Ministry Admin', password: 'Admin123!', role_id: 1 },
      { email: 'clerk@ministry.lb', full_name: 'Jane Clerk', password: 'Clerk123!', role_id: 2 },
      { email: 'director@ministry.lb', full_name: 'John Director', password: 'Director123!', role_id: 3 },
      { email: 'minister@ministry.lb', full_name: 'Minister Ali', password: 'Minister123!', role_id: 4 },
    ];

    for (const user of users) {
      const [existing] = await db.execute(
        'SELECT staff_id FROM STAFF WHERE email = ?', [user.email]
      );
      if (existing.length === 0) {
        const passwordHash = await hashPassword(user.password);
        await db.execute(
          'INSERT INTO STAFF (email, password_hash, full_name, role_id) VALUES (?, ?, ?, ?)',
          [user.email, passwordHash, user.full_name, user.role_id]
        );
        console.log(`  ✓ created ${user.email}`);
      } else {
        console.log(`  → ${user.email} already exists`);
      }
    }

    // ── COMPLAINTS ───────────────────────────────────────────────────────
    console.log('[seed] creating complaints...');
    
    // Fetch staff IDs
    const [clerk] = await db.execute('SELECT staff_id FROM STAFF WHERE role_id = 2 LIMIT 1');
    const [director] = await db.execute('SELECT staff_id FROM STAFF WHERE role_id = 3 LIMIT 1');
    const clerkId = clerk[0].staff_id;
    const directorId = director[0].staff_id;

    const complaints = [
      { title: 'Noise complaint - construction site', description: 'Excessive noise from building site.', category: 'Municipal Issue', priority: 'High', status_id: 1, submittedBy: clerkId },
      { title: 'Pothole on main road', description: 'Large pothole causing accidents.', category: 'Municipal Issue', priority: 'Urgent', status_id: 2, submittedBy: clerkId },
      { title: 'Streetlight malfunction', description: 'Several lights out on Elm St.', category: 'Service Request', priority: 'Medium', status_id: 3, submittedBy: clerkId },
      { title: 'Water leak in public park', description: 'Broken pipe flooding playground.', category: 'Municipal Issue', priority: 'High', status_id: 4, submittedBy: clerkId },
      { title: 'Zoning variance request', description: 'Request to build extension.', category: 'Administrative Request', priority: 'Low', status_id: 5, submittedBy: clerkId },
      { title: 'Garbage collection missed', description: 'Trash not picked up for 2 weeks.', category: 'Service Request', priority: 'Medium', status_id: 6, submittedBy: clerkId },
      { title: 'Sidewalk repair needed', description: 'Cracked pavement hazard.', category: 'Municipal Issue', priority: 'Medium', status_id: 1, submittedBy: clerkId },
      { title: 'Park bench vandalism', description: 'Graffiti on public benches.', category: 'Municipal Issue', priority: 'Low', status_id: 2, submittedBy: clerkId },
      { title: 'Traffic light timing issue', description: 'Light stays red too long.', category: 'Municipal Issue', priority: 'Medium', status_id: 3, submittedBy: clerkId },
      { title: 'Dog park fence broken', description: 'Dogs escaping enclosure.', category: 'Municipal Issue', priority: 'High', status_id: 4, submittedBy: clerkId },
      { title: 'Building permit inquiry', description: 'Questions about permit process.', category: 'Administrative Request', priority: 'Low', status_id: 1, submittedBy: clerkId },
      { title: 'Snow removal complaint', description: 'Street not plowed after storm.', category: 'Service Request', priority: 'Urgent', status_id: 2, submittedBy: clerkId },
      { title: 'Playground equipment damage', description: 'Swing set broken.', category: 'Municipal Issue', priority: 'High', status_id: 6, submittedBy: clerkId },
      { title: 'Community center booking', description: 'Request to rent hall.', category: 'Service Request', priority: 'Low', status_id: 1, submittedBy: clerkId },
      { title: 'Fire hydrant obstruction', description: 'Parked car blocking access.', category: 'Municipal Issue', priority: 'Urgent', status_id: 3, submittedBy: clerkId },
    ];

    const complaintIds = [];
    for (const c of complaints) {
      const [result] = await db.execute(
        `INSERT INTO COMPLAINTS (submitted_by, status_id, title, description, category, priority, department_id, type_id, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, 17, NOW())`,
        [c.submittedBy, c.status_id, c.title, c.description, c.category, c.priority]
      );
      complaintIds.push(result.insertId);

      // Initial TRACKING entry (Gap 2)
      await db.execute(
        `INSERT INTO TRACKING (complaint_id, changed_by, from_status_id, to_status_id, notes)
         VALUES (?, ?, NULL, ?, 'Complaint submitted.')`,
        [result.insertId, c.submittedBy, c.status_id]
      );
    }
    console.log(`  ✓ created ${complaints.length} complaints`);

    // ── APPROVALS ────────────────────────────────────────────────────────
    console.log('[seed] creating approvals...');
    
    // Approve a few complaints
    const approvalsData = [
      { complaint_id: complaintIds[3], approver_id: directorId, action: 'approved', comment: 'Looks good, approved.' },
      { complaint_id: complaintIds[4], approver_id: directorId, action: 'rejected', comment: 'Insufficient documentation.' },
      { complaint_id: complaintIds[5], approver_id: directorId, action: 'approved', comment: 'Resolved successfully.' },
    ];

    for (const approval of approvalsData) {
      await db.execute(
        'INSERT INTO APPROVALS (complaint_id, approver_id, action, comment) VALUES (?, ?, ?, ?)',
        [approval.complaint_id, approval.approver_id, approval.action, approval.comment]
      );
    }
    console.log(`  ✓ created ${approvalsData.length} approvals`);

    // ── ATTACHMENTS ──────────────────────────────────────────────────────
    console.log('[seed] creating dummy attachments...');
    
    // Add dummy attachment records (no actual files on disk)
    const attachmentsData = [
      { complaint_id: complaintIds[0], uploaded_by: clerkId, file_name: 'noise_report.pdf', file_path: 'dummy-uuid-1.pdf', mime_type: 'application/pdf', file_size_kb: 234 },
      { complaint_id: complaintIds[1], uploaded_by: clerkId, file_name: 'pothole_photo.jpg', file_path: 'dummy-uuid-2.jpg', mime_type: 'image/jpeg', file_size_kb: 512 },
      { complaint_id: complaintIds[2], uploaded_by: clerkId, file_name: 'streetlight_map.png', file_path: 'dummy-uuid-3.png', mime_type: 'image/png', file_size_kb: 187 },
    ];

    for (const att of attachmentsData) {
      await db.execute(
        'INSERT INTO ATTACHMENTS (complaint_id, uploaded_by, file_name, file_path, mime_type, file_size_kb) VALUES (?, ?, ?, ?, ?, ?)',
        [att.complaint_id, att.uploaded_by, att.file_name, att.file_path, att.mime_type, att.file_size_kb]
      );
      
      // Flip is_scanned to 1 (FR-8)
      await db.execute(
        'UPDATE COMPLAINTS SET is_scanned = 1 WHERE complaint_id = ?',
        [att.complaint_id]
      );
    }
    console.log(`  ✓ created ${attachmentsData.length} dummy attachments`);

    console.log('[seed] ✅ done!');
    console.log(`
Summary:
  - 4 staff accounts (check emails/passwords above)
  - 15 complaints across statuses 1-6
  - 3 approvals (some approved, some rejected)
  - 3 dummy attachments

Login credentials:
  admin@ministry.lb / Admin123!
  clerk@ministry.lb / Clerk123!
  director@ministry.lb / Director123!
  minister@ministry.lb / Minister123!
`);

    process.exit(0);
  } catch (err) {
    console.error('[seed] ❌ error:', err);
    process.exit(1);
  }
}

seed();
