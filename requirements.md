# Requirements Specification

**Project:** Smart Correspondence Tracking System
**Course:** CSC 599 Capstone
**Ministry:** Lebanese Ministry of Interior and Municipalities
**Authors:** Karim Khalil (202203461) & Jalal Al Arab (202302949)
**Date:** April 2026

---

## 1. Purpose

This document specifies the functional and non-functional requirements for a web-based complaint management system that replaces the Ministry's 24-year-old Arabic Oracle Forms application (Issue 9.0, 14-05-2002). Every requirement below is traceable to a specific gap documented in `legacy-system-analysis.md`, and every data requirement aligns with the tables and columns defined in `schema.sql`.

## 2. Scope

### 2.1 In scope (MVP)

- English-language web UI (React.js) with an i18n layer ready for Arabic
- REST API backend (Node.js / Express) with JWT authentication and role-based access control
- MySQL database per `schema.sql`
- Full complaint lifecycle: intake → referral → approval → resolution
- Document upload, audit trail, dashboards per role, structured search

### 2.2 Out of scope (Future Work)

- Arabic localization strings (architecture is i18n-ready; translations come later)
- Migration of the existing 2002 Oracle Forms data into the new schema
- SMS/email notifications to citizens
- Mobile native apps (the SPA is mobile-responsive; native is Future Work)
- Production hardening: WAF, CDN, virus scanning pipeline, pen-test remediation

## 3. User roles

The system has four roles, stored in the `ROLES` table and enforced server-side (addresses Gap 5).

| role_id | role_name | Capabilities |
|---|---|---|
| 1 | Admin | Full CRUD on all entities, user management, lookup-table maintenance |
| 2 | Clerk | Submit complaints, upload attachments, view own queue, update complaints in their department |
| 3 | Director | All Clerk capabilities + approve/reject complaints in their department, view department-wide reports |
| 4 | Minister | All Director capabilities + system-wide visibility and final approval authority |

## 4. Functional requirements

Each requirement is labeled `FR-n` and tagged with the gap(s) it addresses.

### 4.1 Authentication & Authorization

- **FR-1** Users authenticate with email + password; passwords are stored as bcrypt hashes in `STAFF.password_hash`. *(Gap 5)*
- **FR-2** Successful login returns a JWT containing `staff_id`, `role_id`, and `full_name`; the token expires after 8 hours. *(Gap 5)*
- **FR-3** Every protected API route verifies the JWT and checks the user's role against a required-role list; mismatches return HTTP 403. *(Gap 5)*
- **FR-4** Accounts can be disabled (`STAFF.is_active = 0`) without deletion, preserving audit-trail integrity. *(Gap 2)*

### 4.2 Complaint Intake

- **FR-5** A Clerk can create a new complaint record with title, description, category, priority, department, type, and an optional linked citizen. *(Gap 8)*
- **FR-6** On creation, the complaint is assigned `status_id = 1` ('Submitted') and an initial row is written to `TRACKING` with `from_status_id = NULL`. *(Gaps 1, 2)*
- **FR-7** A Clerk can attach one or more files (PDF, JPEG, PNG) to a complaint via drag-and-drop or file picker; each file creates a row in `ATTACHMENTS`. *(Gap 3)*
- **FR-8** `COMPLAINTS.is_scanned` flips to `1` automatically when at least one attachment exists; this replaces the legacy "Transaction Not Scanned" label. *(Gap 3)*

### 4.3 Citizen management

- **FR-9** A Clerk can link a complaint to an existing citizen by searching `national_id`, or create a new `CITIZENS` record in-line. *(Gap 10)*
- **FR-10** `CITIZENS.national_id` is unique; an attempt to create a duplicate returns a user-friendly error ("A citizen with this national ID already exists"), not a raw SQL error. *(Gaps 4, 10)*

### 4.4 Workflow & approval

- **FR-11** A Director can transition a complaint: Submitted → Under Review → Pending Approval → Approved/Rejected → Resolved → Closed. Each transition writes a row to both `APPROVALS` (action type) and `TRACKING` (status change). *(Gaps 1, 2, 6)*
- **FR-12** The system rejects invalid transitions (e.g., Submitted → Resolved) with a clear error message; valid transitions are defined in backend configuration, not hard-coded in the UI. *(Gap 6)*
- **FR-13** Rejecting a complaint requires a `comment` in `APPROVALS`; approving does not require a comment but allows one. *(Gap 6)*
- **FR-14** Terminal statuses (`is_terminal = 1`: Rejected, Resolved, Closed) prevent further automated transitions; only an Admin can reopen. *(Gap 6)*

### 4.5 Search & dashboards

- **FR-15** The main dashboard shows role-specific counts: for Clerks, their open complaints and overdue items; for Directors, pending approvals in their department; for Ministers, system-wide aggregate. *(Gap 6)*
- **FR-16** Complaint search supports filters on status, department, type, priority, date range, and citizen national ID — all as optional structured filters, never as SQL wildcards exposed to the user. *(Gaps 4, 8)*
- **FR-17** Search results are paginated (default 20 per page) and sortable by `submitted_at`, `completion_deadline`, or `priority`. *(Gap 4)*
- **FR-18** When a search returns no results, the UI explains why in plain English ("No complaints match your filters — try clearing the date range"), not with raw error codes. *(Gap 7)*

### 4.6 Audit trail

- **FR-19** Every status change inserts one row in `TRACKING` with `complaint_id`, `changed_by`, `from_status_id`, `to_status_id`, `notes`, `changed_at`; `TRACKING` rows are never updated or deleted. *(Gap 2)*
- **FR-20** A complaint detail page renders the full audit timeline in reverse chronological order, showing each status change with the staff member's name and timestamp. *(Gap 2)*

### 4.7 Lookup-table management

- **FR-21** Admins can add, edit, and deprecate entries in `COMPLAINT_TYPES`, `DEPARTMENTS`, and `REFERRAL_DESTINATIONS`. Deprecated entries are hidden from new-complaint dropdowns but retained for historical records. *(Gap 9)*
- **FR-22** `REFERRAL_DESTINATIONS` dropdowns in the UI group options by category (MUNICIPALITY, UNION, COMMITTEE, NGO, INTERNATIONAL_ORG, PRIVATE_COMPANY, GOVERNMENT_DIRECTORATE, ACTION) rather than presenting a flat list. *(Gap 9)*

## 5. Non-functional requirements

- **NFR-1 Security.** All passwords bcrypted (cost ≥ 10). All JWTs HMAC-SHA256 signed with a server-side secret loaded from `.env`. All SQL queries parameterized; no string concatenation.
- **NFR-2 Validation.** Every request body is validated with Joi against a schema derived from `schema.sql` column constraints (NOT NULL → required, VARCHAR(n) → max length, ENUM → allowed values).
- **NFR-3 Audit integrity.** `TRACKING` inserts happen in the same transaction as the `COMPLAINTS.status_id` update; a failure in either rolls both back.
- **NFR-4 Internationalization.** All user-facing strings routed through `react-i18next`; no hard-coded English in components. English-only in the MVP; Arabic is Future Work. *(Gap 7)*
- **NFR-5 Responsive design.** The UI works on desktop (≥ 1280 px), tablet (≥ 768 px), and mobile (≥ 375 px). *(Gap 11)*
- **NFR-6 Code quality.** Conventions per `coding-conventions.md`. ESLint + Prettier enforced on commit.
- **NFR-7 Demo scope.** This is an academic demonstration. Load testing, rate-limit tuning, CDN, production-hardened CORS, and virus scanning are explicitly out of scope.

## 6. Data requirements

All data requirements are authoritative per `schema.sql`. The application layer must not invent column names, alter constraints, or bypass foreign keys. Schema changes require updating `schema.sql` first, then the application code that depends on the change.

## 7. Traceability

| Gap | Requirement(s) | Schema table(s) |
|---|---|---|
| 1  | FR-6, FR-11      | COMPLAINT_STATUS, COMPLAINTS |
| 2  | FR-4, FR-19, FR-20 | TRACKING |
| 3  | FR-7, FR-8        | ATTACHMENTS |
| 4  | FR-10, FR-16, FR-17 | (API layer) |
| 5  | FR-1 through FR-4 | ROLES, STAFF |
| 6  | FR-11 through FR-15 | APPROVALS, COMPLAINT_STATUS |
| 7  | FR-18, NFR-4      | (frontend i18n) |
| 8  | FR-5, FR-16       | COMPLAINTS.department_id, DEPARTMENTS |
| 9  | FR-21, FR-22      | COMPLAINT_TYPES, REFERRAL_DESTINATIONS |
| 10 | FR-9, FR-10       | CITIZENS |
| 11 | NFR-5             | (responsive frontend) |
| 12 | Out of scope — Future Work (Oracle Forms data migration) | — |
