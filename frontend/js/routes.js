Auth.requireLogin();
renderShell('routes', 'Service Network & Route Planner');

const canManage = hasRole('ADMIN', 'LOGISTICS_MANAGER', 'ROUTE_PLANNER');

async function loadRoutes() {
  const body = document.getElementById('routes-body');
  const status = document.getElementById('filter-status').value;
  const origin = document.getElementById('filter-origin').value;
  const destination = document.getElementById('filter-destination').value;

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (origin) params.set('origin', origin);
  if (destination) params.set('destination', destination);

  try {
    const res = await apiRequest(`/routes?${params.toString()}`);
    if (res.data.length === 0) {
      body.innerHTML = '<tr><td colspan="8" class="empty-state">No routes found</td></tr>';
      return;
    }
    body.innerHTML = res.data.map(r => `
      <tr>
        <td>${escapeHtml(r.route_code)}</td>
        <td>${escapeHtml(r.route_name)}</td>
        <td>${escapeHtml(r.origin)}</td>
        <td>${escapeHtml(r.destination)}</td>
        <td>${r.total_distance_km} km</td>
        <td><span class="badge ${r.route_status.replace(' ', '')}">${r.route_status}</span></td>
        <td>${escapeHtml(r.provider_name) || '—'}</td>
        <td>
          ${canManage ? `<button class="btn small outline" onclick="editRoute(${r.route_id})">Edit</button>` : ''}
          ${hasRole('ADMIN','LOGISTICS_MANAGER') ? statusButtons(r) : ''}
        </td>
      </tr>`).join('');
  } catch (err) {
    body.innerHTML = `<tr><td colspan="8" class="empty-state">Failed to load: ${err.message}</td></tr>`;
  }
}

function statusButtons(r) {
  if (r.route_status === 'Under Review') {
    return `<button class="btn small accent" onclick="setStatus(${r.route_id}, 'Active')">Activate</button>`;
  }
  if (r.route_status === 'Active') {
    return `<button class="btn small outline" onclick="setStatus(${r.route_id}, 'Inactive')">Deactivate</button>`;
  }
  if (r.route_status === 'Inactive') {
    return `<button class="btn small accent" onclick="setStatus(${r.route_id}, 'Active')">Reactivate</button>`;
  }
  return '';
}

async function setStatus(id, status) {
  try {
    await apiRequest(`/routes/${id}/status`, { method: 'PATCH', body: { status } });
    showToast(`Route status updated to ${status}`);
    loadRoutes();
  } catch (err) { showToast(err.message, true); }
}

// ---------- Modal / form handling ----------
const modal = document.getElementById('route-modal');
const stopsContainer = document.getElementById('stops-container');

function addStopRow(name = '', distance = '', lat = '', lng = '') {
  const row = document.createElement('div');
  row.className = 'stop-row';
  row.draggable = true;
  row.innerHTML = `
    <span class="stop-drag-handle" title="Drag to reorder">&#8942;&#8942;</span>
    <input type="text" placeholder="Stop name" class="stop-name" value="${escapeHtml(name)}">
    <input type="number" placeholder="Distance (km)" class="stop-distance" value="${escapeHtml(distance)}" style="width:110px">
    <input type="number" step="0.0001" placeholder="Latitude" class="stop-lat" value="${escapeHtml(lat)}" style="width:100px" title="Latitude (for map)">
    <input type="number" step="0.0001" placeholder="Longitude" class="stop-lng" value="${escapeHtml(lng)}" style="width:100px" title="Longitude (for map)">
    <button type="button" class="btn small outline" onclick="this.parentElement.remove()">Remove</button>`;
  attachDragHandlers(row);
  stopsContainer.appendChild(row);
}

let draggedRow = null;

function attachDragHandlers(row) {
  row.addEventListener('dragstart', () => {
    draggedRow = row;
    row.classList.add('dragging');
  });
  row.addEventListener('dragend', () => {
    row.classList.remove('dragging');
    draggedRow = null;
    stopsContainer.querySelectorAll('.stop-row').forEach(r => r.classList.remove('drag-over'));
  });
  row.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (row !== draggedRow) row.classList.add('drag-over');
  });
  row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
  row.addEventListener('drop', (e) => {
    e.preventDefault();
    row.classList.remove('drag-over');
    if (!draggedRow || row === draggedRow) return;
    const rows = Array.from(stopsContainer.children);
    const draggedIndex = rows.indexOf(draggedRow);
    const targetIndex = rows.indexOf(row);
    if (draggedIndex < targetIndex) {
      row.after(draggedRow);
    } else {
      row.before(draggedRow);
    }
  });
}

document.getElementById('btn-add-stop').addEventListener('click', () => addStopRow());
document.getElementById('btn-new-route').addEventListener('click', () => openModal());
document.getElementById('btn-cancel-route').addEventListener('click', () => modal.classList.remove('open'));
document.getElementById('filter-status').addEventListener('change', loadRoutes);
document.getElementById('filter-origin').addEventListener('input', debounce(loadRoutes));
document.getElementById('filter-destination').addEventListener('input', debounce(loadRoutes));

function openModal(route = null) {
  document.getElementById('route-form').reset();
  stopsContainer.innerHTML = '';
  document.getElementById('route-id').value = '';

  if (route) {
    document.getElementById('route-modal-title').textContent = `Edit Route — ${route.route_code}`;
    document.getElementById('route-id').value = route.route_id;
    document.getElementById('route-name').value = route.route_name;
    document.getElementById('route-origin').value = route.origin;
    document.getElementById('route-destination').value = route.destination;
    document.getElementById('route-ett').value = route.estimated_travel_min;
    (route.stops || []).forEach(s => addStopRow(s.stop_name, s.distance_from_origin_km, s.latitude || '', s.longitude || ''));
  } else {
    document.getElementById('route-modal-title').textContent = 'New Route';
    addStopRow('Origin stop', 0);
  }
  modal.classList.add('open');
}

async function editRoute(id) {
  try {
    const res = await apiRequest(`/routes/${id}`);
    openModal(res.data);
  } catch (err) { showToast(err.message, true); }
}

document.getElementById('route-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('route-id').value;

  const stops = Array.from(stopsContainer.querySelectorAll('.stop-row')).map((row, i) => ({
    stop_name: row.querySelector('.stop-name').value,
    sequence_no: i + 1,
    distance_from_origin_km: Number(row.querySelector('.stop-distance').value) || 0,
    latitude: row.querySelector('.stop-lat').value ? Number(row.querySelector('.stop-lat').value) : null,
    longitude: row.querySelector('.stop-lng').value ? Number(row.querySelector('.stop-lng').value) : null
  }));

  const payload = {
    route_name: document.getElementById('route-name').value,
    origin: document.getElementById('route-origin').value,
    destination: document.getElementById('route-destination').value,
    estimated_travel_min: Number(document.getElementById('route-ett').value) || 0,
    stops
  };

  try {
    if (id) {
      await apiRequest(`/routes/${id}`, { method: 'PUT', body: payload });
      showToast('Route updated');
    } else {
      await apiRequest('/routes', { method: 'POST', body: payload });
      showToast('Route created');
    }
    modal.classList.remove('open');
    loadRoutes();
    initRouteMap('full-route-map', { footerId: 'full-route-map-footer', interactive: true });
  } catch (err) { showToast(err.message, true); }
});

if (!canManage) document.getElementById('btn-new-route').classList.add('hidden');

loadRoutes();
initRouteMap('full-route-map', { footerId: 'full-route-map-footer', interactive: true });

function runFullMapSearch() {
  const input = document.getElementById('full-map-search-input');
  const query = input.value.trim();
  if (!query) return;
  searchRouteMap('full-route-map', query);
}
document.getElementById('full-map-search-btn').addEventListener('click', runFullMapSearch);
document.getElementById('full-map-search-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); runFullMapSearch(); }
});
