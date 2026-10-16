// Automatically finds the right backend URL whether running locally or inside
// a GitHub Codespace (where each forwarded port gets its own https:// URL
// following the pattern <codespace-name>-<port>.app.github.dev).
const API_BASE = (function () {
  const host = window.location.hostname;
  const codespacesMatch = host.match(/^(.+)-(\d+)\.(app\.github\.dev)$/);
  if (codespacesMatch) {
    const [, namePart, , domain] = codespacesMatch;
    return `https://${namePart}-4000.${domain}/api/v1`;
  }
  if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:4000/api/v1';
  return `${window.location.origin}/api/v1`;
})();

const Auth = {
  getToken() { return localStorage.getItem('fms_token'); },
  getUser() {
    const raw = localStorage.getItem('fms_user');
    return raw ? JSON.parse(raw) : null;
  },
  setSession(token, user) {
    localStorage.setItem('fms_token', token);
    localStorage.setItem('fms_user', JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem('fms_token');
    localStorage.removeItem('fms_user');
  },
  requireLogin() {
    if (!this.getToken()) { window.location.href = 'index.html'; return; }
    // Temporary-password enforcement is rendered as a blocking security modal
    // by renderShell(). Do not redirect to Settings: keeping the requested page
    // behind the modal makes the requirement clear and avoids redirect loops.
  },
  logout() { sessionStorage.removeItem('fms_pending_password');
    this.clear();
    window.location.href = 'index.html';
  }
};

async function apiRequest(path, { method = 'GET', body = null } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = Auth.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
  } catch (error) {
    throw new Error(error.name === 'AbortError'
      ? 'The server did not respond within 20 seconds. Please try again.'
      : 'Cannot connect to FreightSync. Check your connection and try again.');
  } finally {
    clearTimeout(timeout);
  }

  let json;
  try { json = await res.json(); } catch (e) { json = { success: false, message: 'Invalid server response' }; }

  if (res.status === 401 && !['/auth/verify-2fa','/auth/resend-2fa','/auth/login'].includes(path)) {
    Auth.clear();
    window.location.href = 'index.html';
    return Promise.reject(json);
  }
  if (!json.success) {
    return Promise.reject(json);
  }
  return json;
}

function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  if (!toast) return alert(message);
  toast.textContent = message;
  toast.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(() => { toast.className = 'toast'; }, 3200);
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
}

function fmtCurrency(v) {
  if (v == null) return '—';
  return '₱' + Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2 });
}

/**
 * SECURITY CONTROL: XSS Defense
 * Every page in this app builds table/list rows with template-string
 * `innerHTML` for speed (no framework). Any value that originated from user
 * input — route names, SOP titles/descriptions, reminder titles, tariff
 * service types, full names, etc. — MUST be passed through escapeHtml()
 * before being interpolated into an innerHTML string, or a value like
 * `<img src=x onerror=alert(1)>` typed into a form would execute as real
 * HTML for the next person who views that record. Numbers, codes we
 * generated ourselves (RT-0001), and status enum values we control are safe
 * to leave unescaped.
 */
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Delays calling fn until `wait` ms after the last call — used so text filter
 *  inputs re-fetch as you type without a Search button, but without firing
 *  a request on every single keystroke. */
function debounce(fn, wait = 350) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

// Simple line icons (24x24 viewBox, stroke-based) — kept inline so the frontend
// has zero external icon-library dependency.
const ICONS = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  routes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M6 8.5c0 5 4 4 8 6.5s2 3 4 3"/></svg>',
  tariffs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 8-8.5 8.5a1.5 1.5 0 0 1-2 0L3 13V5a2 2 0 0 1 2-2z"/><circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none"/></svg>',
  sops: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>',
  schedules: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
  support: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M5.6 5.6l3.5 3.5m5.8 5.8 3.5 3.5M18.4 5.6l-3.5 3.5m-5.8 5.8-3.5 3.5"/></svg>',
  reports: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V11m5 9V5m5 15v-7m5 7V8"/><path d="M2 21h20"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5"/></svg>',
  audit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 20 6v6c0 5-3 8-8 10-5-2-8-5-8-10V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.36.36.86.58 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
};

// Builds the sidebar + topbar into #app-sidebar / #app-topbar containers,
// with role-aware nav, an avatar/initials block, and a persisted
// collapse toggle. Pass the page's title for the topbar heading.
function renderShell(activePage, pageTitle) {
  const user = Auth.getUser();
  if (!user) return;

  const initials = (user.full_name || user.username || '?')
    .split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  const roleLabel = escapeHtml(user.role.replace(/_/g, ' '));
  const safeName = escapeHtml(user.full_name || user.username || '');

  // Each role gets a deliberately scoped workspace instead of the same menu.
  // Backend mutation routes independently enforce the same RBAC policy.
  const rolePages = {
    ADMIN: ['dashboard','routes','tariffs','sops','schedules','calendar','support','reports','backup','users','audit'],
    LOGISTICS_MANAGER: ['dashboard','routes','tariffs','sops','schedules','calendar','support','reports'],
    ROUTE_PLANNER: ['dashboard','routes','sops','schedules','calendar','support'],
    OPERATIONS_COORDINATOR: ['dashboard','schedules','calendar','support'],
    SERVICE_PROVIDER_ADMIN: ['dashboard','schedules','calendar','support']
  };
  const allNavItems = [
    { page: 'dashboard', label: 'Operations Overview', href: 'dashboard.html', icon: ICONS.dashboard },
    { page: 'routes', label: 'Routes & Network', href: 'routes.html', icon: ICONS.routes },
    { page: 'tariffs', label: 'Rates & Tariffs', href: 'tariffs.html', icon: ICONS.tariffs },
    { page: 'sops', label: 'SOP Manager', href: 'sops.html', icon: ICONS.sops },
    { page: 'schedules', label: 'Schedules & Timetable', href: 'schedules.html', icon: ICONS.schedules },
    { page: 'calendar', label: 'Calendar & Reminders', href: 'calendar.html', icon: ICONS.calendar },
    { page: 'support', label: 'Help & Support', href: 'support.html', icon: ICONS.support },
    { page: 'reports', label: 'Reports & Analytics', href: 'reports.html', icon: ICONS.reports },
    { page: 'users', label: 'User Management', href: 'users.html', icon: ICONS.users },
    { page: 'audit', label: 'Security Audit', href: 'audit.html', icon: ICONS.audit }
  ];
  const allowedPages = rolePages[user.role] || ['dashboard'];
  if (!allowedPages.includes(activePage) && activePage !== 'settings') {
    window.location.replace('dashboard.html');
    return;
  }
  const navItems = allNavItems.filter(item => allowedPages.includes(item.page));

  const shell = document.querySelector('.app-shell');
  const isCompact = localStorage.getItem('fms_sidebar_collapsed') === '1';
  if (shell) shell.setAttribute('data-sidebar', isCompact ? 'compact' : 'expanded');
  document.documentElement.setAttribute('data-sidebar', isCompact ? 'compact' : 'expanded');

  const sidebarEl = document.getElementById('app-sidebar');
  if (sidebarEl) {
    sidebarEl.innerHTML = `
      <div class="sidebar__brand">
        <div class="sidebar__brand-mark">FS</div>
        <div class="sidebar__brand-name">FreightSync<small>Service Provider &amp; Network</small></div>
        <button class="sidebar__collapse-btn" id="sidebar-collapse-btn" title="Collapse sidebar" aria-label="Toggle sidebar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
      </div>
      <nav class="sidebar__nav">
        <div class="sidebar__section-title">Menu</div>
        ${navItems.map(item => `
          <a href="${item.href}" class="nav__item ${item.page === activePage ? 'is-active' : ''}" data-tooltip="${item.label}" aria-label="${item.label}">
            ${item.icon}<span class="nav__label">${item.label}</span>
          </a>`).join('')}
      </nav>
      <div class="sidebar__footer">
        <div class="sidebar__user">
          <div class="sidebar__user-avatar">${user.profile_photo ? `<img src="${user.profile_photo}" alt="Profile">` : initials}</div>
          <div class="sidebar__user-meta">
            <div class="sidebar__user-name">${safeName}</div>
            <div class="sidebar__user-role">${roleLabel}</div>
          </div>
        </div>
      </div>
    `;

    const collapseBtn = document.getElementById('sidebar-collapse-btn');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', () => {
        const nowCompact = shell.getAttribute('data-sidebar') !== 'compact';
        if (nowCompact) { shell.setAttribute('data-sidebar', 'compact'); document.documentElement.setAttribute('data-sidebar','compact'); localStorage.setItem('fms_sidebar_collapsed', '1'); }
        else { shell.setAttribute('data-sidebar','expanded'); document.documentElement.setAttribute('data-sidebar','expanded'); localStorage.setItem('fms_sidebar_collapsed', '0'); }
      });
    }
  }

  const topbarEl = document.getElementById('app-topbar');
  if (topbarEl) {
    topbarEl.innerHTML = `
      <div>
        <div class="topbar__eyebrow">Service Provider &amp; Network Control</div>
        <h1>${pageTitle || ''}</h1>
      </div>
      <div class="topbar__actions">
        <div class="notification-menu">
          <button class="notification-bell" id="notification-bell-btn" type="button" aria-label="Notifications" title="Notifications">🔔<span id="notification-count" class="notification-count"></span></button>
          <div class="notification-popover" id="notification-popover">
            <div class="notification-popover__head"><div><strong>Notifications</strong><small id="notification-popover-sub">Recent system activity</small></div><button class="btn small outline" id="notification-read-all" type="button">Mark all read</button></div>
            <div class="notification-popover__list" id="notification-popover-list"><div class="notification-popover__empty">Loading…</div></div>
            <a class="notification-popover__footer" href="support.html">Open Help &amp; Support</a>
          </div>
        </div>
        <span class="role-badge">${roleLabel}</span>
        <div class="account-menu">
          <button class="account-menu__trigger" id="account-menu-btn">
            <div class="account-menu__avatar">${user.profile_photo ? `<img src="${user.profile_photo}" alt="Profile">` : initials}</div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <div class="account-menu__dropdown" id="account-menu-dropdown">
            <div class="account-menu__header">
              <div class="account-menu__name">${safeName}</div>
              <div class="account-menu__role">${roleLabel}</div>
            </div>
            <a href="settings.html" class="account-menu__item">${ICONS.settings}<span>Settings</span></a>
            <button class="account-menu__item account-menu__item--danger" id="account-menu-logout">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    `;

    const menuBtn = document.getElementById('account-menu-btn');
    const dropdown = document.getElementById('account-menu-dropdown');
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });
    document.addEventListener('click', () => dropdown.classList.remove('open'));
    document.getElementById('account-menu-logout').addEventListener('click', () => Auth.logout());
    const notifBtn=document.getElementById('notification-bell-btn');
    const notifPop=document.getElementById('notification-popover');
    const notifList=document.getElementById('notification-popover-list');
    const notifCount=document.getElementById('notification-count');
    async function loadHeaderNotifications(){
      try{const r=await apiRequest('/notifications');const items=(r.data.items||[]).slice(0,6);const unread=r.data.unread||0;
        if(notifCount){notifCount.classList.toggle('show',unread>0);notifCount.textContent=unread>99?'99+':String(unread||'');}
        document.getElementById('notification-popover-sub').textContent=unread?`${unread} unread`:'You are all caught up';
        notifList.innerHTML=items.length?items.map(n=>`<button type="button" class="notification-popover__item ${n.is_read?'':'unread'}" data-id="${n.notification_id}" data-link="${escapeHtml(n.link_url||'')}"><span class="notification-popover__dot"></span><span><strong>${escapeHtml(n.title)}</strong><em>${escapeHtml(n.message)}</em><small>${fmtDate(n.date_created)}</small></span></button>`).join(''):'<div class="notification-popover__empty">No new notifications.</div>';
        notifList.querySelectorAll('[data-id]').forEach(el=>el.onclick=async()=>{await apiRequest(`/notifications/${el.dataset.id}/read`,{method:'PATCH'});if(el.dataset.link)location.href=el.dataset.link;else loadHeaderNotifications();});
      }catch(e){notifList.innerHTML='<div class="notification-popover__empty">Notifications unavailable.</div>';}
    }
    if(notifBtn){notifBtn.onclick=(e)=>{e.stopPropagation();notifPop.classList.toggle('open');if(notifPop.classList.contains('open'))loadHeaderNotifications();};notifPop.onclick=e=>e.stopPropagation();document.addEventListener('click',()=>notifPop.classList.remove('open'));document.getElementById('notification-read-all').onclick=async()=>{await apiRequest('/notifications/read-all',{method:'PATCH'});loadHeaderNotifications();};loadHeaderNotifications();}
  }

  if (user.must_change_password) mountPasswordChangeGate();
}

function passwordPolicyMessage(value) {
  if ((value || '').length < 8) return 'Use at least 8 characters.';
  if ((value || '').length > 72) return 'Use no more than 72 characters.';
  if (!/[A-Z]/.test(value)) return 'Add at least one uppercase letter.';
  if (!/[a-z]/.test(value)) return 'Add at least one lowercase letter.';
  if (!/\d/.test(value)) return 'Add at least one number.';
  if (!/[^A-Za-z0-9]/.test(value)) return 'Add at least one special character.';
  return '';
}

function mountPasswordChangeGate() {
  if (document.getElementById('password-change-gate')) return;
  const overlay = document.createElement('div');
  overlay.id = 'password-change-gate';
  overlay.className = 'modal-overlay open security-gate';
  overlay.innerHTML = `
    <div class="modal security-gate__card" role="dialog" aria-modal="true" aria-labelledby="security-gate-title">
      <div class="security-gate__icon">FS</div>
      <h3 id="security-gate-title">Secure your FreightSync account</h3>
      <p class="settings-desc">Your current password is temporary. Create your own strong password before continuing to the system.</p>
      <form id="security-gate-form">
        <div class="field"><label>Current temporary password</label><div class="password-control"><input id="gate-current-password" type="password" autocomplete="current-password" required><button type="button" class="password-visibility" data-target="gate-current-password" aria-label="Show password">◉</button></div></div>
        <div class="field"><label>New password</label><div class="password-control"><input id="gate-new-password" type="password" autocomplete="new-password" minlength="8" maxlength="72" required><button type="button" class="password-visibility" data-target="gate-new-password" aria-label="Show password">◉</button></div><div id="gate-password-feedback" class="password-feedback">Use 8+ characters with uppercase, lowercase, a number, and a special character.</div></div>
        <div class="field"><label>Confirm new password</label><div class="password-control"><input id="gate-confirm-password" type="password" autocomplete="new-password" required><button type="button" class="password-visibility" data-target="gate-confirm-password" aria-label="Show password">◉</button></div></div>
        <div id="gate-error" class="form-error"></div>
        <button class="btn accent security-gate__submit" id="gate-submit" type="submit">Secure Account</button>
      </form>
      <button type="button" class="security-gate__logout" id="gate-logout">Sign out instead</button>
    </div>`;
  document.body.appendChild(overlay);
  const pendingPassword=sessionStorage.getItem('fms_pending_password');
  if(pendingPassword){ document.getElementById('gate-current-password').value=pendingPassword; }
  overlay.addEventListener('click', e => e.stopPropagation());
  document.querySelectorAll('#password-change-gate .password-visibility').forEach(btn => btn.addEventListener('click', () => { const input=document.getElementById(btn.dataset.target); input.type=input.type==='password'?'text':'password'; }));
  const np=document.getElementById('gate-new-password'), feedback=document.getElementById('gate-password-feedback');
  np.addEventListener('input',()=>{ const msg=passwordPolicyMessage(np.value); feedback.textContent=msg||'Strong password — all requirements are met.'; feedback.className='password-feedback '+(msg?'weak':'strong'); });
  document.getElementById('gate-logout').addEventListener('click',()=>Auth.logout());
  document.getElementById('security-gate-form').addEventListener('submit', async e => {
    e.preventDefault();
    const current_password=document.getElementById('gate-current-password').value;
    const new_password=np.value; const confirm=document.getElementById('gate-confirm-password').value;
    const error=document.getElementById('gate-error'); const submit=document.getElementById('gate-submit');
    const policy=passwordPolicyMessage(new_password);
    if(policy){ error.textContent=policy; return; }
    if(new_password!==confirm){ error.textContent='New passwords do not match.'; return; }
    error.textContent=''; submit.disabled=true; submit.textContent='Securing account…';
    try {
      await apiRequest('/auth/change-password',{method:'PATCH',body:{current_password,new_password}});
      const updated=Auth.getUser(); updated.must_change_password=false; Auth.setSession(Auth.getToken(),updated); sessionStorage.removeItem('fms_pending_password');
      submit.textContent='Account secured ✓';
      setTimeout(()=>window.location.replace('dashboard.html'),450);
    } catch(err) { error.textContent=err.message||'Password could not be changed.'; submit.disabled=false; submit.textContent='Secure Account'; }
  });
}


// Role permission helper for showing/hiding action buttons in the UI.
function hasRole(...roles) {
  const user = Auth.getUser();
  return user && roles.includes(user.role);
}

/**
 * Wires a list of filter input/select IDs to auto-run loadFn — text inputs
 * filter as you type (debounced) and also immediately on Enter, selects
 * filter immediately on change. Removes the need for a manual Search button.
 */
function autoFilter(loadFn, fieldIds) {
  const debounced = debounce(loadFn, 350);
  fieldIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'SELECT') {
      el.addEventListener('change', loadFn);
    } else {
      el.addEventListener('input', debounced);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); loadFn(); } });
    }
  });
}

// Consistent dialog behavior across the application: Escape closes the top
// modal and clicking the dimmed backdrop closes it, while clicks inside do not.
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const open = [...document.querySelectorAll('.modal-overlay.open')].pop();
  if (open && !open.classList.contains('security-gate')) open.classList.remove('open');
});
document.addEventListener('click', (event) => {
  if (event.target.classList && event.target.classList.contains('modal-overlay')) {
    event.target.classList.remove('open');
  }
});
