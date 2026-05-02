# Coding Conventions

**Project:** Smart Correspondence Tracking System
**Applies to:** All code in the `Capstone-Project-Jalal-Karim` repository.

This document defines the style, structure, and commenting rules for the project. The goal is consistency across both authors and clear traceability between code, schema, and documented gaps.

---

## 1. General principles

- **Readability over cleverness.** This is an academic demonstration; prefer explicit, commented code that a TA can follow.
- **Trace decisions.** When a file, function, or component addresses a documented legacy gap, cite the gap number in a comment. Example:
  ```js
  // Addresses Gap 1 (no status field) by writing to TRACKING on every update.
  ```
- **Schema is truth.** Column names, types, and constraints match `schema.sql` exactly. No inventing columns.
- **No secrets in code.** All secrets (JWT secret, DB password) live in `.env`. `.env` is in `.gitignore`. A `.env.example` with placeholder values is committed.

## 2. Repository layout

```
Capstone-Project-Jalal-Karim/
├── schema.sql
├── requirements.md
├── api-spec.md
├── coding-conventions.md
├── .gitignore
├── .env.example
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── config/          # db.js, env.js
│   │   ├── middleware/      # auth.js, rbac.js, errorHandler.js, validate.js
│   │   ├── routes/          # auth.js, complaints.js, citizens.js, lookups.js, admin.js, dashboard.js
│   │   ├── controllers/     # one file per route file
│   │   ├── services/        # business logic (transitionComplaint, audit log writes)
│   │   ├── validators/      # Joi schemas, one per entity
│   │   ├── utils/           # helpers (hashPassword, signToken, etc.)
│   │   └── server.js        # entry point
│   └── uploads/             # attachment storage (gitignored)
└── frontend/
    ├── package.json
    └── src/
        ├── api/             # axios client + one file per resource
        ├── components/      # reusable UI components
        ├── pages/           # route-level views (Dashboard, ComplaintList, ComplaintDetail, Login, Admin)
        ├── hooks/           # custom React hooks (useAuth, usePagination)
        ├── i18n/            # react-i18next config + en.json (ar.json is Future Work)
        ├── context/         # AuthContext, etc.
        ├── utils/           # formatters, date helpers
        └── App.jsx
```

## 3. Naming conventions

| Item | Convention | Example |
|---|---|---|
| Database tables | UPPER_SNAKE_CASE | `COMPLAINT_STATUS` |
| Database columns | lower_snake_case | `submitted_at`, `status_id` |
| JavaScript variables & functions | camelCase | `getComplaintById`, `submittedAt` |
| React components | PascalCase | `ComplaintDetail`, `StatusBadge` |
| Files (components) | PascalCase.jsx | `ComplaintDetail.jsx` |
| Files (non-component JS) | camelCase.js | `authMiddleware.js`, `complaintService.js` |
| Constants | UPPER_SNAKE_CASE | `JWT_EXPIRY_HOURS` |
| Environment variables | UPPER_SNAKE_CASE | `DB_HOST`, `JWT_SECRET` |
| Git branches | `type/short-description` | `feat/complaint-transition`, `fix/login-validation` |
| Commit messages | Conventional Commits | `feat: add JWT auth middleware` |

**API-to-DB mapping.** The API layer converts between the two conventions at the edges:
- Incoming: `req.body.submittedAt` (camelCase from client) → `submitted_at` (snake_case for DB).
- Outgoing: `submitted_at` (from DB) → `submittedAt` (in JSON response).

A helper in `utils/caseMap.js` handles this so controllers stay clean.

## 4. Backend conventions (Node.js / Express)

### 4.1 File structure pattern

Each route file is thin and delegates to a controller:
```js
// routes/complaints.js
const router = require('express').Router();
const ctrl = require('../controllers/complaintsController');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const validate = require('../middleware/validate');
const schemas = require('../validators/complaintSchemas');

router.get('/', auth, ctrl.list);
router.post('/', auth, rbac(['Clerk', 'Director', 'Admin']), validate(schemas.create), ctrl.create);
router.post('/:id/transition', auth, rbac(['Director', 'Minister', 'Admin']), validate(schemas.transition), ctrl.transition);

module.exports = router;
```

### 4.2 SQL queries

- **Always parameterized.** Never concatenate user input.
  ```js
  // Good
  const [rows] = await db.execute(
    'SELECT * FROM COMPLAINTS WHERE complaint_id = ?',
    [complaintId]
  );

  // Never
  const [rows] = await db.execute(
    `SELECT * FROM COMPLAINTS WHERE complaint_id = ${complaintId}`  // SQL injection risk
  );
  ```
- **Use transactions for multi-table writes.** Anything that touches both `COMPLAINTS` and `TRACKING` runs in a single transaction (NFR-3).
- **JOINs are spelled out.** Prefer an explicit `JOIN` over an implicit comma-join. Always alias tables (`c` for complaints, `cs` for complaint_status) for readability.

### 4.3 Password handling

- Use `bcrypt` with cost 10. Store only `password_hash`. Never log or return the plain password or the hash.
  ```js
  const hash = await bcrypt.hash(plaintext, 10);
  const match = await bcrypt.compare(plaintext, user.password_hash);
  ```

### 4.4 JWT

- Sign with HS256 and a secret from `process.env.JWT_SECRET`. Expiry = 8 hours.
- Payload: `{ staff_id, role_id, role_name }`. Never include the password hash or email in the payload.

### 4.5 Validation (Joi)

One schema file per entity (`validators/complaintSchemas.js`). Every POST/PATCH route passes through `validate(schema)` middleware before hitting the controller. Schema fields derive from `schema.sql`:
- `NOT NULL` → `.required()`
- `VARCHAR(n)` → `.max(n)`
- `ENUM(...)` → `.valid(...)`

### 4.6 Error handling

- Controllers throw typed errors; a central `errorHandler.js` middleware formats the JSON response per `api-spec.md` §9.
- Never send `err.stack`, raw SQL, or framework messages to the client (addresses Gap 7).

### 4.7 Audit logging helper

All status changes go through `services/trackingService.js`:
```js
// services/trackingService.js
// Addresses Gap 2: one TRACKING row per status change, always inside the
// same transaction as the COMPLAINTS.status_id UPDATE.
async function recordTransition(conn, { complaintId, changedBy, fromStatusId, toStatusId, notes }) {
  await conn.execute(
    `INSERT INTO TRACKING (complaint_id, changed_by, from_status_id, to_status_id, notes)
     VALUES (?, ?, ?, ?, ?)`,
    [complaintId, changedBy, fromStatusId, toStatusId, notes || null]
  );
}
```

## 5. Frontend conventions (React)

### 5.1 Components

- **Functional components + hooks only.** No class components.
- **One component per file.** File name matches component name.
- **Props destructured in the signature.**
  ```jsx
  export default function StatusBadge({ statusName, isTerminal }) {
    // ...
  }
  ```
- **Co-locate small styles** in a sibling `.module.css` file only when styling is non-trivial. Otherwise use utility classes.

### 5.2 State & data fetching

- Auth state in `AuthContext`. Never read JWT straight from `localStorage` inside components.
- Server state via a thin axios wrapper in `src/api/`. One file per resource (`complaints.js`, `citizens.js`).
- Loading and error states are always rendered — no component silently fails.

### 5.3 Internationalization

- Every user-facing string goes through `t('key')` from `react-i18next` (NFR-4).
  ```jsx
  <button>{t('complaints.submit')}</button>   // good
  <button>Submit Complaint</button>           // not allowed even in MVP
  ```
- All English strings live in `src/i18n/en.json`. Arabic (`ar.json`) is Future Work, but adding it must not require code changes — only a new JSON file.

### 5.4 Forms

- Field names match the API camelCase contract (`submittedAt`, not `submitted_at`).
- Validation happens client-side for UX (instant feedback) and server-side for correctness (source of truth).
- Submit buttons are disabled while the request is pending.

### 5.5 Accessibility

- All form inputs have associated `<label>`s.
- Interactive elements are keyboard-reachable.
- Color is never the only indicator of status — status badges pair color with a text label.

## 6. Comments

- **File headers.** Every non-trivial file starts with a one-line purpose comment. Files that address a specific gap cite it.
- **Function comments.** JSDoc on anything exported. Short inline comments for non-obvious logic, not for restating the code.
- **Gap citations.** When code exists because of a legacy-system gap, say so:
  ```js
  // Addresses Gap 4 (wildcard search): the user never types SQL LIKE patterns;
  // the backend builds a parameterized WHERE clause from structured filters.
  ```

## 7. Git workflow

- **Branches.** Work on feature branches, merge into `main` via pull requests.
- **Commits.** Conventional Commits format. Keep commits small and focused.
- **Pull requests.** Describe what changed, why, and which requirement(s) or gap(s) it addresses.
- **Do not commit.** `node_modules/`, `.env`, `uploads/`, any file with real passwords, any Ministry production data, and (per project policy) any legacy screenshots.

## 8. Testing (lightweight, MVP scope)

- **Backend.** Smoke tests with Jest + Supertest: one happy-path test per route group (auth, complaints, citizens). Full test coverage is out of MVP scope.
- **Frontend.** Manual testing against the running backend is acceptable for the demo. Component tests welcome but not required.
- **Manual DB tests.** See the test queries Karim ran in MySQL after loading `schema.sql`.

## 9. Review checklist (use before every merge)

- [ ] Column names in queries match `schema.sql` exactly.
- [ ] All SQL is parameterized.
- [ ] Any new route has an entry in `api-spec.md`.
- [ ] Any new feature has a matching `FR-n` in `requirements.md`.
- [ ] User-facing strings go through `t()`.
- [ ] No secrets in committed code.
- [ ] Gap citation comment present where applicable.
- [ ] ESLint and Prettier pass.
