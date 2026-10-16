Auth.requireLogin();
renderShell('calendar', 'Transit Calendar');

let currentMonth = new Date();
currentMonth.setDate(1);

const monthLabel = document.getElementById('calendar-month-label');
const grid = document.getElementById('calendar-grid');
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function isoDate(d) { const pad=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function toLocalDatetimeValue(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---------- Notification permission banner ----------
function refreshNotifBanner() {
  const banner = document.getElementById('notif-banner');
  if (!window.Notification) { banner.style.display = 'none'; return; }
  banner.style.display = Notification.permission === 'default' ? 'flex' : 'none';
}
document.getElementById('btn-enable-notifs').addEventListener('click', async () => {
  try {
    const perm = await Notification.requestPermission();
    showToast(perm === 'granted' ? 'Notifications enabled — reminders will alert you in real time.' : 'Notifications were not enabled.', perm !== 'granted');
  } catch (e) { /* older browsers use a callback form; permission simply won't change */ }
  refreshNotifBanner();
});
refreshNotifBanner();

// ---------- Main grid ----------
async function loadCalendar() {
  monthLabel.textContent = currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

  // Grid always shows full weeks, so it may include a few days from adjacent months.
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const gridEnd = new Date(monthEnd);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

  grid.innerHTML = '<div class="empty-state">Loading…</div>';

  let scheduleMap = {};
  let reminders = [];
  try {
    const [schedRes, remRes] = await Promise.all([
      apiRequest(`/schedules/calendar?from=${isoDate(gridStart)}T00:00:00&to=${isoDate(gridEnd)}T23:59:59`),
      apiRequest(`/reminders?from=${isoDate(gridStart)}T00:00:00&to=${isoDate(gridEnd)}T23:59:59`)
    ]);
    scheduleMap = schedRes.data; // { "YYYY-MM-DD": [schedule, ...] }
    reminders = remRes.data;
  } catch (err) {
    grid.innerHTML = `<div class="empty-state">Failed to load calendar: ${err.message}</div>`;
    return;
  }

  // Group reminders by local date (YYYY-MM-DD) the same way schedules are grouped.
  const reminderMap = {};
  reminders.forEach(r => {
    const dateStr = isoDate(new Date(r.remind_at));
    (reminderMap[dateStr] = reminderMap[dateStr] || []).push(r);
  });

  const todayStr = isoDate(new Date());
  const cells = DOW.map(d => `<div class="calendar-dow">${d}</div>`).join('');

  const dayCells = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    const dateStr = isoDate(cursor);
    const inMonth = cursor.getMonth() === currentMonth.getMonth();
    const daySchedules = scheduleMap[dateStr] || [];
    const dayReminders = reminderMap[dateStr] || [];
    const visibleSchedules = daySchedules.slice(0, 2);
    const scheduleOverflow = daySchedules.length - visibleSchedules.length;
    const visibleReminders = dayReminders.slice(0, 2);
    const reminderOverflow = dayReminders.length - visibleReminders.length;

    dayCells.push(`
      <div class="calendar-cell ${inMonth ? '' : 'other-month'} ${dateStr === todayStr ? 'today' : ''}" onclick="openDay('${dateStr}')">
        <div class="cell-date">${cursor.getDate()}</div>
        ${visibleSchedules.map(s => `<div class="calendar-event ${s.status.replace(' ', '')}" title="${escapeHtml(s.schedule_code)} — ${escapeHtml(s.route_name || '')}">${escapeHtml(s.schedule_code)} ${escapeHtml(s.vehicle_code)}</div>`).join('')}
        ${scheduleOverflow > 0 ? `<div class="calendar-event" style="background:var(--steel)">+${scheduleOverflow} more</div>` : ''}
        ${visibleReminders.map(r => `<div class="calendar-event reminder ${r.is_completed ? 'is-completed' : ''}" title="${escapeHtml(r.title)}">📌 ${escapeHtml(r.title)}</div>`).join('')}
        ${reminderOverflow > 0 ? `<div class="calendar-event reminder">📌 +${reminderOverflow} more</div>` : ''}
      </div>`);
    cursor.setDate(cursor.getDate() + 1);
  }

  grid.innerHTML = cells + dayCells.join('');
  window._calendarSchedules = scheduleMap;
  window._calendarReminders = reminderMap;
}

// ---------- Day detail modal ----------
function openDay(dateStr) {
  const daySchedules = (window._calendarSchedules && window._calendarSchedules[dateStr]) || [];
  const dayReminders = (window._calendarReminders && window._calendarReminders[dateStr]) || [];
  document.getElementById('day-modal-title').textContent = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', {weekday:'long', year:'numeric', month:'long', day:'numeric'});
  document.getElementById('day-schedule-count').textContent = daySchedules.length;
  document.getElementById('day-reminder-count').textContent = dayReminders.length;
  const list=document.getElementById('day-schedule-list');
  list.innerHTML=daySchedules.length?daySchedules.map(s=>`<article class="schedule-summary-card"><div class="schedule-summary-main"><span class="schedule-code">${escapeHtml(s.schedule_code)}</span><strong>${escapeHtml(s.route_name)||'Route not assigned'}</strong><small>${escapeHtml(s.vehicle_code||'No vehicle')}</small></div><div class="schedule-summary-time"><span>Departure<strong>${fmtDate(s.departure_time)}</strong></span><span>Arrival<strong>${fmtDate(s.arrival_time)}</strong></span></div><span class="badge ${String(s.status).replace(' ','')}">${escapeHtml(s.status)}</span></article>`).join(''):`<div class="day-empty"><span class="day-empty__icon">↗</span><strong>No freight schedules</strong><p>There are no departures or arrivals planned for this date.</p></div>`;
  renderDayReminders(dayReminders);
  document.getElementById('btn-add-reminder-for-day').onclick = () => openReminderModal(null, dateStr);
  document.getElementById('day-modal').classList.add('open');
}

function renderDayReminders(dayReminders) {
  const list = document.getElementById('day-reminders-list');
  if (!dayReminders.length) {
    list.innerHTML = '<div class="day-empty compact"><span class="day-empty__icon">✓</span><strong>No reminders yet</strong><p>Add a reminder if you need to follow up on something this day.</p></div>';
    return;
  }
  list.innerHTML = dayReminders.map(r => `
    <div class="reminder-row ${r.is_completed ? 'is-completed' : ''}">
      <label class="reminder-check">
        <input type="checkbox" ${r.is_completed ? 'checked' : ''} onchange="toggleReminderComplete(${r.reminder_id}, this.checked)">
      </label>
      <div class="reminder-row__body">
        <div class="reminder-row__title">${escapeHtml(r.title)}</div>
        <div class="reminder-row__meta">${new Date(r.remind_at).toLocaleString('en-PH', { hour: 'numeric', minute: '2-digit', weekday: 'short' })}${r.note ? ' · ' + escapeHtml(r.note) : ''}</div>
      </div>
      <button type="button" class="btn small outline" onclick='editReminderFromRow(${JSON.stringify(r).replace(/'/g, "&#39;")})'>Edit</button>
    </div>`).join('');
}

function editReminderFromRow(r) { openReminderModal(r); }

async function toggleReminderComplete(id, isCompleted) {
  try {
    await apiRequest(`/reminders/${id}`, { method: 'PUT', body: { is_completed: isCompleted } });
    showToast(isCompleted ? 'Marked as done' : 'Marked as not done');
    await loadCalendar();
    if (window.FMSReminders) FMSReminders.refresh();
  } catch (err) { showToast(err.message, true); }
}

document.getElementById('btn-close-day').addEventListener('click', () => {
  document.getElementById('day-modal').classList.remove('open');
});

// ---------- Add/Edit Reminder modal ----------
const reminderModal = document.getElementById('reminder-modal');

function openReminderModal(reminder, prefillDateStr) {
  document.getElementById('reminder-form').reset();
  document.getElementById('reminder-id').value = '';
  document.getElementById('btn-delete-reminder').style.display = 'none';

  if (reminder) {
    document.getElementById('reminder-modal-title').textContent = 'Edit Reminder';
    document.getElementById('reminder-id').value = reminder.reminder_id;
    document.getElementById('reminder-title').value = reminder.title;
    document.getElementById('reminder-note').value = reminder.note || '';
    document.getElementById('reminder-datetime').value = toLocalDatetimeValue(new Date(reminder.remind_at));
    document.getElementById('btn-delete-reminder').style.display = '';
  } else {
    document.getElementById('reminder-modal-title').textContent = 'Add Reminder';
    const base = prefillDateStr ? new Date(prefillDateStr + 'T09:00:00') : new Date(Date.now() + 15 * 60 * 1000);
    document.getElementById('reminder-datetime').value = toLocalDatetimeValue(base);
  }
  reminderModal.classList.add('open');
}

document.getElementById('btn-add-reminder').addEventListener('click', () => openReminderModal(null));
document.getElementById('btn-cancel-reminder').addEventListener('click', () => reminderModal.classList.remove('open'));

document.getElementById('reminder-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('reminder-id').value;
  const payload = {
    title: document.getElementById('reminder-title').value,
    note: document.getElementById('reminder-note').value,
    remind_at: document.getElementById('reminder-datetime').value
  };
  try {
    if (id) {
      // Editing the time means it may need to notify again.
      await apiRequest(`/reminders/${id}`, { method: 'PUT', body: { ...payload, notified: false } });
      showToast('Reminder updated');
    } else {
      await apiRequest('/reminders', { method: 'POST', body: payload });
      showToast('Reminder pinned to your calendar');
    }
    reminderModal.classList.remove('open');
    document.getElementById('day-modal').classList.remove('open');
    await loadCalendar();
    if (window.FMSReminders) FMSReminders.refresh();
  } catch (err) { showToast(err.message, true); }
});

document.getElementById('btn-delete-reminder').addEventListener('click', async () => {
  const id = document.getElementById('reminder-id').value;
  if (!id) return;
  if (!confirm('Delete this reminder?')) return;
  try {
    await apiRequest(`/reminders/${id}`, { method: 'DELETE' });
    showToast('Reminder deleted');
    reminderModal.classList.remove('open');
    document.getElementById('day-modal').classList.remove('open');
    await loadCalendar();
    if (window.FMSReminders) FMSReminders.refresh();
  } catch (err) { showToast(err.message, true); }
});

document.getElementById('btn-prev-month').addEventListener('click', () => {
  currentMonth.setMonth(currentMonth.getMonth() - 1);
  loadCalendar();
});
document.getElementById('btn-next-month').addEventListener('click', () => {
  currentMonth.setMonth(currentMonth.getMonth() + 1);
  loadCalendar();
});
document.getElementById('btn-today').addEventListener('click', () => {
  currentMonth = new Date();
  currentMonth.setDate(1);
  loadCalendar();
});

loadCalendar();
