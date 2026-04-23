# API Specification

**Project:** Smart Correspondence Tracking System
**Version:** 1.0 (MVP)
**Base URL:** `http://localhost:3001/api/v1` (development)

This document is the authoritative contract for the backend REST API. Every route maps to functional requirements in `requirements.md` and uses column names exactly as defined in `schema.sql`.

---

## Conventions

- **Format.** All request and response bodies are JSON (`Content-Type: application/json`), except file uploads (`multipart/form-data`).
- **Authentication.** All routes except `POST /auth/login` require a JWT in the `Authorization: Bearer <token>` header.
- **Errors.** Every error returns a JSON object: `{ "error": { "code": "STRING_CODE", "message": "Human-readable English" } }`. No raw SQL or framework errors leak to the client (addresses Gap 7).
- **Pagination.** List endpoints accept `?page=1&limit=20`; responses include `{ data, pagination: { page, limit, total, totalPages } }`.
- **Timestamps.** ISO 8601 strings in UTC (e.g., `"2026-04-23T09:15:00Z"`).
- **IDs.** All primary keys are integers matching the schema (no UUIDs in MVP).

## Common HTTP status codes

| Code | Meaning |
|---|---|
| 200 | Success |
| 201 | Created |
| 400 | Validation error (Joi failure) |
| 401 | Missing or invalid JWT |
| 403 | Authenticated but role not permitted (RBAC denial) |
| 404 | Resource not found |
| 409 | Conflict (e.g., duplicate email or national_id) |
| 500 | Internal server error |

---

## 1. Authentication

### `POST /auth/login`
**Auth:** Public
**Requirement:** FR-1, FR-2

**Request**
```json
{ "email": "karim@ministry.lb", "password": "plaintext_password" }
```

**Response 200**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "staff": { "staff_id": 1, "full_name": "Karim Khalil", "role_id": 2, "role_name": "Clerk" }
}
```

**Errors:** 400 (bad body), 401 (wrong credentials), 403 (`is_active = 0`)

### `POST /auth/logout`
**Auth:** Any authenticated user
Client discards the token. The server has no session state to invalidate in the MVP.

### `GET /auth/me`
**Auth:** Any authenticated user
Returns the currently logged-in staff record (no password_hash).

---

## 2. Complaints

### `POST /complaints` — Create complaint
**Auth:** Clerk, Director, Admin
**Requirement:** FR-5, FR-6

**Request**
```json
{
  "title": "Noise complaint — Hawsh district",
  "description": "Resident reports construction noise outside permitted hours.",
  "category": "Municipal Issue",
  "priority": "High",
  "department_id": 1,
  "type_id": 17,
  "citizen_id": 5,
  "completion_deadline": "2026-05-10",
  "file_number": "MIN-2026-0042"
}
```

**Response 201**
```json
{ "complaint_id": 123, "status_id": 1, "status_name": "Submitted", "submitted_at": "2026-04-23T09:15:00Z" }
```

Server behavior: inserts into `COMPLAINTS`, then inserts into `TRACKING` with `from_status_id = NULL`, `to_status_id = 1`, inside a single transaction (NFR-3).

### `GET /complaints` — List complaints (with filters)
**Auth:** Any authenticated user
**Requirement:** FR-16, FR-17

**Query parameters (all optional)**
`status_id`, `department_id`, `type_id`, `priority`, `date_from`, `date_to`, `citizen_national_id`, `page`, `limit`, `sort_by` (one of `submitted_at`, `completion_deadline`, `priority`), `sort_dir` (`asc` | `desc`).

Role-based filtering enforced server-side:
- **Clerk** → only complaints they submitted OR in their department
- **Director** → all complaints in their department
- **Minister / Admin** → all complaints

**Response 200**
```json
{
  "data": [
    {
      "complaint_id": 123,
      "title": "Noise complaint — Hawsh district",
      "status_name": "Submitted",
      "department_name": "Complaints Register",
      "priority": "High",
      "submitted_at": "2026-04-23T09:15:00Z",
      "submitted_by_name": "Karim Khalil"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 47, "totalPages": 3 }
}
```

### `GET /complaints/:id` — Get a single complaint
**Auth:** Any authenticated user (RBAC-filtered)
**Requirement:** FR-20

Returns the complaint with joined labels (status_name, department_name, type_name, citizen, submitted_by), its attachments, its approvals, and its full tracking timeline.

### `PATCH /complaints/:id` — Update complaint fields
**Auth:** Submitting Clerk (while status = Submitted), Director, Admin

Updatable fields: `title`, `description`, `priority`, `completion_deadline`, `department_id`, `type_id`, `citizen_id`. Status is **not** updatable here — use `POST /complaints/:id/transition`.

### `POST /complaints/:id/transition` — Change status
**Auth:** Director, Minister, Admin (depending on target status)
**Requirement:** FR-11, FR-12, FR-13, FR-14

**Request**
```json
{ "to_status_id": 3, "comment": "Needs Director sign-off." }
```

**Server behavior (transactional):**
1. Validate the transition: current `status_id` → `to_status_id` must be in the allowed-transitions map.
2. Insert into `APPROVALS` with `action` derived from the transition (`submitted`, `approved`, `rejected`, `returned`).
3. Insert into `TRACKING` with `from_status_id`, `to_status_id`, `notes = comment`, `changed_by = current user`.
4. Update `COMPLAINTS.status_id`. If the target status is `Resolved`, also set `resolved_at = NOW()`.

Rejections (`to_status_id = 5`) require a non-empty `comment`.

**Response 200**
```json
{ "complaint_id": 123, "from_status": "Under Review", "to_status": "Pending Approval", "changed_at": "2026-04-23T10:00:00Z" }
```

---

## 3. Attachments

### `POST /complaints/:id/attachments` — Upload a file
**Auth:** Clerk, Director, Admin
**Requirement:** FR-7, FR-8
**Content-Type:** `multipart/form-data`, field name `file`. Max size 10 MB. Accepted MIME types: `application/pdf`, `image/jpeg`, `image/png`.

Server stores the file under `/uploads/<uuid>.<ext>`, inserts into `ATTACHMENTS`, and flips `COMPLAINTS.is_scanned` to `1` if not already.

### `GET /complaints/:id/attachments` — List attachments
Returns `[{ attachment_id, file_name, mime_type, file_size_kb, uploaded_by_name, uploaded_at }]`.

### `GET /attachments/:id/download` — Download file
Streams the file with its original `file_name` in the `Content-Disposition` header.

### `DELETE /attachments/:id` — Remove an attachment
**Auth:** Admin only. Soft-delete is not in MVP; rows are hard-deleted. The attached file on disk is unlinked.

---

## 4. Citizens

### `POST /citizens` — Create a citizen
**Auth:** Clerk, Director, Admin
**Requirement:** FR-9, FR-10

**Request**
```json
{
  "national_id": "123456789",
  "full_name": "Ahmad Hassan",
  "phone_1": "03-123456",
  "email": "ahmad@example.com",
  "address": "Main Street, Jounieh"
}
```

**Response 201** — the created row. On duplicate `national_id`, returns 409 with message `"A citizen with this national ID already exists."`

### `GET /citizens?national_id=123456789` — Lookup by national ID
Returns a single citizen or 404.

### `GET /citizens?q=ahmad` — Search by name
Returns up to 20 matches, used by the complaint-creation form's citizen autocomplete.

---

## 5. Lookup tables (reference data)

All lookups filter out deprecated entries by default; pass `?include_deprecated=true` to include them (Admin only).

### `GET /lookups/roles`
Returns all `ROLES`.

### `GET /lookups/statuses`
Returns all `COMPLAINT_STATUS` rows including `is_terminal`.

### `GET /lookups/departments`
Returns active `DEPARTMENTS` (where `is_active = 1`).

### `GET /lookups/complaint-types`
Returns non-deprecated `COMPLAINT_TYPES`. When `canonical_id` is not null, the entry is a near-duplicate and is hidden from new-entry dropdowns.

### `GET /lookups/referral-destinations?category=UNION`
Returns destinations filtered by `category` (Gap 9). Without the filter, returns all non-deprecated destinations grouped by category in the response payload.

---

## 6. Admin — lookup-table management

All routes below require `role_id = 1` (Admin).

### `POST /admin/complaint-types` / `PATCH /admin/complaint-types/:id`
Create or update a complaint type. `PATCH` accepts `is_deprecated` to retire an entry.

### `POST /admin/referral-destinations` / `PATCH /admin/referral-destinations/:id`
Same pattern for referral destinations.

### `POST /admin/staff` — Create a staff account
**Requirement:** FR-1

**Request**
```json
{ "full_name": "Nour Zein", "email": "nour@ministry.lb", "password": "TempPass123!", "role_id": 3 }
```

Server hashes `password` with bcrypt before insert. The plain password is never stored or logged.

### `PATCH /admin/staff/:id`
Update name, role, or `is_active`. Passwords are changed through a separate `POST /auth/change-password` route to enforce the old-password check.

---

## 7. Dashboard

### `GET /dashboard/summary`
**Auth:** Any authenticated user
**Requirement:** FR-15

Returns role-appropriate counts:

```json
{
  "role": "Clerk",
  "counts": {
    "my_open": 7,
    "my_overdue": 2,
    "my_submitted_this_month": 15
  },
  "recent_activity": [ /* last 5 tracking entries relevant to the user */ ]
}
```

Directors additionally receive `department_pending_approvals`. Ministers receive system-wide aggregates.

---

## 8. Tracking / audit

### `GET /complaints/:id/tracking`
**Requirement:** FR-19, FR-20

Returns the full `TRACKING` timeline for a complaint, newest first:
```json
[
  {
    "tracking_id": 12,
    "from_status_name": "Under Review",
    "to_status_name": "Pending Approval",
    "changed_by_name": "Nour Zein",
    "notes": "Ready for Director sign-off.",
    "changed_at": "2026-04-23T10:00:00Z"
  }
]
```

There is no `PATCH` or `DELETE` on tracking rows — the table is append-only.

---

## 9. Error-code reference

| code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Joi validation rejected the request body |
| `INVALID_CREDENTIALS` | 401 | Email/password wrong |
| `TOKEN_EXPIRED` | 401 | JWT past its `exp` |
| `NOT_AUTHENTICATED` | 401 | Missing Authorization header |
| `FORBIDDEN_ROLE` | 403 | User role not permitted for this route |
| `NOT_FOUND` | 404 | Resource does not exist |
| `DUPLICATE_NATIONAL_ID` | 409 | `CITIZENS.national_id` already exists |
| `DUPLICATE_EMAIL` | 409 | `STAFF.email` already exists |
| `INVALID_TRANSITION` | 400 | Status transition not allowed |
| `TERMINAL_STATUS` | 400 | Attempt to transition out of a terminal status without Admin |
| `FILE_TOO_LARGE` | 400 | Upload exceeded size limit |
| `UNSUPPORTED_FILE_TYPE` | 400 | Upload MIME type not allowed |
| `INTERNAL_ERROR` | 500 | Unhandled server error |

---

## 10. Route summary (cheat sheet)

```
POST   /auth/login
POST   /auth/logout
GET    /auth/me

GET    /complaints
POST   /complaints
GET    /complaints/:id
PATCH  /complaints/:id
POST   /complaints/:id/transition
GET    /complaints/:id/tracking

POST   /complaints/:id/attachments
GET    /complaints/:id/attachments
GET    /attachments/:id/download
DELETE /attachments/:id

POST   /citizens
GET    /citizens

GET    /lookups/roles
GET    /lookups/statuses
GET    /lookups/departments
GET    /lookups/complaint-types
GET    /lookups/referral-destinations

POST   /admin/complaint-types
PATCH  /admin/complaint-types/:id
POST   /admin/referral-destinations
PATCH  /admin/referral-destinations/:id
POST   /admin/staff
PATCH  /admin/staff/:id

GET    /dashboard/summary
```
