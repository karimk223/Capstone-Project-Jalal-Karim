
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const db = require('../src/config/db');
const { hashPassword } = require('../src/utils/password');

const DEFAULT_PASSWORDS = {
  admin: 'Admin2026!',
  clerk: 'Clerk2026!',
  director: 'Director2026!',
  minister: 'Minister2026!',
};

function addDays(baseDate, days) {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function sqlDateTime(dateString, hour = '09:00:00') {
  return `${dateString} ${hour}`;
}

async function clearDatabase() {
  console.log('[seed] clearing old data...');

  await db.execute('SET FOREIGN_KEY_CHECKS = 0');

  const tables = [
    'TRACKING',
    'APPROVALS',
    'ATTACHMENTS',
    'COMPLAINTS',
    'CITIZENS',
    'REFERRAL_DESTINATIONS',
    'COMPLAINT_TYPES',
    'DEPARTMENTS',
    'COMPLAINT_STATUS',
    'STAFF',
    'ROLES',
  ];

  for (const table of tables) {
    await db.execute(`TRUNCATE TABLE ${table}`);
  }

  await db.execute('SET FOREIGN_KEY_CHECKS = 1');
}

async function seedRolesAndStatuses() {
  console.log('[seed] inserting roles and statuses...');

  await db.execute(`
    INSERT INTO ROLES (role_id, role_name) VALUES
      (1, 'Admin'),
      (2, 'Clerk'),
      (3, 'Director'),
      (4, 'Minister')
  `);

  await db.execute(`
    INSERT INTO COMPLAINT_STATUS (status_id, status_name, is_terminal) VALUES
      (1, 'Submitted',        0),
      (2, 'Under Review',     0),
      (3, 'Pending Approval', 0),
      (4, 'Approved',         0),
      (5, 'Rejected',         1),
      (6, 'Resolved',         1),
      (7, 'Closed',           1)
  `);
}

async function seedDepartments() {
  console.log('[seed] inserting Lebanese ministry departments...');

  const departments = [
    ['Central Complaints Registry', 'ش'],
    ['Beirut Governorate Municipal Affairs Office', 'BEI'],
    ['Mount Lebanon Municipal Affairs Office', 'ML'],
    ['North Lebanon Governorate Complaints Office', 'N'],
    ['South Lebanon Governorate Complaints Office', 'S'],
    ['Bekaa Governorate Complaints Office', 'B'],
    ['Nabatieh Governorate Complaints Office', 'NAB'],
    ['General Directorate for Political Affairs and Refugees', 'GDPR'],
  ];

  for (const [departmentName, penCode] of departments) {
    await db.execute(
      `INSERT INTO DEPARTMENTS (department_name, pen_code, is_active)
       VALUES (?, ?, 1)`,
      [departmentName, penCode]
    );
  }
}

async function seedComplaintTypes() {
  console.log('[seed] inserting realistic complaint types...');

  const types = [
    ['General Complaint', 0],
    ['Municipal Service Complaint', 0],
    ['Road Maintenance Request', 0],
    ['Waste Collection Complaint', 0],
    ['Street Lighting Complaint', 0],
    ['Water Drainage / Flooding Issue', 0],
    ['Building Permit Follow-up', 0],
    ['Noise and Public Disturbance Complaint', 0],
    ['Public Safety Concern', 0],
    ['Administrative Follow-up Request', 0],
    ['Municipal Police Referral', 0],
    ['Refugee / Residency Administrative Inquiry', 0],
  ];

  for (const [typeName, deprecated] of types) {
    await db.execute(
      `INSERT INTO COMPLAINT_TYPES (type_name, is_deprecated)
       VALUES (?, ?)`,
      [typeName, deprecated]
    );
  }
}

async function seedReferralDestinations() {
  console.log('[seed] inserting municipalities and referral destinations...');

  const destinations = [
    ['Municipality of Beirut', 'MUNICIPALITY', null],
    ['Municipality of Tripoli', 'MUNICIPALITY', null],
    ['Municipality of Jounieh', 'MUNICIPALITY', null],
    ['Municipality of Zahle', 'MUNICIPALITY', null],
    ['Municipality of Saida', 'MUNICIPALITY', null],
    ['Municipality of Tyre', 'MUNICIPALITY', null],
    ['Municipality of Baabda', 'MUNICIPALITY', null],
    ['Municipality of Aley', 'MUNICIPALITY', null],
    ['Municipality of Byblos', 'MUNICIPALITY', null],
    ['Municipality of Batroun', 'MUNICIPALITY', null],
    ['Municipality of Baalbek', 'MUNICIPALITY', null],
    ['Municipality of Nabatieh', 'MUNICIPALITY', null],
    ['Union of Municipalities of Keserwan-Ftouh', 'UNION', null],
    ['Union of Municipalities of Jabal Amel', 'UNION', null],
    ['Union of Municipalities of Central Bekaa', 'UNION', null],
    ['Union of Municipalities of Danniyeh', 'UNION', null],
    ['General Directorate for Political Affairs and Refugees', 'GOVERNMENT_DIRECTORATE', null],
    ['Internal Security Forces Liaison Office', 'GOVERNMENT_DIRECTORATE', null],
    ['Civil Defense Regional Office', 'GOVERNMENT_DIRECTORATE', null],
    ['Notify the Applicant', 'ACTION', null],
  ];

  for (const [name, category, contact] of destinations) {
    await db.execute(
      `INSERT INTO REFERRAL_DESTINATIONS
         (destination_name, category, personal_contact, is_deprecated)
       VALUES (?, ?, ?, 0)`,
      [name, category, contact]
    );
  }
}

async function seedStaff() {
  console.log('[seed] creating Lebanese staff accounts...');

  const staff = [
    {
      role_id: 1,
      full_name: 'Karim Mansour',
      email: 'admin@moim.gov.lb',
      password: DEFAULT_PASSWORDS.admin,
    },
    {
      role_id: 2,
      full_name: 'Rana Khoury',
      email: 'clerk.beirut@moim.gov.lb',
      password: DEFAULT_PASSWORDS.clerk,
    },
    {
      role_id: 2,
      full_name: 'Nadim Haddad',
      email: 'clerk.tripoli@moim.gov.lb',
      password: DEFAULT_PASSWORDS.clerk,
    },
    {
      role_id: 2,
      full_name: 'Maya Saade',
      email: 'clerk.bekaa@moim.gov.lb',
      password: DEFAULT_PASSWORDS.clerk,
    },
    {
      role_id: 3,
      full_name: 'Georges Nassar',
      email: 'director.municipalities@moim.gov.lb',
      password: DEFAULT_PASSWORDS.director,
    },
    {
      role_id: 3,
      full_name: 'Lina Barakat',
      email: 'director.political@moim.gov.lb',
      password: DEFAULT_PASSWORDS.director,
    },
    {
      role_id: 4,
      full_name: 'Fadi Rahme',
      email: 'minister@moim.gov.lb',
      password: DEFAULT_PASSWORDS.minister,
    },
  ];

  const ids = {};

  for (const user of staff) {
    const passwordHash = await hashPassword(user.password);

    const [result] = await db.execute(
      `INSERT INTO STAFF (role_id, full_name, email, password_hash, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      [user.role_id, user.full_name, user.email, passwordHash]
    );

    ids[user.email] = result.insertId;
  }

  return ids;
}

async function seedCitizens() {
  console.log('[seed] creating Lebanese citizens...');

  const citizens = [
    ['198765432101', 'Ahmad Darwish', '70123456', null, 'ahmad.darwish@example.com', 'Tariq El Jdideh, Beirut'],
    ['199012345678', 'Mariam Khoury', '71111222', null, 'mariam.khoury@example.com', 'Furn El Chebbak, Baabda'],
    ['197856341209', 'Joseph Haddad', '03123456', null, 'joseph.haddad@example.com', 'Jounieh, Keserwan'],
    ['200145678901', 'Hiba Saleh', '76987654', null, 'hiba.saleh@example.com', 'Mina, Tripoli'],
    ['198334455667', 'Ali Hammoud', '70004567', null, 'ali.hammoud@example.com', 'Baalbek'],
    ['199923456789', 'Nour Saade', '78999000', null, 'nour.saade@example.com', 'Zahle'],
    ['197744556677', 'Samir Aoun', '03555777', null, 'samir.aoun@example.com', 'Byblos'],
    ['198811223344', 'Lea Tannous', '76123400', null, 'lea.tannous@example.com', 'Batroun'],
    ['199567890123', 'Hassan Fakhoury', '70777888', null, 'hassan.fakhoury@example.com', 'Saida'],
    ['200034567890', 'Yara Matar', '03999888', null, 'yara.matar@example.com', 'Tyre'],
    ['198222334455', 'Omar Karam', '71000999', null, 'omar.karam@example.com', 'Akkar'],
    ['199333444555', 'Samar Farah', '76666111', null, 'samar.farah@example.com', 'Nabatieh'],
  ];

  const ids = {};

  for (const [nationalId, fullName, phone1, phone2, email, address] of citizens) {
    const [result] = await db.execute(
      `INSERT INTO CITIZENS
         (national_id, full_name, phone_1, phone_2, email, address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nationalId, fullName, phone1, phone2, email, address]
    );

    ids[fullName] = result.insertId;
  }

  return ids;
}

async function createDemoAttachment(complaintId, uploadedBy, fileNumber, title) {
  const uploadsDir = path.resolve(process.cwd(), 'uploads', 'seed');
  fs.mkdirSync(uploadsDir, { recursive: true });

  const safeName = `${fileNumber}.pdf`.replace(/[^a-zA-Z0-9._-]/g, '_');
  const relativePath = `seed/${safeName}`;
  const absolutePath = path.join(uploadsDir, safeName);

  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 90 >>
stream
BT
/F1 12 Tf
72 720 Td
(Seed attachment for complaint ${complaintId}: ${title}) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000010 00000 n
0000000060 00000 n
0000000117 00000 n
0000000210 00000 n
trailer
<< /Root 1 0 R /Size 5 >>
startxref
350
%%EOF`;

  fs.writeFileSync(absolutePath, pdfContent, 'utf8');

  const sizeKb = Math.max(1, Math.ceil(fs.statSync(absolutePath).size / 1024));

  await db.execute(
    `INSERT INTO ATTACHMENTS
       (complaint_id, uploaded_by, file_name, file_path, mime_type, file_size_kb)
     VALUES (?, ?, ?, ?, 'application/pdf', ?)`,
    [complaintId, uploadedBy, `Supporting Document - ${fileNumber}.pdf`, relativePath, sizeKb]
  );

  await db.execute(
    `UPDATE COMPLAINTS SET is_scanned = 1 WHERE complaint_id = ?`,
    [complaintId]
  );
}

async function insertTracking(complaintId, changedBy, fromStatus, toStatus, notes, changedAt) {
  await db.execute(
    `INSERT INTO TRACKING
       (complaint_id, changed_by, from_status_id, to_status_id, notes, changed_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [complaintId, changedBy, fromStatus, toStatus, notes, changedAt]
  );
}

async function createComplaint({
  submittedBy,
  citizenId,
  statusId,
  departmentId,
  typeId,
  title,
  description,
  category,
  priority,
  fileNumber,
  submittedAt,
  deadline,
  resolvedAt,
}) {
  const [result] = await db.execute(
    `INSERT INTO COMPLAINTS
       (submitted_by, citizen_id, status_id, department_id, type_id,
        title, description, category, priority, file_number,
        completion_deadline, is_scanned, submitted_at, resolved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      submittedBy,
      citizenId || null,
      statusId,
      departmentId,
      typeId,
      title,
      description,
      category,
      priority,
      fileNumber,
      deadline || null,
      submittedAt,
      resolvedAt || null,
    ]
  );

  return result.insertId;
}

async function seedComplaints(staffIds, citizenIds) {
  console.log('[seed] creating realistic Lebanese complaints...');

  const clerkBeirut = staffIds['clerk.beirut@moim.gov.lb'];
  const clerkTripoli = staffIds['clerk.tripoli@moim.gov.lb'];
  const clerkBekaa = staffIds['clerk.bekaa@moim.gov.lb'];
  const directorMunicipalities = staffIds['director.municipalities@moim.gov.lb'];
  const directorPolitical = staffIds['director.political@moim.gov.lb'];
  const minister = staffIds['minister@moim.gov.lb'];

  const base = '2026-05-01';

  const complaints = [
    {
      citizen: 'Ahmad Darwish',
      submittedBy: clerkBeirut,
      statusId: 1,
      departmentId: 2,
      typeId: 2,
      title: 'Illegal dumping near residential building in Beirut',
      description:
        'Citizen reports repeated illegal dumping near a residential entrance in Tariq El Jdideh. Waste has remained for several days and is causing odor and health concerns.',
      category: 'Municipal Issue',
      priority: 'High',
      fileNumber: 'MIN-2026-BEI-0001',
      submittedAt: sqlDateTime(addDays(base, -13), '09:15:00'),
      deadline: addDays(base, 7),
      history: [
        [null, 1, 'Complaint submitted with supporting photos.', -13, '09:15:00', clerkBeirut],
      ],
    },
    {
      citizen: 'Mariam Khoury',
      submittedBy: clerkBeirut,
      statusId: 2,
      departmentId: 3,
      typeId: 3,
      title: 'Damaged road surface on Baabda internal road',
      description:
        'Large potholes are damaging vehicles and slowing traffic near a school entrance in Baabda. Citizen requested urgent municipal inspection.',
      category: 'Infrastructure',
      priority: 'Urgent',
      fileNumber: 'MIN-2026-ML-0002',
      submittedAt: sqlDateTime(addDays(base, -12), '10:20:00'),
      deadline: addDays(base, -2),
      history: [
        [null, 1, 'Complaint submitted.', -12, '10:20:00', clerkBeirut],
        [1, 2, 'Assigned for technical review by municipal affairs office.', -11, '11:05:00', clerkBeirut],
      ],
    },
    {
      citizen: 'Joseph Haddad',
      submittedBy: clerkBeirut,
      statusId: 3,
      departmentId: 3,
      typeId: 5,
      title: 'Street lighting outage on Jounieh coastal road',
      description:
        'Several streetlights are out near a busy pedestrian crossing. The citizen reported increased risk at night.',
      category: 'Public Safety',
      priority: 'High',
      fileNumber: 'MIN-2026-ML-0003',
      submittedAt: sqlDateTime(addDays(base, -10), '08:45:00'),
      deadline: addDays(base, 2),
      history: [
        [null, 1, 'Complaint submitted.', -10, '08:45:00', clerkBeirut],
        [1, 2, 'Reviewed and verified against municipality reports.', -9, '13:00:00', clerkBeirut],
        [2, 3, 'Forwarded for approval to authorize follow-up with municipality.', -8, '15:30:00', clerkBeirut],
      ],
    },
    {
      citizen: 'Hiba Saleh',
      submittedBy: clerkTripoli,
      statusId: 4,
      departmentId: 4,
      typeId: 6,
      title: 'Rainwater drainage overflow in Tripoli Mina',
      description:
        'Drainage channel overflowed during rainfall and blocked access to several shops. Citizen requested urgent cleaning and maintenance.',
      category: 'Infrastructure',
      priority: 'Urgent',
      fileNumber: 'MIN-2026-NOR-0004',
      submittedAt: sqlDateTime(addDays(base, -9), '09:40:00'),
      deadline: addDays(base, 1),
      decision: {
        approver: directorMunicipalities,
        action: 'approved',
        comment: 'Approved for urgent referral to the municipality and public works team.',
        day: -6,
        time: '14:20:00',
      },
      history: [
        [null, 1, 'Complaint submitted with flood photos.', -9, '09:40:00', clerkTripoli],
        [1, 2, 'Reviewed by regional complaints office.', -8, '10:10:00', clerkTripoli],
        [2, 3, 'Pending director approval.', -7, '12:45:00', clerkTripoli],
        [3, 4, 'Approved for urgent municipal referral.', -6, '14:20:00', directorMunicipalities],
      ],
    },
    {
      citizen: 'Ali Hammoud',
      submittedBy: clerkBekaa,
      statusId: 5,
      departmentId: 6,
      typeId: 7,
      title: 'Building permit follow-up in Baalbek',
      description:
        'Citizen requested intervention regarding a delayed building permit file. Submitted documents were incomplete according to the municipality.',
      category: 'Administrative Request',
      priority: 'Medium',
      fileNumber: 'MIN-2026-BEK-0005',
      submittedAt: sqlDateTime(addDays(base, -18), '11:00:00'),
      deadline: addDays(base, -4),
      decision: {
        approver: directorMunicipalities,
        action: 'rejected',
        comment: 'Rejected because required ownership and zoning documents are missing.',
        day: -14,
        time: '16:00:00',
      },
      history: [
        [null, 1, 'Complaint submitted.', -18, '11:00:00', clerkBekaa],
        [1, 2, 'Checked documents attached to the file.', -17, '10:00:00', clerkBekaa],
        [2, 3, 'Sent for director decision.', -15, '09:30:00', clerkBekaa],
        [3, 5, 'Rejected due to missing documents.', -14, '16:00:00', directorMunicipalities],
      ],
    },
    {
      citizen: 'Nour Saade',
      submittedBy: clerkBekaa,
      statusId: 6,
      departmentId: 6,
      typeId: 4,
      title: 'Missed waste collection in Zahle neighborhood',
      description:
        'Waste bins were not collected for more than one week in a residential street in Zahle. Municipality was notified and collection was completed.',
      category: 'Service Request',
      priority: 'High',
      fileNumber: 'MIN-2026-BEK-0006',
      submittedAt: sqlDateTime(addDays(base, -16), '08:30:00'),
      deadline: addDays(base, -7),
      resolvedAt: sqlDateTime(addDays(base, -5), '13:00:00'),
      decision: {
        approver: directorMunicipalities,
        action: 'approved',
        comment: 'Approved after municipality confirmed service completion.',
        day: -8,
        time: '12:15:00',
      },
      history: [
        [null, 1, 'Complaint submitted.', -16, '08:30:00', clerkBekaa],
        [1, 2, 'Verified with municipality contact.', -14, '09:30:00', clerkBekaa],
        [2, 3, 'Pending approval after municipal response.', -10, '11:20:00', clerkBekaa],
        [3, 4, 'Approved following municipality confirmation.', -8, '12:15:00', directorMunicipalities],
        [4, 6, 'Resolved after waste collection was completed.', -5, '13:00:00', clerkBekaa],
      ],
    },
    {
      citizen: 'Samir Aoun',
      submittedBy: clerkBeirut,
      statusId: 7,
      departmentId: 3,
      typeId: 8,
      title: 'Night construction noise in Byblos residential area',
      description:
        'Citizen reported repeated construction noise after permitted hours. Municipality issued a warning and the case was closed after follow-up.',
      category: 'Municipal Issue',
      priority: 'Medium',
      fileNumber: 'MIN-2026-ML-0007',
      submittedAt: sqlDateTime(addDays(base, -25), '14:10:00'),
      deadline: addDays(base, -12),
      resolvedAt: sqlDateTime(addDays(base, -8), '10:30:00'),
      decision: {
        approver: directorMunicipalities,
        action: 'approved',
        comment: 'Approved for municipal enforcement follow-up.',
        day: -18,
        time: '10:00:00',
      },
      history: [
        [null, 1, 'Complaint submitted.', -25, '14:10:00', clerkBeirut],
        [1, 2, 'Reviewed municipal police notes.', -22, '09:10:00', clerkBeirut],
        [2, 3, 'Sent to director for approval.', -20, '12:00:00', clerkBeirut],
        [3, 4, 'Approved for enforcement follow-up.', -18, '10:00:00', directorMunicipalities],
        [4, 6, 'Resolved after municipality issued warning.', -8, '10:30:00', clerkBeirut],
        [6, 7, 'Closed after citizen confirmed improvement.', -6, '15:00:00', clerkBeirut],
      ],
    },
    {
      citizen: 'Lea Tannous',
      submittedBy: clerkBeirut,
      statusId: 3,
      departmentId: 3,
      typeId: 9,
      title: 'Unsafe pedestrian crossing near Batroun school',
      description:
        'Citizen requested speed bumps and clearer pedestrian crossing signage near a school entrance.',
      category: 'Public Safety',
      priority: 'High',
      fileNumber: 'MIN-2026-ML-0008',
      submittedAt: sqlDateTime(addDays(base, -7), '09:55:00'),
      deadline: addDays(base, 5),
      history: [
        [null, 1, 'Complaint submitted.', -7, '09:55:00', clerkBeirut],
        [1, 2, 'Initial review completed.', -6, '11:30:00', clerkBeirut],
        [2, 3, 'Pending approval for referral to municipality and traffic committee.', -4, '15:40:00', clerkBeirut],
      ],
    },
    {
      citizen: 'Hassan Fakhoury',
      submittedBy: clerkTripoli,
      statusId: 4,
      departmentId: 5,
      typeId: 11,
      title: 'Municipal police response delay in Saida',
      description:
        'Citizen reported repeated delays in handling illegal parking obstruction near a commercial street.',
      category: 'Public Safety',
      priority: 'Medium',
      fileNumber: 'MIN-2026-SOU-0009',
      submittedAt: sqlDateTime(addDays(base, -11), '13:25:00'),
      deadline: addDays(base, 3),
      decision: {
        approver: minister,
        action: 'approved',
        comment: 'Approved for escalation to the concerned municipal police coordination office.',
        day: -3,
        time: '17:10:00',
      },
      history: [
        [null, 1, 'Complaint submitted.', -11, '13:25:00', clerkTripoli],
        [1, 2, 'Reviewed and prepared for escalation.', -8, '12:05:00', clerkTripoli],
        [2, 3, 'Pending ministerial approval due to repeated incidents.', -5, '09:45:00', clerkTripoli],
        [3, 4, 'Approved by ministerial office for escalation.', -3, '17:10:00', minister],
      ],
    },
    {
      citizen: 'Yara Matar',
      submittedBy: clerkTripoli,
      statusId: 2,
      departmentId: 5,
      typeId: 2,
      title: 'Public beach access obstruction in Tyre',
      description:
        'Citizen reports temporary barriers blocking access to a public beach path. The issue is under review with the municipality.',
      category: 'Citizen Services',
      priority: 'Medium',
      fileNumber: 'MIN-2026-SOU-0010',
      submittedAt: sqlDateTime(addDays(base, -4), '10:05:00'),
      deadline: addDays(base, 8),
      history: [
        [null, 1, 'Complaint submitted.', -4, '10:05:00', clerkTripoli],
        [1, 2, 'Under review with municipality contact.', -2, '14:00:00', clerkTripoli],
      ],
    },
    {
      citizen: 'Omar Karam',
      submittedBy: clerkTripoli,
      statusId: 1,
      departmentId: 4,
      typeId: 10,
      title: 'Administrative follow-up for municipal certificate in Akkar',
      description:
        'Citizen requested follow-up on a delayed municipal certificate needed for an official transaction.',
      category: 'Administrative Request',
      priority: 'Low',
      fileNumber: 'MIN-2026-NOR-0011',
      submittedAt: sqlDateTime(addDays(base, -1), '12:00:00'),
      deadline: addDays(base, 14),
      history: [
        [null, 1, 'Complaint submitted and file number generated.', -1, '12:00:00', clerkTripoli],
      ],
    },
    {
      citizen: 'Samar Farah',
      submittedBy: clerkBekaa,
      statusId: 5,
      departmentId: 7,
      typeId: 12,
      title: 'Residency administrative inquiry referred to wrong office',
      description:
        'Citizen reported that a residency-related administrative inquiry was referred to the wrong office. The file was rejected and must be resubmitted with correct documents.',
      category: 'Administrative Request',
      priority: 'Medium',
      fileNumber: 'MIN-2026-NAB-0012',
      submittedAt: sqlDateTime(addDays(base, -20), '09:00:00'),
      deadline: addDays(base, -6),
      decision: {
        approver: directorPolitical,
        action: 'rejected',
        comment: 'Rejected because the request belongs to a different directorate and missing supporting documents.',
        day: -12,
        time: '11:50:00',
      },
      history: [
        [null, 1, 'Complaint submitted.', -20, '09:00:00', clerkBekaa],
        [1, 2, 'Checked against directorate responsibilities.', -18, '10:30:00', clerkBekaa],
        [2, 3, 'Pending decision by political affairs directorate.', -14, '13:15:00', clerkBekaa],
        [3, 5, 'Rejected with instructions to resubmit correctly.', -12, '11:50:00', directorPolitical],
      ],
    },
  ];

  for (const c of complaints) {
    const complaintId = await createComplaint({
      submittedBy: c.submittedBy,
      citizenId: citizenIds[c.citizen],
      statusId: c.statusId,
      departmentId: c.departmentId,
      typeId: c.typeId,
      title: c.title,
      description: c.description,
      category: c.category,
      priority: c.priority,
      fileNumber: c.fileNumber,
      submittedAt: c.submittedAt,
      deadline: c.deadline,
      resolvedAt: c.resolvedAt || null,
    });

    for (const [fromStatus, toStatus, notes, dayOffset, time, actor] of c.history) {
      await insertTracking(
        complaintId,
        actor,
        fromStatus,
        toStatus,
        notes,
        sqlDateTime(addDays(base, dayOffset), time)
      );
    }

    if (c.decision) {
      await db.execute(
        `INSERT INTO APPROVALS
           (complaint_id, approver_id, action, comment, action_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          complaintId,
          c.decision.approver,
          c.decision.action,
          c.decision.comment,
          sqlDateTime(addDays(base, c.decision.day), c.decision.time),
        ]
      );
    }

    await createDemoAttachment(
      complaintId,
      c.submittedBy,
      c.fileNumber,
      c.title
    );
  }

  console.log(`  ✓ created ${complaints.length} complaints with tracking, decisions, and attachments`);
}

async function seed() {
  console.log('[seed] starting realistic Lebanese database reset...');

  try {
    await clearDatabase();

    await seedRolesAndStatuses();
    await seedDepartments();
    await seedComplaintTypes();
    await seedReferralDestinations();

    const staffIds = await seedStaff();
    const citizenIds = await seedCitizens();

    await seedComplaints(staffIds, citizenIds);

    console.log('\n[seed] ✅ database reset complete!');
    console.log(`
Login credentials:

Admin:
  admin@moim.gov.lb / ${DEFAULT_PASSWORDS.admin}

Clerks:
  clerk.beirut@moim.gov.lb / ${DEFAULT_PASSWORDS.clerk}
  clerk.tripoli@moim.gov.lb / ${DEFAULT_PASSWORDS.clerk}
  clerk.bekaa@moim.gov.lb / ${DEFAULT_PASSWORDS.clerk}

Directors:
  director.municipalities@moim.gov.lb / ${DEFAULT_PASSWORDS.director}
  director.political@moim.gov.lb / ${DEFAULT_PASSWORDS.director}

Minister:
  minister@moim.gov.lb / ${DEFAULT_PASSWORDS.minister}

Notes:
  - Old demo data was cleared.
  - New citizens use realistic Lebanese names and fake national IDs.
  - Complaints use Lebanese municipalities/regions and realistic issues.
  - Every complaint has a seeded PDF attachment.
  - Approved/rejected complaints have dynamic APPROVALS rows.
  - TRACKING contains a full status history for demo presentation.
`);

    process.exit(0);
  } catch (err) {
    console.error('[seed] ❌ error:', err);
    process.exit(1);
  }
}

seed();