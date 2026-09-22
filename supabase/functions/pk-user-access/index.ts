// Deploy with JWT verification OFF: login is public, while every management action
// verifies the caller's bearer token and admin profile inside this function.
const url = Deno.env.get('SUPABASE_URL');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const allowedOrigins = new Set([
  'https://nk02388-cyber.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
]);

function response(origin, status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': allowedOrigins.has(origin) ? origin : 'https://nk02388-cyber.github.io',
      'access-control-allow-headers': 'authorization, apikey, content-type',
      'access-control-allow-methods': 'POST, OPTIONS',
      vary: 'Origin',
    },
  });
}

async function backend(path, key, init = {}) {
  return fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      ...init.headers,
    },
  });
}

const validUsername = (name) => typeof name === 'string' && /^[a-z][a-z0-9._-]{2,31}$/i.test(name);

Deno.serve(async (request) => {
  const origin = request.headers.get('origin') || '';
  if (request.method === 'OPTIONS') return response(origin, 200, {});
  if (request.method !== 'POST') return response(origin, 405, { error: 'Method not allowed' });
  if (!allowedOrigins.has(origin)) return response(origin, 403, { error: 'Origin not allowed' });
  let input;
  try {
    if (Number(request.headers.get('content-length') || 0) > 8192) throw new Error('Too large');
    input = await request.json();
  } catch {
    return response(origin, 400, { error: 'Invalid request' });
  }
  const action = input.action;

  if (action === 'login') {
    if (!validUsername(input.username) || typeof input.password !== 'string')
      return response(origin, 401, { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    const username = input.username.toLowerCase() === 'admin' ? 'Admin' : input.username.toLowerCase();
    const profileResponse = await backend(`/rest/v1/app_users?select=email&username=eq.${encodeURIComponent(username)}&limit=1`, serviceKey);
    if (!profileResponse.ok) return response(origin, 503, { error: 'ระบบเข้าสู่ระบบไม่พร้อม' });
    const [profile] = await profileResponse.json();
    if (!profile) return response(origin, 401, { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    const signIn = await backend('/auth/v1/token?grant_type=password', anonKey, {
      method: 'POST', body: JSON.stringify({ email: profile.email, password: input.password }),
    });
    if (!signIn.ok) return response(origin, 401, { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    const session = await signIn.json();
    return response(origin, 200, { access_token: session.access_token, refresh_token: session.refresh_token });
  }

  const jwt = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!jwt) return response(origin, 401, { error: 'กรุณาเข้าสู่ระบบ' });
  const verified = await backend('/auth/v1/user', anonKey, {
    headers: { authorization: `Bearer ${jwt}` },
  });
  if (!verified.ok) return response(origin, 401, { error: 'เซสชันหมดอายุ' });
  const caller = await verified.json();
  const roleResponse = await backend(`/rest/v1/app_users?select=role&id=eq.${encodeURIComponent(caller.id)}&limit=1`, serviceKey);
  if (!roleResponse.ok || (await roleResponse.json())[0]?.role !== 'admin')
    return response(origin, 403, { error: 'เฉพาะผู้ดูแลระบบ' });

  if (action === 'list') {
    const result = await backend('/rest/v1/app_users?select=id,username,email,role,created_at&order=created_at.asc', serviceKey);
    return response(origin, result.ok ? 200 : 503, result.ok ? { users: await result.json() } : { error: 'โหลดรายชื่อไม่สำเร็จ' });
  }

  if (action === 'create') {
    const username = typeof input.username === 'string' ? input.username.trim().toLowerCase() : '';
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    const password = input.password;
    if (!validUsername(username) || username === 'admin' || !/^\S+@\S+\.\S+$/.test(email)
      || typeof password !== 'string' || password.length < 12 || password.length > 128)
      return response(origin, 400, { error: 'กรุณาระบุชื่อผู้ใช้ อีเมล และรหัสผ่านอย่างน้อย 12 ตัวอักษร' });
    const exists = await backend(`/rest/v1/app_users?select=id&or=(username.eq.${encodeURIComponent(username)},email.eq.${encodeURIComponent(email)})&limit=1`, serviceKey);
    if (!exists.ok) return response(origin, 503, { error: 'ตรวจสอบผู้ใช้ไม่สำเร็จ' });
    if ((await exists.json()).length) return response(origin, 409, { error: 'ชื่อผู้ใช้หรืออีเมลนี้มีอยู่แล้ว' });
    const createdResponse = await backend('/auth/v1/admin/users', serviceKey, {
      method: 'POST', body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { username } }),
    });
    if (!createdResponse.ok) return response(origin, 400, { error: 'สร้างบัญชีไม่สำเร็จ กรุณาตรวจสอบอีเมล' });
    const created = await createdResponse.json();
    const id = created.id || created.user?.id;
    if (!id) return response(origin, 503, { error: 'สร้างบัญชีไม่ครบ กรุณาตรวจสอบใน Supabase' });
    const profile = await backend('/rest/v1/app_users', serviceKey, {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ id, username, email, role: 'user' }),
    });
    if (!profile.ok) {
      await backend(`/auth/v1/admin/users/${encodeURIComponent(id)}`, serviceKey, { method: 'DELETE' });
      return response(origin, 503, { error: 'สร้างโปรไฟล์ไม่สำเร็จและย้อนบัญชีแล้ว' });
    }
    return response(origin, 201, { id, username, email, role: 'user' });
  }

  if (action === 'delete') {
    const id = typeof input.id === 'string' ? input.id : '';
    if (!/^[0-9a-f-]{36}$/i.test(id) || id === caller.id)
      return response(origin, 400, { error: 'ไม่สามารถลบบัญชีนี้ได้' });
    const targetResponse = await backend(`/rest/v1/app_users?select=role&id=eq.${encodeURIComponent(id)}&limit=1`, serviceKey);
    if (!targetResponse.ok || (await targetResponse.json())[0]?.role !== 'user')
      return response(origin, 400, { error: 'ลบได้เฉพาะผู้ใช้ย่อย' });
    const removed = await backend(`/auth/v1/admin/users/${encodeURIComponent(id)}`, serviceKey, { method: 'DELETE' });
    return response(origin, removed.ok ? 200 : 503, removed.ok ? { deleted: true } : { error: 'ลบผู้ใช้ไม่สำเร็จ' });
  }

  return response(origin, 400, { error: 'Unknown action' });
});
