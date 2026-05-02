/**
 * Integration tests — full HTTP request/response cycle against the real app
 * and the real database. Uses Supertest to drive Express without binding a port.
 *
 * Covers FR-1 (login), FR-3 (RBAC), FR-5/FR-6 (complaint creation),
 * FR-11 (workflow transitions), FR-19 (TRACKING audit row).
 *
 * Error response shape: { error: { code, message } } per api-spec.md §9.
 */

const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/config/db');

const ADMIN    = { email: 'admin@ministry.lb',    password: 'Admin123!'    };
const CLERK    = { email: 'clerk@ministry.lb',    password: 'Clerk123!'    };
const DIRECTOR = { email: 'director@ministry.lb', password: 'Director123!' };

let adminToken, clerkToken, directorToken;
let testComplaintId;

// Login all users ONCE before any test runs — fixes the "undefined token" issue
beforeAll(async () => {
  const a = await request(app).post('/api/v1/auth/login').send(ADMIN);
  adminToken = a.body.token;
  const c = await request(app).post('/api/v1/auth/login').send(CLERK);
  clerkToken = c.body.token;
  const d = await request(app).post('/api/v1/auth/login').send(DIRECTOR);
  directorToken = d.body.token;
});

afterAll(async () => {
  await db.end();
});

// =============================================================================
// Test 1 — Auth flow end-to-end
// =============================================================================
describe('Integration: Auth flow', () => {
  test('POST /auth/login with valid credentials returns a JWT', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send(DIRECTOR);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
  });

  test('POST /auth/login with wrong password returns 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: DIRECTOR.email, password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('GET /auth/me with the JWT returns the logged-in user', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${directorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.staff.role_name).toBe('Director');
  });
});

// =============================================================================
// Test 2 — Complaint creation → transition flow
// =============================================================================
describe('Integration: Complaint workflow', () => {
  test('Clerk creates a complaint, gets status=Submitted', async () => {
    const res = await request(app)
      .post('/api/v1/complaints')
      .set('Authorization', `Bearer ${clerkToken}`)
      .send({
        title: 'Integration test complaint',
        description: 'Created by Supertest at ' + new Date().toISOString(),
        priority: 'Medium',
        category: 'Municipal Issue',
        department_id: 1,
        type_id: 17,
      });

    expect(res.status).toBe(201);
    expect(res.body.status_name).toBe('Submitted');
    testComplaintId = res.body.complaint_id;
  });

  test('Director transitions complaint Submitted → Under Review and a TRACKING row is recorded', async () => {
    const res = await request(app)
      .post(`/api/v1/complaints/${testComplaintId}/transition`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ to_status_id: 2, comment: 'Starting review.' });

    expect(res.status).toBe(200);
    expect(res.body.from_status).toBe('Submitted');
    expect(res.body.to_status).toBe('Under Review');

    const tracking = await request(app)
      .get(`/api/v1/complaints/${testComplaintId}/tracking`)
      .set('Authorization', `Bearer ${directorToken}`);

    expect(tracking.status).toBe(200);
    expect(tracking.body.length).toBeGreaterThanOrEqual(2);
  });
});

// =============================================================================
// Test 3 — RBAC enforcement
// =============================================================================
describe('Integration: RBAC enforcement', () => {
  test('Clerk gets 403 when accessing admin route', async () => {
    const res = await request(app)
      .post('/api/v1/admin/staff')
      .set('Authorization', `Bearer ${clerkToken}`)
      .send({ full_name: 'Hacker', email: 'h@x.com', password: 'pw', role_id: 1 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
  });

  test('Request without Authorization header gets 401', async () => {
    const res = await request(app).get('/api/v1/complaints');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('NOT_AUTHENTICATED');
  });
});
