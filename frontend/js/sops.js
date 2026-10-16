Auth.requireLogin();
renderShell('sops', 'Standard Operating Procedure Manager');

const canAuthor = hasRole('ADMIN', 'LOGISTICS_MANAGER', 'ROUTE_PLANNER');
const canApprove = hasRole('ADMIN', 'LOGISTICS_MANAGER');

async function loadSops() {
  const body = document.getElementById('sops-body');
  const q = document.getElementById('filter-q').value;
  const category = document.getElementById('filter-category').value;
  const status = document.getElementById('filter-status').value;

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (category) params.set('category', category);
  if (status) params.set('status', status);

  try {
    const res = await apiRequest(`/sops?${params.toString()}`);
    if (res.data.length === 0) {
      body.innerHTML = '<tr><td colspan="7" class="empty-state">No SOPs found</td></tr>';
      return;
    }
    body.innerHTML = res.data.map(s => `
      <tr>
        <td>${escapeHtml(s.sop_code)}</td>
        <td>${escapeHtml(s.sop_title)}</td>
        <td>${escapeHtml(s.category)}</td>
        <td>v${s.version_number}</td>
        <td><span class="badge ${s.approval_status.replace(' ', '')}">${s.approval_status}</span></td>
        <td>${fmtDate(s.date_updated)}</td>
        <td>${workflowButtons(s)}</td>
      </tr>`).join('');
  } catch (err) {
    body.innerHTML = `<tr><td colspan="7" class="empty-state">Failed to load: ${err.message}</td></tr>`;
  }
}

function workflowButtons(s) {
  const btn = (label, action) => `<button class="btn small outline" onclick="transition(${s.sop_id}, '${action}')">${label}</button>`;
  let html = '';
  if (canAuthor && (s.approval_status === 'Draft' || s.approval_status === 'Rejected')) html += btn('Submit', 'submit') + ' ';
  if (canApprove && s.approval_status === 'Submitted') html += btn('Approve', 'approve') + ' ' + btn('Reject', 'reject') + ' ';
  if (canApprove && s.approval_status === 'Approved') html += btn('Publish', 'publish') + ' ';
  if (canApprove && (s.approval_status === 'Published' || s.approval_status === 'Approved')) html += btn('Archive', 'archive');
  return html;
}

async function transition(id, action) {
  try {
    await apiRequest(`/sops/${id}/${action}`, { method: 'PATCH' });
    showToast(`SOP ${action}ed`);
    loadSops();
  } catch (err) { showToast(err.message, true); }
}

document.getElementById('filter-q').addEventListener('input', debounce(loadSops));
document.getElementById('filter-category').addEventListener('change', loadSops);
document.getElementById('filter-status').addEventListener('change', loadSops);

const modal = document.getElementById('sop-modal');
document.getElementById('btn-new-sop').addEventListener('click', () => {
  document.getElementById('sop-form').reset();
  modal.classList.add('open');
});
document.getElementById('btn-cancel-sop').addEventListener('click', () => modal.classList.remove('open'));

document.getElementById('sop-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    sop_title: document.getElementById('s-title').value,
    category: document.getElementById('s-category').value,
    description: document.getElementById('s-description').value
  };
  try {
    await apiRequest('/sops', { method: 'POST', body: payload });
    showToast('SOP created as Draft');
    modal.classList.remove('open');
    loadSops();
  } catch (err) { showToast(err.message, true); }
});

if (!canAuthor) document.getElementById('btn-new-sop').classList.add('hidden');

loadSops();
