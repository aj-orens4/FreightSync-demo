/**
 * Global personal-reminder notifier. Include this via
 * <script src="js/reminders.js"></script> (after api.js) on every
 * authenticated page, so a reminder fires no matter which page the user is
 * currently on — not just the Calendar page.
 *
 * How "real-time" works here, honestly: this is a polling-based app (no
 * websocket/server-push), so reminders are re-fetched from the server every
 * REFRESH_INTERVAL_MS to pick up anything added/edited (including from
 * another tab or device). But the actual FIRING check runs every
 * TICK_INTERVAL_MS (1 second) against the browser's own clock, comparing it
 * to each reminder's exact stored remind_at — so a reminder fires within
 * about a second of its target time, not just "eventually on next refresh."
 */
(function () {
  if (!window.Auth || !Auth.getToken()) return; // not logged in (e.g. index.html) — nothing to do

  const REFRESH_INTERVAL_MS = 60 * 1000;
  const TICK_INTERVAL_MS = 1000;
  let cache = []; // reminders due in the near future, not yet completed

  async function refresh() {
    try {
      const now = new Date();
      const to = new Date(now.getTime() + 24 * 60 * 60 * 1000); // look ahead 24h
      const from = new Date(now.getTime() - 5 * 60 * 1000); // small lookback so a just-missed one still fires
      const res = await apiRequest(`/reminders?from=${from.toISOString().slice(0, 19)}&to=${to.toISOString().slice(0, 19)}`);
      cache = res.data.filter(r => !r.is_completed);
    } catch (e) { /* non-fatal — keep using the last known cache */ }
  }

  async function markNotified(reminder) {
    reminder.notified = 1; // update local copy immediately so we never double-fire this tick
    try { await apiRequest(`/reminders/${reminder.reminder_id}`, { method: 'PUT', body: { notified: true } }); }
    catch (e) { /* non-fatal — worst case it re-notifies after the next refresh */ }
  }

  function fire(reminder) {
    const timeStr = new Date(reminder.remind_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
    showToast(`🔔 Reminder: ${reminder.title} (${timeStr})`);

    if (window.Notification && Notification.permission === 'granted') {
      try {
        const n = new Notification(reminder.title, {
          body: reminder.note || `Scheduled for ${timeStr}`,
          tag: `fms-reminder-${reminder.reminder_id}`
        });
        n.onclick = () => { window.focus(); window.location.href = 'calendar.html'; };
      } catch (e) { /* Notification constructor can throw on some platforms (e.g. iOS Safari) — toast above already covered it */ }
    }
  }

  function tick() {
    const now = Date.now();
    cache.forEach(r => {
      if (r.notified || r.is_completed) return;
      if (new Date(r.remind_at).getTime() <= now) {
        fire(r);
        markNotified(r);
      }
    });
  }

  refresh();
  setInterval(refresh, REFRESH_INTERVAL_MS);
  setInterval(tick, TICK_INTERVAL_MS);

  // Exposed so calendar.js can push a freshly-created/edited reminder into
  // the cache immediately, instead of waiting up to REFRESH_INTERVAL_MS.
  window.FMSReminders = { refresh, get cache() { return cache; } };
})();
