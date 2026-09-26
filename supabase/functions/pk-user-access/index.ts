// Deploy with JWT verification OFF: login is public, while every management action
// verifies the caller's bearer token and admin profile inside this function.
const url = Deno.env.get('SUPABASE_URL');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const allowedOrigins = new Set([
  'https://nk02388-cyber.github.io',
  'https://bcl-wms.vercel.app',
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
const validPin = (pin) => typeof pin === 'string' && /^[0-9]{6}$/.test(pin);

async function pinPassword(username, pin) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(serviceKey),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key,
    encoder.encode(`bcl-wms-pin-v1:${username}:${pin}`));
  const hex = Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
  return `Bcl!${hex}9`;
}


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
    const profileResponse = await backend(`/rest/v1/app_users?select=email,active&username=eq.${encodeURIComponent(username)}&limit=1`, serviceKey);
    if (!profileResponse.ok) return response(origin, 503, { error: 'ระบบเข้าสู่ระบบไม่พร้อม' });
    const [profile] = await profileResponse.json();
    if (!profile?.active) return response(origin, 401, { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    const usesPin = profile.email.endsWith('@pin.bcl-wms.local');
    if (usesPin && !validPin(input.password))
      return response(origin, 401, { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    const password = usesPin ? await pinPassword(username, input.password) : input.password;
    const signIn = await backend('/auth/v1/token?grant_type=password', anonKey, {
      method: 'POST', body: JSON.stringify({ email: profile.email, password }),
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
  const roleResponse = await backend(`/rest/v1/app_users?select=role,active&id=eq.${encodeURIComponent(caller.id)}&limit=1`, serviceKey);
  const adminProfile = roleResponse.ok ? (await roleResponse.json())[0] : null;
  if (!adminProfile?.active || adminProfile.role !== 'admin')
    return response(origin, 403, { error: 'เฉพาะผู้ดูแลระบบ' });


  if (action === 'list') {
    const result = await backend('/rest/v1/app_users?select=id,username,role,created_at&active=eq.true&order=created_at.asc', serviceKey);
    return response(origin, result.ok ? 200 : 503, result.ok ? { users: await result.json() } : { error: 'โหลดรายชื่อไม่สำเร็จ' });
  }


  if (action === 'create') {
    const username = typeof input.username === 'string' ? input.username.trim().toLowerCase() : '';
    // Supabase Auth needs an email identifier internally; staff sign in by username.
    const email = `${username}@pin.bcl-wms.local`;
    const pin = input.pin;
    if (!validUsername(username) || username === 'admin'
      || !validPin(pin))
      return response(origin, 400, { error: 'กรุณาระบุชื่อผู้ใช้และ PIN ตัวเลข 6 หลัก' });
    const exists = await backend(`/rest/v1/app_users?select=id&or=(username.eq.${encodeURIComponent(username)},email.eq.${encodeURIComponent(email)})&limit=1`, serviceKey);
    if (!exists.ok) return response(origin, 503, { error: 'ตรวจสอบผู้ใช้ไม่สำเร็จ' });
    if ((await exists.json()).length) return response(origin, 409, { error: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' });
    const password = await pinPassword(username, pin);
    const createdResponse = await backend('/auth/v1/admin/users', serviceKey, {
      method: 'POST', body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { username, login_kind: 'pin-v1' } }),
    });
    if (!createdResponse.ok) return response(origin, 400, { error: 'สร้างบัญชีไม่สำเร็จ กรุณาลองชื่อผู้ใช้อื่น' });
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
    return response(origin, 201, { id, username, role: 'user' });
  }


  if (action === 'delete') {
    const id = typeof input.id === 'string' ? input.id : '';
    if (!/^[0-9a-f-]{36}$/i.test(id) || id === caller.id)
      return response(origin, 400, { error: 'ไม่สามารถลบบัญชีนี้ได้' });
    const targetResponse = await backend(`/rest/v1/app_users?select=role&id=eq.${encodeURIComponent(id)}&limit=1`, serviceKey);
    if (!targetResponse.ok || (await targetResponse.json())[0]?.role !== 'user')
      return response(origin, 400, { error: 'ลบได้เฉพาะผู้ใช้ย่อย' });
    const disabled = await backend(`/rest/v1/app_users?id=eq.${encodeURIComponent(id)}`, serviceKey, {
      method: 'PATCH', body: JSON.stringify({ active: false }),
    });
    if (!disabled.ok) return response(origin, 503, { error: 'ปิดสิทธิ์ผู้ใช้ไม่สำเร็จ' });
    const removed = await backend(`/auth/v1/admin/users/${encodeURIComponent(id)}`, serviceKey, { method: 'DELETE' });
    if (!removed.ok) return response(origin, 503, { error: 'ปิดสิทธิ์แล้ว แต่ลบบัญชีไม่สำเร็จ กรุณาตรวจสอบใน Supabase' });
    await backend(`/rest/v1/app_users?id=eq.${encodeURIComponent(id)}`, serviceKey, { method: 'DELETE' });
    return response(origin, 200, { deleted: true });
  }


  return response(origin, 400, { error: 'Unknown action' });
});
