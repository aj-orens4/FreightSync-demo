Auth.requireLogin();
renderShell('dashboard', 'Operations Overview');

const dashboardUser = Auth.getUser();
const dashboardRole = dashboardUser.role;
document.body.dataset.role = dashboardRole;
const ROLE_DASHBOARDS = {
  ADMIN: { kicker:'System command center', title:'Administrator Control Center', desc:'System-wide network health, governance, account provisioning, security oversight, and full Module 9 control.', actions:[['users.html','Provision Account'],['audit.html','Security Audit'],['routes.html','Network Control']] },
  LOGISTICS_MANAGER: { kicker:'Management workspace', title:'Logistics Performance Center', desc:'Focus on route performance, tariff decisions, SOP governance, schedules, and operational health without security administration.', actions:[['routes.html','Review Routes'],['tariffs.html','Manage Tariffs'],['schedules.html','Operations']] },
  ROUTE_PLANNER: { kicker:'Planning workspace', title:'Network Planning Studio', desc:'A map-first workspace for designing, reviewing, and maintaining freight routes and the schedules that depend on them.', actions:[['routes.html','Open Route Planner'],['sops.html','Planning SOPs'],['calendar.html','Planning Calendar']] },
  OPERATIONS_COORDINATOR: { kicker:'Live operations', title:'Today’s Operations Desk', desc:'A timetable-first workspace for departures, arrivals, delays, delay notes, reminders, and day-to-day transit coordination.', actions:[['schedules.html','Open Timetable'],['calendar.html','Reminders']] },
  SERVICE_PROVIDER_ADMIN: { kicker:'Provider workspace', title:'My Provider Operations', desc:'A scoped workspace showing only the schedules and operational information assigned to your service provider.', actions:[['schedules.html','My Schedules'],['calendar.html','My Reminders']] }
};
const rd = ROLE_DASHBOARDS[dashboardRole] || ROLE_DASHBOARDS.OPERATIONS_COORDINATOR;
document.getElementById('role-dashboard-kicker').textContent = rd.kicker;
document.getElementById('role-dashboard-title').textContent = rd.title;
document.getElementById('role-dashboard-desc').textContent = rd.desc;
document.getElementById('role-dashboard-actions').innerHTML = rd.actions.map(([href,label],i)=>`<a class="btn ${i===0?'accent':'outline'} small" href="${href}">${label}</a>`).join('');
const roleCopy = {
  ADMIN: 'Administrator workspace · full module control, user provisioning, and security audit access.',
  LOGISTICS_MANAGER: 'Logistics Manager workspace · manage routes, tariffs, SOPs, schedules, and operational status.',
  ROUTE_PLANNER: 'Route Planner workspace · focus on network planning, SOP authoring, and schedule planning.',
  OPERATIONS_COORDINATOR: 'Operations workspace · monitor schedules, update transit status, report delays, and manage reminders.',
  SERVICE_PROVIDER_ADMIN: 'Provider workspace · only your assigned provider schedules are shown; you can report operational delays.'
};
document.getElementById('role-context-text').textContent = roleCopy[dashboardRole] || 'Role-scoped workspace.';

// The dashboard itself is role-specific: hide modules that are outside the
// signed-in user's operational responsibility instead of merely disabling buttons.
const roleWidgets = {
  ADMIN: { routes:true, tariffs:true, sops:true, schedules:true, map:true, routeChart:true, scheduleChart:true, activity:true },
  LOGISTICS_MANAGER: { routes:true, tariffs:true, sops:true, schedules:true, map:true, routeChart:true, scheduleChart:true, activity:true },
  ROUTE_PLANNER: { routes:true, tariffs:false, sops:true, schedules:true, map:true, routeChart:true, scheduleChart:true, activity:true },
  OPERATIONS_COORDINATOR: { routes:false, tariffs:false, sops:false, schedules:true, map:false, routeChart:false, scheduleChart:true, activity:true },
  SERVICE_PROVIDER_ADMIN: { routes:false, tariffs:false, sops:false, schedules:true, map:false, routeChart:false, scheduleChart:true, activity:true }
};
const roleView = roleWidgets[dashboardRole] || roleWidgets.OPERATIONS_COORDINATOR;
document.querySelectorAll('.stat-card[data-kpi]').forEach(card => {
  if (!roleView[card.dataset.kpi]) card.style.display = 'none';
});
if (!roleView.map) document.getElementById('widget-map').style.display = 'none';
if (!roleView.routeChart) document.getElementById('widget-route-chart').style.display = 'none';


function renderGreeting() {
  const user = Auth.getUser();
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = (user.full_name || user.username || '').trim().split(/\s+/)[0];
  document.getElementById('greeting-text').textContent = `${greeting}, ${firstName}`;
  document.getElementById('greeting-sub').textContent = now.toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  }) + ' · ' + now.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', second: '2-digit' });

  const calBtn = document.getElementById('mini-calendar-btn');
  calBtn.innerHTML = ICONS.calendar + '<span>Calendar</span>';
}

// Ticks every second so the clock (and, at midnight/hour boundaries, the
// greeting and date) stay accurate for as long as the tab stays open —
// previously this only rendered once, so it went stale until a refresh.
setInterval(renderGreeting, 1000);

async function loadStats() {
  try {
    const requests = [];
    const slots = [];
    if (roleView.routes) { requests.push(apiRequest('/routes?status=Active&limit=1')); slots.push('routes'); }
    if (roleView.tariffs) { requests.push(apiRequest('/tariffs?status=Approved&limit=1')); slots.push('tariffs'); }
    if (roleView.sops) { requests.push(apiRequest('/sops?status=Published&limit=1')); slots.push('sops'); }
    requests.push(apiRequest(`/schedules?date_from=${todayStart()}&date_to=${todayEnd()}&limit=1`)); slots.push('schedules');
    const results = await Promise.all(requests);
    slots.forEach((key, i) => {
      const el = document.querySelector(`.stat-card[data-kpi="${key}"] .value`);
      if (el) el.textContent = results[i].meta.total;
    });
  } catch (err) { showToast(err.message || 'Failed to load dashboard stats', true); }
}

function todayStart() { return new Date().toISOString().slice(0, 10) + 'T00:00:00'; }
function todayEnd() { return new Date().toISOString().slice(0, 10) + 'T23:59:59'; }

// ---------- Reusable detail popup ----------
function openDetailPopup(title, bodyHtml, linkHref, linkLabel) {
  document.getElementById('detail-modal-title').textContent = title;
  document.getElementById('detail-modal-body').innerHTML = bodyHtml;
  const link = document.getElementById('detail-modal-link');
  link.href = linkHref;
  link.textContent = linkLabel || 'View Full Page';
  document.getElementById('detail-modal').classList.add('open');
}
document.getElementById('detail-modal-close').addEventListener('click', () =>
  document.getElementById('detail-modal').classList.remove('open'));

async function loadActivityFeed() {
  const container = document.getElementById('activity-feed');
  try {
    const schedulesRes = await apiRequest('/schedules?limit=5');
    const sopsRes = roleView.sops ? await apiRequest('/sops?limit=5') : { data: [] };
    const tariffsRes = roleView.tariffs ? await apiRequest('/tariffs?limit=5') : { data: [] };

    const items = [
      ...schedulesRes.data.map(s => ({
        type: 'schedule', id: s.schedule_id,
        title: `Schedule ${escapeHtml(s.schedule_code)} — ${s.status}`,
        meta: `${escapeHtml(s.route_name) || 'Route'} · ${fmtDate(s.date_updated)}`,
        date: s.date_updated, icon: ICONS.schedules
      })),
      ...sopsRes.data.map(s => ({
        type: 'sop', id: s.sop_id,
        title: `SOP ${escapeHtml(s.sop_code)} — ${s.approval_status}`,
        meta: `${escapeHtml(s.sop_title)} · ${fmtDate(s.date_updated)}`,
        date: s.date_updated, icon: ICONS.sops
      })),
      ...tariffsRes.data.map(t => ({
        type: 'tariff', id: t.tariff_id,
        title: `Tariff ${escapeHtml(t.tariff_code)} — ${t.status}`,
        meta: `${escapeHtml(t.service_type)} · ${fmtDate(t.date_updated)}`,
        date: t.date_updated, icon: ICONS.tariffs
      }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);

    if (items.length === 0) {
      container.innerHTML = '<div class="empty-state">No recent activity yet</div>';
      return;
    }
    container.innerHTML = items.map((item, i) => `
      <div class="activity-item" data-index="${i}">
        <div class="activity-item__dot">${item.icon}</div>
        <div>
          <div class="activity-item__title">${item.title}</div>
          <div class="activity-item__meta">${item.meta}</div>
        </div>
      </div>`).join('');

    container.querySelectorAll('.activity-item').forEach(el => {
      const item = items[Number(el.dataset.index)];
      el.addEventListener('click', () => openActivityDetail(item));
    });
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Failed to load: ${err.message}</div>`;
  }
}

async function openActivityDetail(item) {
  const routeMap = {
    schedule: { endpoint: '/schedules/', page: 'schedules.html', label: 'View in Schedules' },
    sop: { endpoint: '/sops/', page: 'sops.html', label: 'View in SOP Manager' },
    tariff: { endpoint: '/tariffs/', page: 'tariffs.html', label: 'View in Tariffs' }
  };
  const cfg = routeMap[item.type];
  openDetailPopup(item.title, '<div class="empty-state">Loading…</div>', cfg.page, cfg.label);
  try {
    const res = await apiRequest(`${cfg.endpoint}${item.id}`);
    const d = res.data;
    let html = '';
    if (item.type === 'schedule') {
      html = `<p><strong>Route:</strong> ${escapeHtml(d.route_name) || '—'}</p>
        <p><strong>Departure:</strong> ${fmtDate(d.departure_time)} from ${escapeHtml(d.departure_location)}</p>
        <p><strong>Arrival:</strong> ${fmtDate(d.arrival_time)} at ${escapeHtml(d.arrival_location)}</p>
        <p><strong>Vehicle:</strong> ${escapeHtml(d.vehicle_code)}</p>
        <p><strong>Status:</strong> <span class="badge ${d.status.replace(' ', '')}">${d.status}</span></p>`;
    } else if (item.type === 'sop') {
      html = `<p><strong>Category:</strong> ${escapeHtml(d.category)}</p>
        <p><strong>Version:</strong> v${d.version_number}</p>
        <p><strong>Status:</strong> <span class="badge ${d.approval_status.replace(' ', '')}">${d.approval_status}</span></p>
        <p style="color:var(--text-muted)">${escapeHtml(d.description) || 'No description provided.'}</p>`;
    } else if (item.type === 'tariff') {
      html = `<p><strong>Service:</strong> ${escapeHtml(d.service_type)} · <strong>Vehicle:</strong> ${escapeHtml(d.vehicle_type)}</p>
        <p><strong>Total Freight Cost:</strong> ${fmtCurrency(d.total_freight_cost)}</p>
        <p><strong>Status:</strong> <span class="badge ${d.status.replace(' ', '')}">${d.status}</span></p>
        <p><strong>Effective:</strong> ${d.effective_date}</p>`;
    }
    document.getElementById('detail-modal-body').innerHTML = html;
  } catch (err) {
    document.getElementById('detail-modal-body').innerHTML = `<div class="empty-state">Failed to load: ${err.message}</div>`;
  }
}

// ---------- KPI card popups ----------
const KPI_CONFIG = {
  routes: { title: 'Active Routes', page: 'routes.html', label: 'View in Routes & Network' },
  tariffs: { title: 'Approved Tariffs', page: 'tariffs.html', label: 'View in Rates & Tariffs' },
  sops: { title: 'Published SOPs', page: 'sops.html', label: 'View in SOP Manager' },
  schedules: { title: "Today's Schedules", page: 'schedules.html', label: 'View in Schedules' }
};

async function openKpiDetail(kpi) {
  const cfg = KPI_CONFIG[kpi];
  openDetailPopup(cfg.title, '<div class="empty-state">Loading…</div>', cfg.page, cfg.label);
  try {
    let rows = [];
    if (kpi === 'routes') {
      const res = await apiRequest('/routes?status=Active&limit=8');
      rows = res.data.map(r => `<li><strong>${escapeHtml(r.route_code)}</strong> — ${escapeHtml(r.route_name)} (${escapeHtml(r.origin)} → ${escapeHtml(r.destination)})</li>`);
    } else if (kpi === 'tariffs') {
      const res = await apiRequest('/tariffs?status=Approved&limit=8');
      rows = res.data.map(t => `<li><strong>${escapeHtml(t.tariff_code)}</strong> — ${escapeHtml(t.service_type)}, ${fmtCurrency(t.total_freight_cost)}</li>`);
    } else if (kpi === 'sops') {
      const res = await apiRequest('/sops?status=Published&limit=8');
      rows = res.data.map(s => `<li><strong>${escapeHtml(s.sop_code)}</strong> — ${escapeHtml(s.sop_title)}</li>`);
    } else if (kpi === 'schedules') {
      const res = await apiRequest(`/schedules?date_from=${todayStart()}&date_to=${todayEnd()}&limit=8`);
      rows = res.data.map(s => `<li><strong>${escapeHtml(s.schedule_code)}</strong> — ${escapeHtml(s.route_name) || 'Route'}, ${fmtDate(s.departure_time)}</li>`);
    }
    document.getElementById('detail-modal-body').innerHTML = rows.length
      ? `<ul style="margin:0; padding-left:18px; line-height:1.8">${rows.join('')}</ul>`
      : '<div class="empty-state">Nothing to show yet</div>';
  } catch (err) {
    document.getElementById('detail-modal-body').innerHTML = `<div class="empty-state">Failed to load: ${err.message}</div>`;
  }
}

document.querySelectorAll('.stat-card--clickable').forEach(card => {
  card.addEventListener('click', () => openKpiDetail(card.dataset.kpi));
});

async function loadUpcoming() {
  const body = document.getElementById('upcoming-body');
  try {
    const res = await apiRequest('/schedules?status=Scheduled&limit=8');
    if (res.data.length === 0) {
      body.innerHTML = '<tr><td colspan="6" class="empty-state">No upcoming schedules</td></tr>';
      return;
    }
    body.innerHTML = res.data.map(s => `
      <tr>
        <td>${escapeHtml(s.schedule_code)}</td>
        <td>${escapeHtml(s.route_name) || '—'}</td>
        <td>${fmtDate(s.departure_time)}</td>
        <td>${fmtDate(s.arrival_time)}</td>
        <td>${escapeHtml(s.vehicle_code)}</td>
        <td><span class="badge ${s.status.replace(' ', '')}">${s.status}</span></td>
      </tr>`).join('');
  } catch (err) {
    body.innerHTML = `<tr><td colspan="6" class="empty-state">Failed to load: ${err.message}</td></tr>`;
  }
}

async function loadRouteStatusChart() {
  const container = document.getElementById('chart-route-status');
  try {
    const statuses = ['Active', 'Under Review', 'Inactive', 'Discontinued'];
    const counts = await Promise.all(statuses.map(s =>
      apiRequest(`/routes?status=${encodeURIComponent(s)}&limit=1`).then(r => r.meta.total)
    ));
    renderBarChart(container, statuses.map((label, i) => ({ label, value: counts[i] })), (label) => openStatusDetail('routes', label));
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Failed to load: ${err.message}</div>`;
  }
}

async function loadScheduleOutcomesChart() {
  const container = document.getElementById('chart-schedule-outcomes');
  try {
    const statuses = ['Scheduled', 'In Transit', 'Completed', 'Delayed', 'Cancelled'];
    const counts = await Promise.all(statuses.map(s =>
      apiRequest(`/schedules?status=${encodeURIComponent(s)}&limit=1`).then(r => r.meta.total)
    ));
    renderDonutChart(container, statuses.map((label, i) => ({ label, value: counts[i] })), 'Schedules', (label) => openStatusDetail('schedules', label));
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Failed to load: ${err.message}</div>`;
  }
}

async function openStatusDetail(kind, status) {
  const cfg = kind === 'routes'
    ? { title: `Routes — ${status}`, page: 'routes.html', label: 'View in Routes & Network' }
    : { title: `Schedules — ${status}`, page: 'schedules.html', label: 'View in Schedules' };
  openDetailPopup(cfg.title, '<div class="empty-state">Loading…</div>', cfg.page, cfg.label);
  try {
    const endpoint = kind === 'routes' ? '/routes' : '/schedules';
    const res = await apiRequest(`${endpoint}?status=${encodeURIComponent(status)}&limit=10`);
    const rows = kind === 'routes'
      ? res.data.map(r => `<li><strong>${escapeHtml(r.route_code)}</strong> — ${escapeHtml(r.route_name)}</li>`)
      : res.data.map(s => `<li><strong>${escapeHtml(s.schedule_code)}</strong> — ${escapeHtml(s.route_name) || 'Route'}, ${fmtDate(s.departure_time)}</li>`);
    document.getElementById('detail-modal-body').innerHTML = rows.length
      ? `<ul style="margin:0; padding-left:18px; line-height:1.8">${rows.join('')}</ul>`
      : '<div class="empty-state">No items with this status</div>';
  } catch (err) {
    document.getElementById('detail-modal-body').innerHTML = `<div class="empty-state">Failed to load: ${err.message}</div>`;
  }
}

// ---------- Mini calendar popup (greeting-row button) ----------
let miniCalMonth = new Date();

async function renderMiniCalendar() {
  const year = miniCalMonth.getFullYear();
  const month = miniCalMonth.getMonth();
  document.getElementById('mini-cal-title').textContent = miniCalMonth.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });

  const dowRow = document.getElementById('mini-cal-dow');
  dowRow.innerHTML = ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => `<div>${d}</div>`).join('');

  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const gridStart = new Date(year, month, 1 - startOffset);

  const localYmd = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const from = localYmd(gridStart) + 'T00:00:00';
  const to = localYmd(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate()+41)) + 'T23:59:59';

  let scheduleDays = {};
  try {
    const res = await apiRequest(`/schedules/calendar?from=${from}&to=${to}`);
    scheduleDays = res.data;
  } catch (e) { /* non-fatal */ }

  const grid = document.getElementById('mini-cal-grid');
  const todayStr = localYmd(new Date());
  let html = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const dStr = localYmd(d);
    const inMonth = d.getMonth() === month;
    const hasEvents = !!scheduleDays[dStr];
    html += `<div class="mini-cal-cell ${inMonth ? '' : 'other-month'} ${dStr === todayStr ? 'today' : ''}">
      ${d.getDate()}${hasEvents ? '<span class="mini-cal-dot"></span>' : ''}
    </div>`;
  }
  grid.innerHTML = html;
}

function openMiniCalendar() {
  miniCalMonth = new Date();
  renderMiniCalendar();
  document.getElementById('mini-calendar-modal').classList.add('open');
}

document.getElementById('mini-calendar-btn').addEventListener('click', openMiniCalendar);
document.getElementById('mini-cal-close').addEventListener('click', () => document.getElementById('mini-calendar-modal').classList.remove('open'));
document.getElementById('mini-cal-prev').addEventListener('click', () => {
  miniCalMonth = new Date(miniCalMonth.getFullYear(), miniCalMonth.getMonth() - 1, 1);
  renderMiniCalendar();
});
document.getElementById('mini-cal-next').addEventListener('click', () => {
  miniCalMonth = new Date(miniCalMonth.getFullYear(), miniCalMonth.getMonth() + 1, 1);
  renderMiniCalendar();
});

// ---------- Dashboard customization: show/hide widgets per user preference ----------
function applyWidgetPrefs() {
  const settings = (window.FMSTheme && FMSTheme.load()) || {};
  const widgets = Object.assign({
    kpis: true, map: true, activity: true, routeChart: true, scheduleChart: true, upcoming: true
  }, settings.widgets || {});

  document.querySelectorAll('[data-widget]').forEach(el => {
    const key = el.dataset.widget;
    el.style.display = widgets[key] === false ? 'none' : '';
  });
}

renderGreeting();
applyWidgetPrefs();
if (roleView.routeChart) loadRouteStatusChart();
if (roleView.scheduleChart) loadScheduleOutcomesChart();
loadStats();
loadUpcoming();
loadActivityFeed();
if (roleView.map) initRouteMap('network-map', { footerId: 'network-map-footer', interactive: true });

// ---------- Map search / command box ----------
function runMapSearch() {
  const input = document.getElementById('map-search-input');
  const query = input.value.trim();
  if (!query) return;
  searchRouteMap('network-map', query);
}
document.getElementById('map-search-btn').addEventListener('click', runMapSearch);
document.getElementById('map-search-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); runMapSearch(); }
});

// ---------- Dashboard notification shortcut ----------
async function loadDashboardNotifications() {
  const list = document.getElementById('notification-list');
  const count = document.getElementById('notification-count');
  if (!list || !count) return;
  try {
    const now = new Date();
    const to = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const localStamp = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
    const r = await apiRequest(`/reminders?from=${localStamp(now)}&to=${localStamp(to)}`);
    const items = r.data.filter(x => !x.is_completed).slice(0, 8);
    count.textContent = items.length; count.hidden = items.length === 0;
    list.innerHTML = items.length ? items.map(x => `<div class="notification-item"><div class="notification-item__dot"></div><div><strong>${escapeHtml(x.title)}</strong><span>${fmtDate(x.remind_at)}</span>${x.note ? `<small>${escapeHtml(x.note)}</small>` : ''}</div></div>`).join('') : '<div class="empty-state">No upcoming reminders in the next 7 days.</div>';
  } catch (e) { list.innerHTML = `<div class="empty-state">${escapeHtml(e.message || 'Unable to load reminders')}</div>`; }
}
const notificationBtn=document.getElementById('notification-btn');
if(notificationBtn){ notificationBtn.addEventListener('click',()=>{document.getElementById('notification-modal').classList.add('open');loadDashboardNotifications();}); document.getElementById('notification-close').addEventListener('click',()=>document.getElementById('notification-modal').classList.remove('open')); loadDashboardNotifications(); }
