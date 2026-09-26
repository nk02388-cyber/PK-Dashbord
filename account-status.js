(() => {
  const button = document.getElementById('accountToggle');
  const panel = document.getElementById('accountPanel');
  const status = document.getElementById('accountStatus');
  if (!button || !panel || !status) return;

  const client = typeof supabaseClient !== 'undefined' ? supabaseClient : null;
  let refreshId = 0;

  function showAccount(user, message) {
    const identity = user && (user.email || user.user_metadata?.full_name || user.user_metadata?.name);
    status.textContent = identity || message;
    button.classList.toggle('is-logged-in', Boolean(user));
    button.setAttribute('aria-label', identity ? `บัญชีผู้ใช้: ${identity}` : 'บัญชีผู้ใช้');
    button.title = identity ? `เข้าสู่ระบบ: ${identity}` : 'บัญชีผู้ใช้';
  }

  async function refreshAccount() {
    const thisRefresh = ++refreshId;
    if (!client?.auth?.getUser) {
      showAccount(null, 'ยังไม่ได้เข้าสู่ระบบ');
      return;
    }
    try {
      const { data } = await client.auth.getUser();
      if (thisRefresh !== refreshId) return;
      if (data?.user) showAccount(data.user);
      else showAccount(null, 'ยังไม่ได้เข้าสู่ระบบ');
    } catch (_) {
      if (thisRefresh === refreshId) showAccount(null, 'ไม่สามารถตรวจสอบบัญชีได้');
    }
  }

  button.addEventListener('click', () => {
    const opening = panel.hidden;
    panel.hidden = !opening;
    button.setAttribute('aria-expanded', String(opening));
    if (opening) refreshAccount();
  });
  document.addEventListener('click', event => {
    if (panel.hidden || event.target.closest('.account-anchor')) return;
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || panel.hidden) return;
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    button.focus();
  });
  if (client?.auth?.onAuthStateChange) {
    client.auth.onAuthStateChange(() => setTimeout(refreshAccount, 0));
  }
  refreshAccount();
})();
