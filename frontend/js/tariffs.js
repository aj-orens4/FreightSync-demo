Auth.requireLogin();
renderShell('tariffs', 'Rate & Tariff Management');

const canManageTariffs = hasRole('ADMIN', 'LOGISTICS_MANAGER');

async function loadTariffs() {
  const body = document.getElementById('tariffs-body');
  const status = document.getElementById('filter-status').value;
  const params = new URLSearchParams();
  if (status) params.set('status', status);

  try {
    const res = await apiRequest(`/tariffs?${params.toString()}`);
    if (res.data.length === 0) {
      body.innerHTML = '<tr><td colspan="8" class="empty-state">No tariffs found</td></tr>';
      return;
    }
    body.innerHTML = res.data.map(t => `
      <tr>
        <td>${escapeHtml(t.tariff_code)}</td>
        <td>${escapeHtml(t.service_type)}</td>
        <td>${escapeHtml(t.vehicle_type)}</td>
        <td>${fmtCurrency(t.base_rate)}</td>
        <td>${fmtCurrency(t.fuel_surcharge)}</td>
        <td><strong>${fmtCurrency(t.total_freight_cost)}</strong></td>
        <td><span class="badge ${t.status.replace(' ', '')}">${t.status}</span></td>
        <td>${workflowButtons(t)}</td>
      </tr>`).join('');
  } catch (err) {
    body.innerHTML = `<tr><td colspan="8" class="empty-state">Failed to load: ${err.message}</td></tr>`;
  }
}

function workflowButtons(t) {
  if (!canManageTariffs) return '';
  const btn = (label, action) => `<button class="btn small outline" onclick="transition(${t.tariff_id}, '${action}')">${label}</button>`;
  switch (t.status) {
    case 'Draft': return btn('Submit', 'submit');
    case 'Pending Approval': return btn('Approve', 'approve') + ' ' + btn('Reject', 'reject');
    case 'Approved': return btn('Archive', 'archive');
    case 'Rejected': return btn('Resubmit', 'submit');
    default: return '';
  }
}

async function transition(id, action) {
  try {
    await apiRequest(`/tariffs/${id}/${action}`, { method: 'PATCH' });
    showToast(`Tariff ${action}ed`);
    loadTariffs();
  } catch (err) { showToast(err.message, true); }
}

document.getElementById('filter-status').addEventListener('change', loadTariffs);

// ---------- Modal ----------
const modal = document.getElementById('tariff-modal');
document.getElementById('btn-new-tariff').addEventListener('click', () => {
  document.getElementById('tariff-form').reset();
  document.getElementById('t-total-preview').textContent = '₱0.00';
  modal.classList.add('open');
});
document.getElementById('btn-cancel-tariff').addEventListener('click', () => modal.classList.remove('open'));

function recalcPreview() {
  const base = Number(document.getElementById('t-base').value) || 0;
  const fuel = Number(document.getElementById('t-fuel').value) || 0;
  const addl = Number(document.getElementById('t-addl').value) || 0;
  document.getElementById('t-total-preview').textContent = fmtCurrency(base + fuel + addl);
}
['t-base', 't-fuel', 't-addl'].forEach(id => document.getElementById(id).addEventListener('input', recalcPreview));

document.getElementById('tariff-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    service_type: document.getElementById('t-service').value,
    vehicle_type: document.getElementById('t-vehicle').value,
    weight_min_kg: Number(document.getElementById('t-weight-min').value),
    weight_max_kg: Number(document.getElementById('t-weight-max').value),
    distance_min_km: Number(document.getElementById('t-dist-min').value),
    distance_max_km: Number(document.getElementById('t-dist-max').value),
    base_rate: Number(document.getElementById('t-base').value),
    fuel_surcharge: Number(document.getElementById('t-fuel').value) || 0,
    additional_charges: Number(document.getElementById('t-addl').value) || 0,
    effective_date: document.getElementById('t-effective').value,
    expiration_date: document.getElementById('t-expiration').value || null
  };

  try {
    await apiRequest('/tariffs', { method: 'POST', body: payload });
    showToast('Tariff created as Draft');
    modal.classList.remove('open');
    loadTariffs();
  } catch (err) { showToast(err.message, true); }
});

if (!canManageTariffs) document.getElementById('btn-new-tariff').classList.add('hidden');

loadTariffs();
