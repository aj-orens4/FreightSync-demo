Auth.requireLogin();
renderShell('schedules', 'Schedules & Transit Timetable');

const canManageSchedules = hasRole('ADMIN', 'LOGISTICS_MANAGER', 'ROUTE_PLANNER');
const canReportDelay = hasRole('ADMIN', 'LOGISTICS_MANAGER', 'OPERATIONS_COORDINATOR', 'SERVICE_PROVIDER_ADMIN');
const canChangeStatus = hasRole('ADMIN', 'LOGISTICS_MANAGER', 'OPERATIONS_COORDINATOR');

async function loadSchedules() {
  const body = document.getElementById('schedules-body');
  const status = document.getElementById('filter-status').value;
  const params = new URLSearchParams();
  if (status) params.set('status', status);

  try {
    const res = await apiRequest(`/schedules?${params.toString()}`);
    if (res.data.length === 0) {
      body.innerHTML = '<tr><td colspan="8" class="empty-state">No schedules found</td></tr>';
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
        <td>${s.latest_delay_reason ? `<div class="delay-note-preview" title="${escapeHtml(s.latest_delay_reason)}"><strong>Delay note</strong><span>${escapeHtml(s.latest_delay_reason)}</span><button class="btn small outline" onclick="viewScheduleDetails(${s.schedule_id})">History</button></div>` : '—'}</td>
        <td>${scheduleActions(s)}</td>
      </tr>`).join('');
  } catch (err) {
    body.innerHTML = `<tr><td colspan="8" class="empty-state">Failed to load: ${err.message}</td></tr>`;
  }
}

function scheduleActions(s) {
  let html = '';
  if (canChangeStatus && s.status === 'Scheduled') html += `<button class="btn small outline" onclick="setStatus(${s.schedule_id}, 'In Transit')">Start Transit</button> `;
  if (canChangeStatus && s.status === 'In Transit') html += `<button class="btn small outline" onclick="setStatus(${s.schedule_id}, 'Completed')">Complete</button> `;
  if (canReportDelay && ['Scheduled', 'In Transit'].includes(s.status)) html += `<button class="btn small outline" onclick="openDelayModal(${s.schedule_id})">Log Delay</button> `;
  if (canChangeStatus && s.status === 'Scheduled') html += `<button class="btn small danger" onclick="setStatus(${s.schedule_id}, 'Cancelled')">Cancel</button>`;
  return html;
}

async function setStatus(id, status) {
  try {
    await apiRequest(`/schedules/${id}/status`, { method: 'PATCH', body: { status } });
    showToast(`Schedule marked ${status}`);
    loadSchedules();
  } catch (err) { showToast(err.message, true); }
}

document.getElementById('filter-status').addEventListener('change', loadSchedules);

// ---------- New Schedule Modal ----------
const modal = document.getElementById('schedule-modal');

async function populateRouteOptions() {
  try {
    const res = await apiRequest('/routes?status=Active&limit=100');
    const select = document.getElementById('sc-route');
    select.innerHTML = res.data.map(r => `<option value="${r.route_id}" data-origin="${escapeHtml(r.origin)}" data-destination="${escapeHtml(r.destination)}">${escapeHtml(r.route_code)} — ${escapeHtml(r.route_name)}</option>`).join('');
  } catch (err) { showToast('Failed to load routes for scheduling', true); }
}

document.getElementById('btn-new-schedule').addEventListener('click', async () => {
  document.getElementById('schedule-form').reset();
  await populateRouteOptions();
  const select = document.getElementById('sc-route');
  if (select.options.length) {
    document.getElementById('sc-dep-loc').value = select.options[0].dataset.origin;
    document.getElementById('sc-arr-loc').value = select.options[0].dataset.destination;
  }
  modal.classList.add('open');
});

document.getElementById('sc-route').addEventListener('change', (e) => {
  const opt = e.target.selectedOptions[0];
  if (opt) {
    document.getElementById('sc-dep-loc').value = opt.dataset.origin;
    document.getElementById('sc-arr-loc').value = opt.dataset.destination;
  }
});

document.getElementById('btn-cancel-schedule').addEventListener('click', () => modal.classList.remove('open'));

document.getElementById('schedule-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    route_id: Number(document.getElementById('sc-route').value),
    departure_location: document.getElementById('sc-dep-loc').value,
    arrival_location: document.getElementById('sc-arr-loc').value,
    departure_time: document.getElementById('sc-dep-time').value,
    arrival_time: document.getElementById('sc-arr-time').value,
    vehicle_code: document.getElementById('sc-vehicle').value
  };
  try {
    await apiRequest('/schedules', { method: 'POST', body: payload });
    showToast('Schedule created');
    modal.classList.remove('open');
    loadSchedules();
  } catch (err) {
    // 409 conflict responses include the conflicting schedule in err.errors
    const detail = err.errors && err.errors[0] ? ` (conflicts with ${err.errors[0].schedule_code})` : '';
    showToast((err.message || 'Failed to create schedule') + detail, true);
  }
});

// ---------- Delay Modal ----------
const delayModal = document.getElementById('delay-modal');
function openDelayModal(scheduleId) {
  document.getElementById('delay-form').reset();
  document.getElementById('delay-schedule-id').value = scheduleId;
  delayModal.classList.add('open');
}
document.getElementById('btn-cancel-delay').addEventListener('click', () => delayModal.classList.remove('open'));

document.getElementById('delay-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('delay-schedule-id').value;
  const payload = {
    delay_reason: document.getElementById('delay-reason').value,
    revised_arrival_time: document.getElementById('delay-revised-time').value
  };
  try {
    await apiRequest(`/schedules/${id}/delay`, { method: 'POST', body: payload });
    showToast('Delay logged');
    delayModal.classList.remove('open');
    loadSchedules();
  } catch (err) { showToast(err.message, true); }
});

if (!canManageSchedules) document.getElementById('btn-new-schedule').classList.add('hidden');

loadSchedules();


async function viewScheduleDetails(id) {
  const modal = document.getElementById('schedule-detail-modal');
  const body = document.getElementById('schedule-detail-body');
  modal.classList.add('open'); body.innerHTML = '<div class="empty-state">Loading…</div>';
  try {
    const res = await apiRequest(`/schedules/${id}`); const s = res.data;
    const delays = (s.delays || []).map(d => `<div class="panel" style="margin:10px 0;padding:12px"><strong>${escapeHtml(d.delay_reason)}</strong><br><span class="settings-desc">Reported ${fmtDate(d.date_reported)} · Revised arrival ${fmtDate(d.revised_arrival_time)}</span></div>`).join('');
    document.getElementById('schedule-detail-title').textContent = s.schedule_code + ' — Details';
    body.innerHTML = `<p><strong>Route:</strong> ${escapeHtml(s.route_name)||'—'}</p><p><strong>Vehicle:</strong> ${escapeHtml(s.vehicle_code)}</p><p><strong>Status:</strong> ${escapeHtml(s.status)}</p><p><strong>Current arrival:</strong> ${fmtDate(s.arrival_time)}</p><h4>Delay History</h4>${delays || '<div class="empty-state">No delay reports</div>'}`;
  } catch (err) { body.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`; }
}
document.getElementById('btn-close-schedule-detail').addEventListener('click', () => document.getElementById('schedule-detail-modal').classList.remove('open'));
