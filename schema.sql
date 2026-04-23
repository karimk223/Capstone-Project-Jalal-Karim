-- =============================================================================
-- CSC 599 Capstone — Smart Correspondence Tracking System
-- Lebanese Ministry of Interior and Municipalities
-- Authors: Karim Khalil (202203461) & Jalal Al Arab (202302949)
-- =============================================================================
-- schema.sql
-- Run order: drop everything first (safe for dev resets), then create tables
-- in dependency order (referenced tables before referencing tables).
--
-- Legacy system gaps addressed by this schema:
--   Gap 1  → COMPLAINT_STATUS table: controlled, filterable status vocabulary
--   Gap 2  → TRACKING table: full audit trail per status change
--   Gap 3  → ATTACHMENTS table: digital-first file storage
--   Gap 5  → ROLES + STAFF tables: real server-side RBAC (not menu-hiding)
--   Gap 8  → COMPLAINTS.department_id FK: unified, not partitioned by year/pen
--   Gap 10 → CITIZENS table with national_id unique key; one record per person
-- =============================================================================

-- Use a dedicated database; change name to match your .env DB_NAME
CREATE DATABASE IF NOT EXISTS ministry_complaints
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ministry_complaints;

-- ──────────────────────────────────────────────────────────────────────────────
-- Drop tables in reverse dependency order so foreign keys don't block drops
-- ──────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS TRACKING;
DROP TABLE IF EXISTS APPROVALS;
DROP TABLE IF EXISTS ATTACHMENTS;
DROP TABLE IF EXISTS COMPLAINTS;
DROP TABLE IF EXISTS CITIZENS;
DROP TABLE IF EXISTS REFERRAL_DESTINATIONS;
DROP TABLE IF EXISTS COMPLAINT_TYPES;
DROP TABLE IF EXISTS DEPARTMENTS;
DROP TABLE IF EXISTS COMPLAINT_STATUS;
DROP TABLE IF EXISTS STAFF;
DROP TABLE IF EXISTS ROLES;

-- ──────────────────────────────────────────────────────────────────────────────
-- ROLES
-- Maps to the legacy system's menu-visibility-based role model, but implemented
-- as a proper server-side reference table.
-- Roles used in this system:
--   1 = Admin     (full access, user management)
--   2 = Clerk     (submits and views complaints — equivalent to legacy "staff")
--   3 = Director  (approves/rejects, sees all complaints in their department)
--   4 = Minister  (final approval authority, sees system-wide)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE ROLES (
  role_id   INT           NOT NULL AUTO_INCREMENT,
  role_name VARCHAR(100)  NOT NULL,

  PRIMARY KEY (role_id),
  UNIQUE KEY uq_role_name (role_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ──────────────────────────────────────────────────────────────────────────────
-- STAFF
-- Ministry employees who log into the system.
-- password_hash stores bcrypt output (never plain text).
-- role_id FK enforces server-side RBAC — the UI may hide buttons, but the
-- backend middleware checks this column on every request (Gap 5).
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE STAFF (
  staff_id      INT           NOT NULL AUTO_INCREMENT,
  role_id       INT           NOT NULL,
  full_name     VARCHAR(100)  NOT NULL,
  email         VARCHAR(100)  NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  is_active     TINYINT(1)    NOT NULL DEFAULT 1, -- soft-delete; 0 = disabled account
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (staff_id),
  UNIQUE KEY uq_staff_email (email),
  CONSTRAINT fk_staff_role
    FOREIGN KEY (role_id) REFERENCES ROLES (role_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ──────────────────────────────────────────────────────────────────────────────
-- COMPLAINT_STATUS
-- Controlled vocabulary for complaint lifecycle states.
-- Addresses Gap 1: the legacy Transaction Card had NO status field at all.
-- Statuses seeded below: Submitted, Under Review, Pending Approval,
--   Approved, Rejected, Resolved, Closed.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE COMPLAINT_STATUS (
  status_id   INT           NOT NULL AUTO_INCREMENT,
  status_name VARCHAR(100)  NOT NULL,
  is_terminal TINYINT(1)    NOT NULL DEFAULT 0, -- 1 = no further transitions expected

  PRIMARY KEY (status_id),
  UNIQUE KEY uq_status_name (status_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ──────────────────────────────────────────────────────────────────────────────
-- DEPARTMENTS
-- Replaces the legacy "pen" (قلم) system.
-- In the legacy system, data was physically partitioned by pen code (ودب, ش, etc.).
-- Here, department is simply an FK on COMPLAINTS — no session switching needed
-- (Gap 8).
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE DEPARTMENTS (
  department_id   INT           NOT NULL AUTO_INCREMENT,
  department_name VARCHAR(200)  NOT NULL,
  pen_code        VARCHAR(10)   NULL,  -- legacy code preserved for migration reference (e.g. "ودب")
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,

  PRIMARY KEY (department_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ──────────────────────────────────────────────────────────────────────────────
-- COMPLAINT_TYPES
-- Controlled vocabulary replacing the legacy transaction-type lookup table.
-- The legacy table had near-duplicate entries (Gap 9); this table includes a
-- canonical_id FK so duplicates can be merged without deleting history, and an
-- is_deprecated flag so retired types are hidden from new entries.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE COMPLAINT_TYPES (
  type_id       INT           NOT NULL AUTO_INCREMENT,
  type_name     VARCHAR(200)  NOT NULL,
  canonical_id  INT           NULL,     -- points to the preferred type if this is a legacy duplicate
  is_deprecated TINYINT(1)    NOT NULL DEFAULT 0,

  PRIMARY KEY (type_id),
  CONSTRAINT fk_complaint_type_canonical
    FOREIGN KEY (canonical_id) REFERENCES COMPLAINT_TYPES (type_id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ──────────────────────────────────────────────────────────────────────────────
-- REFERRAL_DESTINATIONS
-- Typed referral target list — addresses Gap 9.
-- The legacy system had a single flat list mixing municipalities, NGOs, private
-- companies, international orgs, and even action verbs (ابلاغ المستدعي).
-- Here each destination has a category ENUM for filtering and reporting.
-- personal_contact stores the contact name separately (not concatenated into the
-- org name as in the legacy data).
-- is_deprecated hides stale entries (e.g. GTZ → now GIZ) without deleting history.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE REFERRAL_DESTINATIONS (
  destination_id   INT           NOT NULL AUTO_INCREMENT,
  destination_name VARCHAR(300)  NOT NULL,
  category         ENUM(
                     'MUNICIPALITY',
                     'UNION',
                     'COMMITTEE',
                     'NGO',
                     'INTERNATIONAL_ORG',
                     'PRIVATE_COMPANY',
                     'GOVERNMENT_DIRECTORATE',
                     'ACTION'          -- e.g. "Notify the Applicant"
                   )             NOT NULL,
  personal_contact VARCHAR(200)  NULL,  -- separated from org name (Gap 9)
  is_deprecated    TINYINT(1)    NOT NULL DEFAULT 0,

  PRIMARY KEY (destination_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ──────────────────────────────────────────────────────────────────────────────
-- CITIZENS
-- Applicants / sources who file complaints.
-- Addresses Gap 10: the legacy applicant record had only 5 unvalidated fields
-- and no national ID. Here national_id is a UNIQUE key, ensuring one person =
-- one record. All complaints FK back to this table.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE CITIZENS (
  citizen_id    INT           NOT NULL AUTO_INCREMENT,
  national_id   VARCHAR(20)   NOT NULL,  -- Lebanese national ID number (unique)
  full_name     VARCHAR(200)  NOT NULL,
  phone_1       VARCHAR(20)   NULL,
  phone_2       VARCHAR(20)   NULL,
  email         VARCHAR(100)  NULL,
  address       VARCHAR(500)  NULL,      -- still a single field for now; can be normalized later
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (citizen_id),
  UNIQUE KEY uq_citizen_national_id (national_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ──────────────────────────────────────────────────────────────────────────────
-- COMPLAINTS
-- Core entity — the "Transaction Card" (بطاقة المعاملة) of the legacy system,
-- redesigned with a proper status FK (Gap 1), department FK (Gap 8), citizen FK
-- (Gap 10), and a completion_deadline stored as an actual DATE not a free-text
-- "number of days" (Gap 12 / legacy-12 observation).
-- submitted_by → STAFF (the clerk who entered the complaint)
-- citizen_id   → CITIZENS (the person the complaint is about / filed by)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE COMPLAINTS (
  complaint_id        INT           NOT NULL AUTO_INCREMENT,
  submitted_by        INT           NOT NULL,  -- FK → STAFF
  citizen_id          INT           NULL,       -- FK → CITIZENS (nullable: may not always be citizen)
  status_id           INT           NOT NULL,  -- FK → COMPLAINT_STATUS (Gap 1)
  department_id       INT           NULL,       -- FK → DEPARTMENTS (replaces "pen" selection, Gap 8)
  type_id             INT           NULL,       -- FK → COMPLAINT_TYPES
  title               VARCHAR(200)  NOT NULL,
  description         TEXT          NOT NULL,
  category            VARCHAR(100)  NOT NULL,
  priority            ENUM('Low','Medium','High','Urgent') NOT NULL DEFAULT 'Medium',
  file_number         VARCHAR(50)   NULL,       -- manual reference number if needed
  completion_deadline DATE          NULL,       -- actual date, not "N days" in a free-text box
  is_scanned          TINYINT(1)    NOT NULL DEFAULT 0, -- replaces "Transaction Not Scanned" label
  for_archiving       TINYINT(1)    NOT NULL DEFAULT 0,
  submitted_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at         DATETIME      NULL,

  PRIMARY KEY (complaint_id),
  CONSTRAINT fk_complaint_staff
    FOREIGN KEY (submitted_by) REFERENCES STAFF (staff_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_complaint_citizen
    FOREIGN KEY (citizen_id) REFERENCES CITIZENS (citizen_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_complaint_status
    FOREIGN KEY (status_id) REFERENCES COMPLAINT_STATUS (status_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_complaint_department
    FOREIGN KEY (department_id) REFERENCES DEPARTMENTS (department_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_complaint_type
    FOREIGN KEY (type_id) REFERENCES COMPLAINT_TYPES (type_id)
    ON UPDATE CASCADE ON DELETE SET NULL,

  -- Index columns that will appear in WHERE clauses / ORDER BY frequently
  INDEX idx_complaint_status   (status_id),
  INDEX idx_complaint_dept     (department_id),
  INDEX idx_complaint_submitted(submitted_at),
  INDEX idx_complaint_deadline (completion_deadline)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ──────────────────────────────────────────────────────────────────────────────
-- APPROVALS
-- Records each approval action taken by a Director or Minister.
-- Addresses Gap 6 (workflow): the legacy system encoded workflow state implicitly
-- in the referral tab; here it is an explicit table with an ENUM action.
-- complaint_id + approver_id is not unique: the same approver could revisit a
-- complaint (e.g. request more info, then approve later).
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE APPROVALS (
  approval_id  INT   NOT NULL AUTO_INCREMENT,
  complaint_id INT   NOT NULL,
  approver_id  INT   NOT NULL,
  action       ENUM('submitted','approved','rejected','returned') NOT NULL,
  comment      TEXT  NULL,
  action_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (approval_id),
  CONSTRAINT fk_approval_complaint
    FOREIGN KEY (complaint_id) REFERENCES COMPLAINTS (complaint_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_approval_staff
    FOREIGN KEY (approver_id) REFERENCES STAFF (staff_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,

  INDEX idx_approval_complaint (complaint_id),
  INDEX idx_approval_approver  (approver_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ──────────────────────────────────────────────────────────────────────────────
-- ATTACHMENTS
-- Digital-first document storage — addresses Gap 3.
-- The legacy system's default state was "Transaction Not Scanned"; here uploading
-- a file is a first-class action, not an afterthought.
-- file_path stores the server-side path (or S3 key in future).
-- mime_type lets the frontend decide how to preview/display the file.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE ATTACHMENTS (
  attachment_id INT           NOT NULL AUTO_INCREMENT,
  complaint_id  INT           NOT NULL,
  uploaded_by   INT           NOT NULL,  -- FK → STAFF
  file_name     VARCHAR(255)  NOT NULL,  -- original filename shown to user
  file_path     VARCHAR(255)  NOT NULL,  -- server path or storage key (UUID-based, Gap 3)
  mime_type     VARCHAR(100)  NULL,
  file_size_kb  INT           NULL,
  uploaded_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (attachment_id),
  CONSTRAINT fk_attachment_complaint
    FOREIGN KEY (complaint_id) REFERENCES COMPLAINTS (complaint_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_attachment_staff
    FOREIGN KEY (uploaded_by) REFERENCES STAFF (staff_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,

  INDEX idx_attachment_complaint (complaint_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ──────────────────────────────────────────────────────────────────────────────
-- TRACKING
-- Append-only audit log — addresses Gap 2.
-- One row is inserted on EVERY status change; rows are never updated or deleted.
-- This gives a full, timestamped, user-attributed history for every complaint.
-- from_status_id may be NULL for the initial "Submitted" entry (no prior state).
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE TRACKING (
  tracking_id    INT      NOT NULL AUTO_INCREMENT,
  complaint_id   INT      NOT NULL,
  changed_by     INT      NOT NULL,  -- FK → STAFF (who made the change)
  from_status_id INT      NULL,      -- NULL on first transition (Gap 2)
  to_status_id   INT      NOT NULL,
  notes          TEXT     NULL,      -- optional comment recorded with the transition
  changed_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (tracking_id),
  CONSTRAINT fk_tracking_complaint
    FOREIGN KEY (complaint_id) REFERENCES COMPLAINTS (complaint_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_tracking_staff
    FOREIGN KEY (changed_by) REFERENCES STAFF (staff_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_tracking_from_status
    FOREIGN KEY (from_status_id) REFERENCES COMPLAINT_STATUS (status_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_tracking_to_status
    FOREIGN KEY (to_status_id) REFERENCES COMPLAINT_STATUS (status_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,

  INDEX idx_tracking_complaint (complaint_id),
  INDEX idx_tracking_changed_at (changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =============================================================================
-- SEED DATA
-- Populates lookup / reference tables needed before any application code runs.
-- Application-level seed data (demo users, sample complaints) lives in seed.js.
-- =============================================================================

-- ── ROLES ────────────────────────────────────────────────────────────────────
INSERT INTO ROLES (role_name) VALUES
  ('Admin'),      -- role_id = 1
  ('Clerk'),      -- role_id = 2
  ('Director'),   -- role_id = 3
  ('Minister');   -- role_id = 4

-- ── COMPLAINT_STATUS ─────────────────────────────────────────────────────────
-- Ordered to mirror the workflow: Submitted → Under Review → Pending Approval
-- → Approved / Rejected → Resolved → Closed.
-- is_terminal = 1 means the system treats these as final states (no further
-- automated transitions, though an admin can reopen manually).
INSERT INTO COMPLAINT_STATUS (status_name, is_terminal) VALUES
  ('Submitted',        0),   -- status_id = 1 — default when a clerk creates a complaint
  ('Under Review',     0),   -- status_id = 2 — clerk or director is actively working it
  ('Pending Approval', 0),   -- status_id = 3 — waiting for Director / Minister sign-off
  ('Approved',         0),   -- status_id = 4 — approved, moving to issuance
  ('Rejected',         1),   -- status_id = 5 — terminal: complaint denied
  ('Resolved',         1),   -- status_id = 6 — terminal: successfully resolved
  ('Closed',           1);   -- status_id = 7 — terminal: administratively closed

-- ── DEPARTMENTS ──────────────────────────────────────────────────────────────
-- Seeded from the legacy pen codes observed in the screenshots.
INSERT INTO DEPARTMENTS (department_name, pen_code) VALUES
  ('Complaints Register',                              'ش'),   -- سجل الشكاوى
  ('Outgoing Letters Register',                        'ص.م'), -- سجل الكتب الصادرة
  ('Decisions Register',                               'ق'),   -- سجل القرارات
  ('Shared Administrative Directorate',                'ودب'), -- قلم المديرية الإدارية المشتركة
  ('General Directorate for Political Affairs and Refugees', NULL);

-- ── COMPLAINT_TYPES ──────────────────────────────────────────────────────────
-- Sampled from legacy-13 (the transaction-type lookup list).
-- Near-duplicates from the legacy system are included with canonical_id pointing
-- to the preferred entry, so old records are preserved but new entries use the
-- canonical type (Gap 9). canonical_id is set in a second pass below.
INSERT INTO COMPLAINT_TYPES (type_name, is_deprecated) VALUES
  ('Announcement of Vacant Position',       0),  -- type_id = 1  (canonical)
  ('Announcement of Association Founding',  0),  -- type_id = 2
  ('Notification of Death',                 0),  -- type_id = 3  (canonical — إعلام بوفاة)
  ('Announcement of Death',                 0),  -- type_id = 4  (near-dup → will point to 3)
  ('Announcement Regarding...',             0),  -- type_id = 5
  ('Notification of Enrollment',            0),  -- type_id = 6
  ('Announcement',                          0),  -- type_id = 7  (canonical — إعلان)
  ('Announcements',                         1),  -- type_id = 8  deprecated plural dup of 7
  ('Announcement of Resignation',           0),  -- type_id = 9
  ('Announcement of Cancellation',          0),  -- type_id = 10
  ('Announcement of Emergency State',       0),  -- type_id = 11
  ('Announcement of Competitive Exam',      0),  -- type_id = 12
  ('Announcement of Tender',                0),  -- type_id = 13
  ('Announcement of Job Opportunities',     0),  -- type_id = 14
  ('Announcement of Award or Win',          0),  -- type_id = 15
  ('Announcement of Future-Elected Mayor',  0),  -- type_id = 16
  ('General Complaint',                     0),  -- type_id = 17 — catch-all for new system
  ('Administrative Request',                0),  -- type_id = 18
  ('Municipal Issue',                       0),  -- type_id = 19
  ('Service Request',                       0);  -- type_id = 20

-- Point near-duplicate "Announcement of Death" (type_id=4) to canonical entry (type_id=3)
UPDATE COMPLAINT_TYPES SET canonical_id = 3 WHERE type_id = 4;
-- Point deprecated plural "Announcements" (type_id=8) to canonical "Announcement" (type_id=7)
UPDATE COMPLAINT_TYPES SET canonical_id = 7 WHERE type_id = 8;

-- ── REFERRAL_DESTINATIONS ────────────────────────────────────────────────────
-- Sampled from legacy-15 (the full referral destination list).
-- Each entry is categorized (Gap 9). Outdated entries are marked deprecated.
INSERT INTO REFERRAL_DESTINATIONS (destination_name, category, personal_contact, is_deprecated) VALUES
  ('Disciplinary Committee for Municipalities – Government Commission', 'COMMITTEE',              NULL,              0),
  ('Disciplinary Committee for Municipalities – Wisdom Presidency',     'COMMITTEE',              NULL,              0),
  ('Municipality of Hawsh',                                              'MUNICIPALITY',           NULL,              0),
  ('Association of Mediterranean Chambers',                              'NGO',                   'Diana Qabbita',   0),
  ('B.B General Trading & Construction',                                 'PRIVATE_COMPANY',        NULL,              0),
  ('GTZ Program Coordination Office',                                    'INTERNATIONAL_ORG',      NULL,              1), -- deprecated: GTZ renamed to GIZ in 2011
  ('GIZ (Deutsche Gesellschaft für Internationale Zusammenarbeit)',      'INTERNATIONAL_ORG',      NULL,              0), -- replacement entry
  ('SISSAF Project',                                                     'NGO',                    NULL,              0),
  ('UN-Habitat',                                                         'INTERNATIONAL_ORG',      NULL,              0),
  ('Notify the Applicant',                                               'ACTION',                 NULL,              0), -- ابلاغ المستدعي
  ('Union of Dennieh',                                                   'UNION',                  NULL,              0),
  ('Union of Lebanese Retirees in Lebanon',                              'UNION',                  NULL,              0),
  ('Union of Municipalities – Apple Region',                             'UNION',                  NULL,              0),
  ('Union of Municipalities – Southern Kharroub',                        'UNION',                  NULL,              0),
  ('Union of Municipalities – Northern Kharroub',                        'UNION',                  NULL,              0),
  ('Union of Municipalities – Al-Buhaira',                               'UNION',                  NULL,              0),
  ('Union of Municipalities – Central Bekaa',                            'UNION',                  NULL,              0),
  ('Union of Municipalities – Upper Jurd / Bhamdoun',                    'UNION',                  NULL,              0),
  ('Union of Municipalities – Jouma / Akkar',                            'UNION',                  NULL,              0),
  ('Union of Municipalities – Hasbani',                                  'UNION',                  NULL,              0),
  ('General Directorate for Political Affairs and Refugees',             'GOVERNMENT_DIRECTORATE', NULL,              0);
