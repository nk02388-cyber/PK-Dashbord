(() => {
  const screen = document.createElement('section');
  screen.className = 'pk-auth-screen';
  screen.setAttribute('aria-label', 'เข้าสู่ระบบ');
  screen.innerHTML = `<form class="pk-auth-card" id="pkLoginForm">
    <h2>เข้าสู่ระบบคลังบรรจุภัณฑ์</h2>
    <p>ใช้ชื่อผู้ใช้และรหัสผ่านที่ได้รับจากผู้ดูแลระบบ</p>
    <label for="pkUsername">ชื่อผู้ใช้</label><input id="pkUsername" name="username" autocomplete="username" required>
    <label for="pkPassword">รหัสผ่าน</label><input id="pkPassword" name="password" type="password" autocomplete="current-password" required>
    <button type="submit">เข้าสู่ระบบ</button><div class="pk-auth-message" id="pkLoginMessage" role="alert"></div>
  </form>`;
  document.body.append(screen);
  const manager = document.createElement('dialog');
  manager.className = 'pk-users-dialog';
  manager.innerHTML = `<div class="pk-users-head"><h2>จัดการผู้ใช้</h2><button type="button" id="pkUsersClose" aria-label="ปิด">✕</button></div>
    <p>ผู้ดูแลระบบเพิ่มและลบผู้ใช้ย่อยได้ บัญชี Admin ลบไม่ได้</p>
    <div id="pkUserList" aria-live="polite"></div>
    <form class="pk-user-form" id="pkUserForm"><h3>เพิ่มผู้ใช้ย่อย</h3>
      <div><label for="pkNewUsername">ชื่อผู้ใช้</label><input id="pkNewUsername" autocomplete="off" pattern="[A-Za-z][A-Za-z0-9._-]{2,31}" required></div>
      <div><label for="pkNewEmail">อีเมล</label><input id="pkNewEmail" type="email" autocomplete="off" required></div>
      <div><label for="pkNewPassword">รหัสผ่านเริ่มต้น</label><input id="pkNewPassword" type="password" autocomplete="new-password" minlength="12" required></div>
      <button type="submit">เพิ่มผู้ใช้</button><div class="pk-auth-message" id="pkUsersMessage" role="alert"></div>
    </form>`;
  document.body.append(manager);
  const loginForm = document.getElementById('pkLoginForm');
  const loginMessage = document.getElementById('pkLoginMessage');
  const userMessage = document.getElementById('pkUsersMessage');
  const userList = document.getElementById('pkUserList');
  const managerButton = document.getElementById('userManagerButton');
  const logoutButton = document.getElementById('logoutButton');
  const endpoint = `${SUPABASE_URL}/functions/v1/pk-user-access`;
  let profile = null;
  let remoteLoaded = false;

  async function callFunction(action, values = {}, token = '') {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: SUPABASE_ANON_KEY,
        authorization: `Bearer ${token || SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ action, ...values }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'ติดต่อระบบไม่สำเร็จ');
    return result;
  }
  async function accessToken() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session?.access_token) throw new Error('กรุณาเข้าสู่ระบบ');
    return session.access_token;
  }
  async function showSignedIn() {
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('กรุณาเข้าสู่ระบบ');
    const { data, error } = await supabaseClient.from('app_users').select('id,username,role').eq('id', user.id).single();
    if (error || !data) throw new Error('บัญชีนี้ไม่มีสิทธิ์ใช้งาน');
    profile = data;
    window.PK_APP_USER = Object.freeze({ id: data.id, username: data.username, role: data.role });
    document.body.classList.remove('auth-locked');
    screen.hidden = true;
    logoutButton.hidden = false;
    managerButton.hidden = data.role !== 'admin';
    document.getElementById('stockUpdateBtn').hidden = data.role !== 'admin';
    if (!remoteLoaded) {
      remoteLoaded = true;
      await Promise.allSettled([initSupabaseSync(), loadLatestStockFromSupabase()]);
    }
  }
  function showSignedOut() {
    profile = null;
    window.PK_APP_USER = null;
    remoteLoaded = false;
    document.body.classList.add('auth-locked');
    screen.hidden = false;
    logoutButton.hidden = true;
    managerButton.hidden = true;
    if (manager.open) manager.close();
  }
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginMessage.textContent = '';
    const button = loginForm.querySelector('button');
    button.disabled = true;
    try {
      if (!supabaseClient) throw new Error('ไม่สามารถเชื่อมต่อระบบเข้าสู่ระบบ');
      const credentials = await callFunction('login', {
        username: document.getElementById('pkUsername').value.trim(),
        password: document.getElementById('pkPassword').value,
      });
      const { error } = await supabaseClient.auth.setSession(credentials);
      document.getElementById('pkPassword').value = '';
      if (error) throw error;
      await showSignedIn();
    } catch (error) {
      loginMessage.textContent = error.message || 'เข้าสู่ระบบไม่สำเร็จ';
      await supabaseClient?.auth.signOut().catch(() => {});
      showSignedOut();
    } finally { button.disabled = false; }
  });
  logoutButton.addEventListener('click', async () => {
    await supabaseClient?.auth.signOut();
    showSignedOut();
  });
  document.getElementById('pkUsersClose').addEventListener('click', () => manager.close());

  async function loadUsers() {
    userList.textContent = 'กำลังโหลด...';
    const { users } = await callFunction('list', {}, await accessToken());
    userList.replaceChildren();
    users.forEach((user) => {
      const row = document.createElement('div');
      row.className = 'pk-user-row';
      const text = document.createElement('span');
      const title = document.createElement('strong'); title.textContent = user.username + (user.role === 'admin' ? ' · Admin' : '');
      const email = document.createElement('small'); email.textContent = user.email;
      text.append(title, email); row.append(text);
      if (user.role === 'user') {
        const remove = document.createElement('button');
        remove.type = 'button'; remove.textContent = 'ลบ'; remove.setAttribute('aria-label', `ลบ ${user.username}`);
        remove.addEventListener('click', async () => {
          if (!window.confirm(`ลบผู้ใช้ ${user.username} และยกเลิกสิทธิ์ใช้งานหรือไม่?`)) return;
          remove.disabled = true;
          try { await callFunction('delete', { id: user.id }, await accessToken()); await loadUsers(); }
          catch (error) { userMessage.textContent = error.message; remove.disabled = false; }
        });
        row.append(remove);
      }
      userList.append(row);
    });
  }
  managerButton.addEventListener('click', async () => {
    if (profile?.role !== 'admin') return;
    userMessage.textContent = '';
    manager.showModal();
    try { await loadUsers(); } catch (error) { userList.textContent = error.message; }
  });
  document.getElementById('pkUserForm').addEventListener('submit', async (event) => {
    event.preventDefault(); userMessage.textContent = '';
    const form = event.currentTarget;
    const button = form.querySelector('button'); button.disabled = true;
    try {
      await callFunction('create', {
        username: document.getElementById('pkNewUsername').value.trim(),
        email: document.getElementById('pkNewEmail').value.trim(),
        password: document.getElementById('pkNewPassword').value,
      }, await accessToken());
      form.reset(); await loadUsers(); userMessage.textContent = 'เพิ่มผู้ใช้สำเร็จ';
    } catch (error) { userMessage.textContent = error.message; }
    finally { button.disabled = false; }
  });
  if (!supabaseClient) { loginMessage.textContent = 'ไม่สามารถเชื่อมต่อระบบเข้าสู่ระบบ'; return; }
  supabaseClient.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') showSignedOut(); });
  showSignedIn().catch(() => showSignedOut());
})();
