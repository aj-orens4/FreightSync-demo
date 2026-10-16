Auth.requireLogin();
renderShell('settings', 'Settings');

const accentInput = document.getElementById('picker-accent');
const navyInput = document.getElementById('picker-navy');
const currentSessionUser = Auth.getUser();


// Settings navigation — keeps account/security/preferences separated like a real account portal.
function openSettingsTab(name){
  if(name==='backup' && !hasRole('ADMIN')) return;
  document.querySelectorAll('.settings-tab').forEach(el=>el.classList.toggle('active',el.id===`settings-tab-${name}`));
  document.querySelectorAll('.settings-nav-item').forEach(el=>el.classList.toggle('active',el.dataset.settingsTab===name));
}
document.querySelectorAll('.settings-nav-item').forEach(btn=>btn.addEventListener('click',()=>openSettingsTab(btn.dataset.settingsTab)));


/** Darkens a hex color by a percentage (0-1) — used to derive hover-state shades
 *  from the single color the user picks, so they only have to choose once. */
function shade(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  let r = (num >> 16) - Math.round(255 * percent);
  let g = ((num >> 8) & 0x00FF) - Math.round(255 * percent);
  let b = (num & 0x0000FF) - Math.round(255 * percent);
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
/** Lightens a hex color — used for the navy "light" hover/active shade. */
function tint(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  let r = (num >> 16) + Math.round(255 * percent);
  let g = ((num >> 8) & 0x00FF) + Math.round(255 * percent);
  let b = (num & 0x0000FF) + Math.round(255 * percent);
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

let activeThemeChoice = 'light';
let activeFontChoice = 'medium';

function currentSettingsFromForm() {
  const accent = accentInput.value;
  const navy = navyInput.value;
  const widgets = {};
  document.querySelectorAll('[data-widget-key]').forEach(cb => { widgets[cb.dataset.widgetKey] = cb.checked; });
  return {
    theme: activeThemeChoice,
    fontSize: activeFontChoice,
    accent,
    accentDark: shade(accent, 0.15),
    navy,
    navyLight: tint(navy, 0.15),
    widgets
  };
}

function livePreview() {
  FMSTheme.apply(currentSettingsFromForm());
}

function setThemeChoice(choice) {
  activeThemeChoice = choice;
  document.getElementById('theme-option-light').classList.toggle('active', choice === 'light');
  document.getElementById('theme-option-dark').classList.toggle('active', choice === 'dark');
  livePreview();
}

function setFontChoice(choice) {
  activeFontChoice = choice;
  ['small', 'medium', 'large'].forEach(f =>
    document.getElementById(`font-option-${f}`).classList.toggle('active', choice === f));
  livePreview();
}

document.getElementById('theme-option-light').addEventListener('click', () => setThemeChoice('light'));
document.getElementById('theme-option-dark').addEventListener('click', () => setThemeChoice('dark'));
document.getElementById('font-option-small').addEventListener('click', () => setFontChoice('small'));
document.getElementById('font-option-medium').addEventListener('click', () => setFontChoice('medium'));
document.getElementById('font-option-large').addEventListener('click', () => setFontChoice('large'));

accentInput.addEventListener('input', livePreview);
navyInput.addEventListener('input', livePreview);

document.querySelectorAll('.preset-swatches').forEach(group => {
  const target = group.dataset.target;
  group.querySelectorAll('.preset-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      const input = target === 'accent' ? accentInput : navyInput;
      input.value = sw.dataset.color;
      group.querySelectorAll('.preset-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      livePreview();
    });
  });
});

document.getElementById('btn-save').addEventListener('click', () => {
  FMSTheme.save(currentSettingsFromForm());
  showToast('Appearance settings saved — they will apply every time you sign in on this device.');
});

document.getElementById('btn-reset').addEventListener('click', () => {
  FMSTheme.save(FMSTheme.DEFAULTS);
  loadIntoForm(FMSTheme.DEFAULTS);
  showToast('Appearance reset to default');
});

function loadIntoForm(settings) {
  accentInput.value = settings.accent;
  navyInput.value = settings.navy;
  setThemeChoice(settings.theme === 'dark' ? 'dark' : 'light');
  setFontChoice(settings.fontSize || 'medium');
  const widgets = Object.assign({}, FMSTheme.DEFAULTS.widgets, settings.widgets || {});
  document.querySelectorAll('[data-widget-key]').forEach(cb => { cb.checked = widgets[cb.dataset.widgetKey] !== false; });
}

loadIntoForm(FMSTheme.load());

// ---------- Account Profile ----------
let loadedProfile = null;
let editingProfile = false;
async function loadProfile() {
  try {
    const response = await apiRequest('/auth/me');
    loadedProfile = response.data;
    document.getElementById('profile-name-view').textContent = loadedProfile.full_name || '—';
    document.getElementById('profile-full-name').value = loadedProfile.full_name || '';
    document.getElementById('profile-username').textContent = loadedProfile.username || '—';
    document.getElementById('profile-email').textContent = loadedProfile.email || '—';
    document.getElementById('profile-role').textContent = (loadedProfile.role_name || '').replace(/_/g, ' ') || '—';
    document.getElementById('profile-provider').textContent = loadedProfile.provider_id ? `Provider #${loadedProfile.provider_id}` : 'Not assigned';
    document.getElementById('profile-status').textContent = loadedProfile.is_active ? 'Active' : 'Inactive';
    const pp=document.getElementById('profile-photo-preview'); if(pp){ if(loadedProfile.profile_photo){pp.innerHTML=`<img src="${loadedProfile.profile_photo}" alt="Profile photo">`;} else {pp.textContent=(loadedProfile.full_name||loadedProfile.username||'FS').split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();} }
  } catch (err) { showToast(err.message, true); }
}
function setProfileEdit(enabled) {
  editingProfile = enabled;
  document.getElementById('profile-name-view').hidden = enabled;
  document.getElementById('profile-full-name').hidden = !enabled;
  document.getElementById('profile-edit-actions').hidden = !enabled;
  document.getElementById('btn-edit-profile').hidden = enabled;
  if (enabled) { document.getElementById('profile-full-name').focus(); document.getElementById('profile-full-name').select(); }
}
document.getElementById('btn-edit-profile').addEventListener('click', () => setProfileEdit(true));
document.getElementById('btn-cancel-profile').addEventListener('click', () => { document.getElementById('profile-full-name').value = loadedProfile?.full_name || ''; setProfileEdit(false); });
document.getElementById('btn-save-profile').addEventListener('click', async () => {
  const full_name = document.getElementById('profile-full-name').value.trim();
  if (full_name.length < 2) { showToast('Full name must contain at least 2 characters', true); return; }
  try {
    await apiRequest('/auth/me', { method: 'PATCH', body: { full_name } });
    const user = Auth.getUser(); user.full_name = full_name; Auth.setSession(Auth.getToken(), user);
    loadedProfile.full_name = full_name; document.getElementById('profile-name-view').textContent = full_name;
    setProfileEdit(false); renderShell('settings', 'Settings'); showToast('Name updated');
  } catch (err) { showToast(err.message, true); }
});
loadProfile();

// ---------- Notifications ----------
function refreshNotifStatus() {
  const badge = document.getElementById('notif-status-badge');
  const btn = document.getElementById('btn-settings-enable-notifs');
  if (!window.Notification) {
    badge.textContent = 'Not supported by this browser';
    badge.className = 'badge Inactive';
    btn.disabled = true;
    return;
  }
  if (Notification.permission === 'granted') {
    badge.textContent = 'Enabled';
    badge.className = 'badge Active';
    btn.disabled = true;
    btn.textContent = 'Enabled';
  } else if (Notification.permission === 'denied') {
    badge.textContent = 'Blocked by browser';
    badge.className = 'badge Inactive';
    btn.disabled = true;
    btn.textContent = 'Blocked — check browser site settings';
  } else {
    badge.textContent = 'Not enabled';
    badge.className = 'badge Draft';
    btn.disabled = false;
    btn.textContent = 'Enable Browser Notifications';
  }
}
document.getElementById('btn-settings-enable-notifs').addEventListener('click', async () => {
  try {
    await Notification.requestPermission();
  } catch (e) { /* older browsers use a callback form; permission simply won't change */ }
  refreshNotifStatus();
});
refreshNotifStatus();


// ---------- Password Security ----------
const newPasswordInput = document.getElementById('new-password');
const confirmPasswordInput = document.getElementById('confirm-password');
const strengthEl = document.getElementById('password-strength');
function passwordProblem(value) {
  if (value.length < 8) return 'Too weak — use at least 8 characters.';
  if (!/[A-Z]/.test(value)) return 'Too weak — add an uppercase letter.';
  if (!/[a-z]/.test(value)) return 'Too weak — add a lowercase letter.';
  if (!/\d/.test(value)) return 'Too weak — add a number.';
  if (!/[^A-Za-z0-9]/.test(value)) return 'Too weak — add a special character.';
  return '';
}
function updatePasswordStrength() {
  const value = newPasswordInput.value;
  if (!value) { strengthEl.textContent='Minimum 8 characters with uppercase, lowercase, number, and special character.'; strengthEl.className='password-feedback'; return; }
  const problem=passwordProblem(value);
  strengthEl.textContent=problem || 'Strong password — all requirements are met.';
  strengthEl.className='password-feedback '+(problem?'weak':'strong');
}
newPasswordInput.addEventListener('input', updatePasswordStrength);

document.getElementById('btn-change-password').addEventListener('click', async () => {
  const current_password = document.getElementById('current-password').value;
  const new_password = newPasswordInput.value;
  const confirm_password = confirmPasswordInput.value;
  if (!current_password) { showToast('Enter your current password', true); return; }
  const problem = passwordProblem(new_password); if (problem) { showToast(problem, true); return; }
  if (new_password !== confirm_password) { showToast('New passwords do not match', true); return; }
  if (current_password === new_password) { showToast('Choose a new password different from your current password', true); return; }
  try {
    await apiRequest('/auth/change-password', { method: 'PATCH', body: { current_password, new_password } });
    document.getElementById('current-password').value=''; newPasswordInput.value=''; confirmPasswordInput.value=''; updatePasswordStrength();
    const u=Auth.getUser(); if(u){u.must_change_password=false; Auth.setSession(Auth.getToken(),u);}
    document.getElementById('first-login-notice').style.display='none'; showToast('Password changed successfully');
    // Always release a first-login account after a successful password change.
    if (currentSessionUser && currentSessionUser.must_change_password) setTimeout(()=>location.replace('dashboard.html'),500);
  } catch (err) { showToast(err.message, true); }
});


// ---------- Profile Photo ----------
const photoInput=document.getElementById('profile-photo-input');
const photoBtn=document.getElementById('btn-upload-photo');
if(photoBtn) photoBtn.addEventListener('click',()=>{const f=photoInput.files[0];if(!f)return showToast('Choose an image first',true);if(!['image/png','image/jpeg','image/webp'].includes(f.type))return showToast('Use PNG, JPEG, or WebP',true);if(f.size>1024*1024)return showToast('Profile photo must be 1 MB or smaller',true);const reader=new FileReader();reader.onload=async()=>{try{await apiRequest('/auth/me',{method:'PATCH',body:{full_name:loadedProfile.full_name,phone:loadedProfile.phone||null,profile_photo:reader.result}});loadedProfile.profile_photo=reader.result;const sessionUser=Auth.getUser();if(sessionUser){sessionUser.profile_photo=reader.result;Auth.setSession(Auth.getToken(),sessionUser);}document.getElementById('profile-photo-preview').innerHTML=`<img src="${reader.result}" alt="Profile photo">`;renderShell('settings','Settings');showToast('Profile photo updated');}catch(e){showToast(e.message,true)}};reader.readAsDataURL(f);});

// Administrator-only recovery workspace, hidden from non-admin roles.
if (hasRole('ADMIN')) {
  document.getElementById('settings-backup-nav').hidden=false;
  if (new URLSearchParams(location.search).get('tab')==='backup') openSettingsTab('backup');
}
