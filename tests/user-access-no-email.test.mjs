import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = await fs.readFile(new URL('../supabase/functions/pk-user-access/index.ts', import.meta.url), 'utf8');
const calls = [];
let duplicate = false;
let handler;
let createdPassword;
let loginProfile = { email: 'worker.01@pin.bcl-wms.local', active: true };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });

vm.runInNewContext(source, {
  Deno: { env: { get: name => ({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service' })[name] }, serve: fn => { handler = fn; } },
  Response,
  crypto: globalThis.crypto,
  TextEncoder,
  Uint8Array,
  fetch: async (url, init) => {
    const path = new URL(url).pathname;
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ path, url, method: init.method || 'GET', body });
    if (path === '/auth/v1/user') return json({ id: '11111111-1111-4111-8111-111111111111' });
    if (path === '/rest/v1/app_users' && url.includes('select=role,active')) return json([{ role: 'admin', active: true }]);
    if (path === '/rest/v1/app_users' && url.includes('select=email,active')) return json([loginProfile]);
    if (path === '/rest/v1/app_users' && url.includes('select=id')) return json(duplicate ? [{ id: 'already-exists' }] : []);
    if (path === '/auth/v1/admin/users') { createdPassword = body.password; return json({ id: '22222222-2222-4222-8222-222222222222' }); }
    if (path === '/auth/v1/token') return body.password === createdPassword
      ? json({ access_token: 'access', refresh_token: 'refresh' }) : json({}, 401);
    if (path === '/rest/v1/app_users' && init.method === 'POST') return json({}, 201);
    throw new Error(`Unexpected request: ${init.method || 'GET'} ${url}`);
  },
});

const request = (action, input) => new Request('https://zgsxbuckjrplkpvtlbmn.supabase.co/functions/v1/pk-user-access', {
  method: 'POST',
  headers: { origin: 'https://nk02388-cyber.github.io', authorization: 'Bearer signed-in-admin', 'content-type': 'application/json' },
  body: JSON.stringify({ action, ...input }),
});

const created = await handler(request('create', { username: 'Worker.01', pin: '000123' }));
assert.equal(created.status, 201);
assert.deepEqual(JSON.parse(await created.text()), { id: '22222222-2222-4222-8222-222222222222', username: 'worker.01', role: 'user' });
assert.equal(calls.find(call => call.path === '/auth/v1/admin/users')?.body.email, 'worker.01@pin.bcl-wms.local');
assert.equal(calls.find(call => call.path === '/rest/v1/app_users' && call.method === 'POST')?.body.email, 'worker.01@pin.bcl-wms.local');
assert.match(createdPassword, /^Bcl![0-9a-f]{64}9$/);
assert.ok(!createdPassword.includes('000123'));

const login = await handler(request('login', { username: 'Worker.01', password: '000123' }));
assert.equal(login.status, 200);
assert.deepEqual(JSON.parse(await login.text()), { access_token: 'access', refresh_token: 'refresh' });
assert.equal(calls.find(call => call.path === '/auth/v1/token')?.body.password, createdPassword);
assert.equal((await handler(request('login', { username: 'Worker.01', password: '12345' }))).status, 401);

loginProfile = { email: 'admin@bcl-wms.local', active: true };
createdPassword = 'existing-admin-passphrase';
const adminLogin = await handler(request('login', { username: 'Admin', password: createdPassword }));
assert.equal(adminLogin.status, 200);
assert.equal(calls.filter(call => call.path === '/auth/v1/token').at(-1)?.body.password, createdPassword);

for (const pin of ['12345', '1234567', '12a456']) {
  assert.equal((await handler(request('create', { username: 'other', pin }))).status, 400);
}

duplicate = true;
const before = calls.filter(call => call.path === '/auth/v1/admin/users').length;
const rejected = await handler(request('create', { username: 'Worker.01', pin: '000123' }));
assert.equal(rejected.status, 409);
assert.equal(calls.filter(call => call.path === '/auth/v1/admin/users').length, before);
console.log('PASS: six-digit PIN creation, login, validation, and duplicate protection');
