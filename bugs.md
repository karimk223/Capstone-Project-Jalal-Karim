# Bug Log

## Day 3 Manual QA — Jalal

| ID | Page | Description | Status |
|----|------|-------------|--------|
| B01 | Complaint Detail | Director cannot transition complaint status — returns "Complaint not found" due to RBAC filter in complaintsController.js | Fixed (Day 4) |
| B02 | Complaint Detail | Complaint detail page shows all dashes and status transition fails with "Complaint not found" for all roles when clicking from list | Fixed (Day 4) |

### Day 3 Notes
- B01 and B02 were the same root cause: GET /complaints/:id RBAC filter was too restrictive
- Fixed by Karim on Day 4 — query rewritten to be role-conditional (Clerks see own, Director/Minister/Admin see all)
- All other pages passed Day 3 manual QA

---

## Day 4 Manual QA — Jalal

| ID | Page | Description | Status |
|----|------|-------------|--------|
| B03 | Complaint Detail | No attachment upload button on existing complaint detail page — upload only available on the New Complaint form | Open |
| B04 | New Complaint Form | Citizen search/link field missing — cannot link a complaint to an existing citizen or create a new citizen inline | Open |
| B05 | Dashboard | Role-specific numeric count cards missing — FR-15 requires counts like "My open: 7", "My overdue: 2", "Pending approvals: 3" for each role | Open |
| B06 | Complaints List | Column sorting not implemented — column headers (Date, Priority, Deadline) are plain text, not clickable for sort — pagination works correctly | Open |
| B07 | Admin / Lookups | Lookup table management UI missing — Admin has no way to add, edit, or deprecate entries in COMPLAINT_TYPES, DEPARTMENTS, or REFERRAL_DESTINATIONS | Open |
| B08 | New Complaint Form | Referral destinations grouped dropdown not implemented — no grouped category display (MUNICIPALITY, UNION, COMMITTEE etc.) anywhere in the UI | Open |

### Day 4 Notes
- B01 and B02 confirmed fixed — verified under TC-11 (Director transition now works correctly)
- B03 blocks adding attachments to an existing complaint after creation — workaround is to attach on the New Complaint form
- B04 blocks TC-09 and TC-10 entirely — citizen API exists on the backend but no UI surface
- B05 is the most visible demo gap — dashboard looks empty without the count cards
- B06 is a partial failure — filtering by date range works, but sorting by clicking column headers does not
- B07 and B08 are related — both require a Lookups admin page that was not built in the MVP
- Priority for Day 5 fixes: B05 > B03 > B06 > B04 > B07 > B08
