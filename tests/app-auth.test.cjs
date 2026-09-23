const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let handler;
let operations = [];
let currentRole = 'user';
const adminId = 'd8c53d9d-7501-419a-9598-a36861102510';
const childId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const reply = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
async function mockFetch(url, options = {}) {
  const address = new URL(url);
  operations.push({ path: address.pathname, method: options.method || 'GET' });
  if (address.pathname === '/auth/v1/user') return reply(200, { id: adminId });
  if (address.pathname === '/auth/v1/token') return reply(400, { error: 'invalid_grant' });
  if (address.pathname === '/rest/v1/app_users' && address.searchParams.get('select') === 'role') {
    const id = address.searchParams.get('id');
    return reply(200, [{ role: id === `eq.${childId}` ? 'user' : currentRole }]);
  }
  if (address.pathname === '/rest/v1/app_users' && address.searchParams.get('select')?.includes('created_at')) {
    return reply(200, [{ id: adminId, username: 'Admin', role: 'admin' }]);
  }
  if (address.pathname === '/rest/v1/app_users' && address.searchParams.get('select') === 'id') return reply(200, []);
  if (address.pathname === '/rest/v1/app_users' && options.method === 'POST') return reply(201, {});
  if (address.pathname === '/auth/v1/admin/users' && options.method === 'POST') return reply(200, { id: childId });
  if (address.pathname === `/auth/v1/admin/users/${childId}` && options.method === 'DELETE') return reply(200, {});
  return reply(200, []);
}
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../supabase/functions/pk-user-access/index.ts'), 'utf8'), {
  Deno: { env: { get(name) { return ({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service' })[name]; } }, serve(fn) { handler = fn; } },
  fetch: mockFetch, Request, Response, URL, Set, JSON, Number, encodeURIComponent,
});
const request = (action, values = {}, token = '') => handler(new Request('https://example.supabase.co/functions/v1/pk-user-access', {
  method: 'POST', headers: { origin: 'https://nk02388-cyber.github.io', 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify({ action, ...values }),
}));
const browserAuth = fs.readFileSync(path.join(__dirname, '../auth-ui.js'), 'utf8');
assert.match(browserAuth, /authorization:\s*`Bearer \$\{token \|\| SUPABASE_ANON_KEY\}`/,
  'login requests must pass Supabase JWT verification with the anon JWT');
assert.match(browserAuth, /event === 'PASSWORD_RECOVERY'/, 'recovery links must open the password form');
assert.match(browserAuth, /auth\.updateUser\(\{ password \}\)/, 'recovery form must update the Supabase password');
assert.match(browserAuth, /password\.length < 12/, 'recovery form must enforce the password minimum');
(async () => {
  operations = [];
  assert.equal((await request('list')).status, 401);
  assert.equal(operations.length, 0, 'unauthenticated management must never use service access');
  currentRole = 'user';
  assert.equal((await request('list', {}, 'staff-token')).status, 403);
  assert.equal(operations.filter(x => x.path === '/rest/v1/app_users').length, 1, 'staff may only be checked for role');
  currentRole = 'admin';
  assert.equal((await request('delete', { id: adminId }, 'admin-token')).status, 400);
  assert.equal((await request('list', {}, 'admin-token')).status, 200);
  const created = await request('create', { username: 'worker1', email: 'worker@example.com', password: 'long-test-password' }, 'admin-token');
  assert.equal(created.status, 201);
  assert.equal((await request('delete', { id: childId }, 'admin-token')).status, 200);
  console.log('PASS: login management denies guests and staff, preserves Admin, and manages only subusers');
})().catch(error => { console.error(error); process.exitCode = 1; });
