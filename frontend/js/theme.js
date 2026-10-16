/**
 * Applies the user's saved appearance settings (theme + custom colors) as early
 * as possible. Include this via <script src="js/theme.js"></script> in the
 * <head> of every page, BEFORE the stylesheet link is not required (CSS vars
 * set here override the stylesheet regardless of load order) — but placing it
 * in <head> means it runs before first paint, avoiding a flash of the default
 * theme on load.
 */
(function () {
  var DEFAULTS = {
    theme: 'light',
    accent: '#2563EB',
    accentDark: '#1D4ED8',
    navy: '#0F172A',
    navyLight: '#1E293B',
    fontSize: 'medium',
    widgets: { kpis: true, map: true, activity: true, routeChart: true, scheduleChart: true, upcoming: true }
  };

  function loadSettings() {
    try {
      var raw = localStorage.getItem('fms_settings');
      if (!raw) return DEFAULTS;
      return Object.assign({}, DEFAULTS, JSON.parse(raw));
    } catch (e) {
      return DEFAULTS;
    }
  }

  function apply(settings) {
    var root = document.documentElement;
    root.setAttribute('data-theme', settings.theme === 'dark' ? 'dark' : 'light');
    root.setAttribute('data-font-size', settings.fontSize || 'medium');
    root.style.setProperty('--accent', settings.accent);
    root.style.setProperty('--accent-dark', settings.accentDark);
    root.style.setProperty('--navy', settings.navy);
    root.style.setProperty('--navy-light', settings.navyLight);
  }

  window.FMSTheme = {
    DEFAULTS: DEFAULTS,
    load: loadSettings,
    apply: apply,
    save: function (settings) {
      localStorage.setItem('fms_settings', JSON.stringify(settings));
      apply(settings);
    }
  };

  apply(loadSettings());
  // Apply compact-sidebar state before first paint to prevent the brief expand/collapse flash on navigation.
  document.documentElement.setAttribute('data-sidebar', localStorage.getItem('fms_sidebar_collapsed') === '1' ? 'compact' : 'expanded');
})();
