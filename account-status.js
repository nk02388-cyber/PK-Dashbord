(() => {
  const client = typeof supabaseClient !== 'undefined' ? supabaseClient : null;
  const $ = id => document.getElementById(id);
  const form = $('authLoginForm'), error = $('authError');
  const button = $('accountToggle'), panel = $('accountPanel'), status = $('accountStatus');
  const adminPanel = $('accountAdmin'), createForm = $('accountCreateForm');
  const userList = $('accountUserList'), message = $('accountManageMessage');
  const functionUrl = `${SUPABASE_URL}/functions/v1/pk-user-access`;
  let profile = null, refreshId = 0;

  function showError(text) { error.textContent = text || ''; error.hidden = !text; }
  function showScreen(visible) {
    document.body.classList.toggle('auth-ready', !visible);
    document.body.classList.toggle('auth-pending', visible);
    $('authLoading').hidden = true;
    if (visible) $('authUsername').focus();
  }
  async function call(action, data = {}, token = '') {
    const response = await fetch(functionUrl, {
      method: 'POST', headers: { 'content-type': 'application/json', apikey: SUPABASE_ANON_KEY,
        ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ action, ...data }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'ไม่สามารถติดต่อระบบบัญชีได้');
    return result;
  }
  async function adminCall(action, data = {}) {
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError || !sessionData?.session?.access_token) throw new Error('กรุณาเข้าสู่ระบบใหม่');
    return call(action, data, sessionData.session.access_token);
  }
  async function refresh() {
    const id = ++refreshId;
    if (!client) { showError('ระบบเข้าสู่ระบบยังไม่พร้อม กรุณาโหลดหน้าใหม่'); return; }
    try {
      const { data: { user }, error: userError } = await client.auth.getUser();
      if (id !== refreshId) return;
      if (userError || !user) { profile = null; showScreen(true); return; }
      const { data, error: profileError } = await client.from('app_users').select('username,role,active').eq('id', user.id).single();
      if (id !== refreshId) return;
      if (profileError || !data?.active || !['admin', 'user'].includes(data.role)) {
        await client.auth.signOut({ scope: 'local' });
        profile = null; showScreen(true); showError('บัญชีนี้ไม่ได้รับสิทธิ์เข้าใช้งาน'); return;
      }
      profile = data;
      status.textContent = `${data.username} · ${data.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้'}`;
      button.classList.add('is-logged-in');
      adminPanel.hidden = data.role !== 'admin';
      showError(''); showScreen(false);
    } catch (_) { if (id === refreshId) { showScreen(true); showError('ตรวจสอบบัญชีไม่สำเร็จ กรุณาลองใหม่'); } }
  }
  async function loadUsers() {
    if (profile?.role !== 'admin') return;
    message.textContent = 'กำลังโหลดรายชื่อ…';
    try {
      const { users } = await adminCall('list');
      userList.replaceChildren();
      for (const user of users.filter(item => item.role === 'user' && !item.username.startsWith('legacy-disabled-'))) {
        const row = document.createElement('div'); row.className = 'account-user';
        const info = document.createElement('div');
        const name = document.createElement('strong'); name.textContent = user.username;
        const email = document.createElement('span'); email.textContent = user.email;
        info.append(name, email);
        const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'ลบ';
        remove.setAttribute('aria-label', `ลบผู้ใช้ ${user.username}`);
        remove.addEventListener('click', async () => {
          if (!confirm(`ลบบัญชี ${user.username} ใช่หรือไม่?`)) return;
          remove.disabled = true;
          try { await adminCall('delete', { id: user.id }); await loadUsers(); message.textContent = `ลบ ${user.username} แล้ว`; }
          catch (err) { remove.disabled = false; message.textContent = err.message; }
        });
        row.append(info, remove); userList.append(row);
      }
      message.textContent = users.some(item => item.role === 'user' && !item.username.startsWith('legacy-disabled-')) ? '' : 'ยังไม่มีผู้ใช้ย่อย';
    } catch (err) { message.textContent = err.message; }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); showError('');
    const submit = $('authSubmit'); submit.disabled = true;
    try {
      const username = $('authUsername').value.trim();
      const password = $('authPassword').value;
      const tokens = await call('login', { username, password });
      const { error: sessionError } = await client.auth.setSession(tokens);
      if (sessionError) throw sessionError;
      $('authPassword').value = '';
      location.reload();
    } catch (err) { showError(err.message || 'เข้าสู่ระบบไม่สำเร็จ'); }
    finally { submit.disabled = false; }
  });
  createForm.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = createForm.querySelector('button[type=submit]'); submit.disabled = true;
    try {
      const values = Object.fromEntries(new FormData(createForm));
      await adminCall('create', values);
      createForm.reset(); await loadUsers(); message.textContent = `เพิ่ม ${values.username} แล้ว`;
    } catch (err) { message.textContent = err.message; }
    finally { submit.disabled = false; }
  });
  $('accountLogout').addEventListener('click', async () => {
    panel.hidden = true; button.setAttribute('aria-expanded', 'false');
    await client.auth.signOut({ scope: 'local' }); profile = null; location.reload();
  });
  button.addEventListener('click', () => {
    const opening = panel.hidden; panel.hidden = !opening;
    button.setAttribute('aria-expanded', String(opening));
    if (opening) loadUsers();
  });
  document.addEventListener('click', event => {
    if (panel.hidden || event.target.closest('.account-anchor')) return;
    panel.hidden = true; button.setAttribute('aria-expanded', 'false');
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || panel.hidden) return;
    panel.hidden = true; button.setAttribute('aria-expanded', 'false'); button.focus();
  });
  client?.auth.onAuthStateChange(() => setTimeout(refresh, 0));
  refresh();
})();
