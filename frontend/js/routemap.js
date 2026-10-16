/**
 * Renders an interactive route network map using Leaflet + OpenStreetMap
 * tiles (both free, no API key). Plots each active route as a line through
 * its stops, and for schedules currently "In Transit" or "Delayed", shows a
 * marker at an ESTIMATED position along the route — computed from how far
 * along the scheduled departure→arrival window the current time is. This is
 * NOT real GPS tracking (no vehicle actually reports its location); it is a
 * schedule-based simulation, which is an honest distinction worth keeping in
 * mind if asked how it works.
 */

const ROUTE_LINE_COLORS = ['#2563EB', '#F97316', '#22C55E', '#8438c9', '#c9385a', '#0F172A'];

// Keyed by containerId — holds the Leaflet map instance plus everything drawn
// onto it, so a later search/command (see searchRouteMap) can find and
// act on a specific route, stop, or live vehicle marker without redrawing.
window._routeMapRegistry = window._routeMapRegistry || {};

function interpolateAlongStops(stops, targetKm) {
  if (stops.length === 0) return null;
  if (stops.length === 1) return { lat: stops[0].latitude, lng: stops[0].longitude };

  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    const da = Number(a.distance_from_origin_km), db = Number(b.distance_from_origin_km);
    if (targetKm >= da && targetKm <= db) {
      const fraction = db === da ? 0 : (targetKm - da) / (db - da);
      return {
        lat: Number(a.latitude) + (Number(b.latitude) - Number(a.latitude)) * fraction,
        lng: Number(a.longitude) + (Number(b.longitude) - Number(a.longitude)) * fraction
      };
    }
  }
  // Past the last stop (or before the first) — clamp to nearest end.
  const last = stops[stops.length - 1];
  return { lat: Number(last.latitude), lng: Number(last.longitude) };
}

/**
 * @param {string} containerId - element to render the Leaflet map into
 * @param {object} [opts]
 * @param {string} [opts.footerId] - optional element to show a summary line into
 * @param {boolean} [opts.interactive] - if false, disables zoom/drag (mini preview mode)
 */
async function initRouteMap(containerId, opts = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  try {
    // Leaflet throws 'Map container is already initialized' if this page refreshes the map after a save.
    // Tear down the previous instance cleanly before rebuilding it.
    const previous = window._routeMapRegistry[containerId];
    if (previous && previous.map) {
      try { previous.map.off(); previous.map.remove(); } catch (_) {}
      delete window._routeMapRegistry[containerId];
    }
    // If Leaflet metadata survived a prior render/navigation, clear it before reusing this node.
    if (container._leaflet_id) { try { delete container._leaflet_id; } catch (_) {} }
    container.replaceChildren();

    const routesRes = await apiRequest('/routes?limit=100');
    const routeSummaries = routesRes.data;

    if (routeSummaries.length === 0) {
      container.innerHTML = '<div class="empty-state">No routes to display yet</div>';
      return;
    }

    // Fetch full stop detail (with coordinates) for each active route.
    const routeDetails = await Promise.all(
      routeSummaries.map(r => apiRequest(`/routes/${r.route_id}`).then(res => res.data).catch(() => null))
    );
    const plottable = routeDetails.filter(r => r && r.stops && r.stops.filter(s => s.latitude && s.longitude).length >= 2);

    if (plottable.length === 0) {
      container.innerHTML = '<div class="empty-state">No routes have map coordinates yet — add latitude/longitude to stops when editing a route.</div>';
      return;
    }

    container.innerHTML = '';
    const map = L.map(container, {
      zoomControl: opts.interactive !== false,
      dragging: opts.interactive !== false,
      scrollWheelZoom: opts.interactive !== false,
      doubleClickZoom: opts.interactive !== false,
      boxZoom: opts.interactive !== false,
      touchZoom: opts.interactive !== false
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(map);

    const allPoints = [];
    const routeEntries = []; // { route, line, bounds, stops: [{stop, marker}] }
    plottable.forEach((route, i) => {
      const validStops = route.stops.filter(s => s.latitude && s.longitude).sort((a, b) => a.sequence_no - b.sequence_no);
      const color = ROUTE_LINE_COLORS[i % ROUTE_LINE_COLORS.length];
      const latlngs = validStops.map(s => [Number(s.latitude), Number(s.longitude)]);
      const line = L.polyline(latlngs, { color, weight: 4, opacity: 0.8 }).addTo(map);

      const stopMarkers = validStops.map((s, idx) => {
        const isEndpoint = idx === 0 || idx === validStops.length - 1;
        const marker = L.circleMarker([s.latitude, s.longitude], {
          radius: isEndpoint ? 7 : 5,
          color: '#fff', weight: 2, fillColor: color, fillOpacity: 1
        }).addTo(map).bindPopup(`<strong>${escapeHtml(s.stop_name)}</strong><br>${escapeHtml(route.route_name)} (${escapeHtml(route.route_code)})`);
        return { stop: s, marker };
      });

      routeEntries.push({ route, line, defaultColor: color, bounds: latlngs, stops: stopMarkers });
      allPoints.push(...latlngs);
    });

    if (allPoints.length) map.fitBounds(allPoints, { padding: [24, 24] });
    // Leaflet can measure the container before the dashboard grid has settled.
    // Recalculate once layout is painted so tiles do not spill/overlap surrounding cards.
    requestAnimationFrame(() => { try { map.invalidateSize(false); if (allPoints.length) map.fitBounds(allPoints, { padding: [24, 24] }); } catch (_) {} });

    // ---- Simulated in-transit positions ----
    let inTransitCount = 0;
    const liveMarkers = []; // { schedule, marker }
    try {
      const [inTransitRes, delayedRes] = await Promise.all([
        apiRequest('/schedules?status=In%20Transit&limit=50'),
        apiRequest('/schedules?status=Delayed&limit=50')
      ]);
      const liveSchedules = [...inTransitRes.data, ...delayedRes.data];

      liveSchedules.forEach(sched => {
        const route = plottable.find(r => r.route_id === sched.route_id);
        if (!route) return;
        const validStops = route.stops.filter(s => s.latitude && s.longitude).sort((a, b) => a.sequence_no - b.sequence_no);
        if (validStops.length < 2) return;

        const dep = new Date(sched.departure_time).getTime();
        const arr = new Date(sched.arrival_time).getTime();
        const now = Date.now();
        const fraction = Math.max(0, Math.min(1, (now - dep) / (arr - dep || 1)));
        const totalKm = Math.max(...validStops.map(s => Number(s.distance_from_origin_km)));
        const pos = interpolateAlongStops(validStops, fraction * totalKm);
        if (!pos) return;

        inTransitCount++;
        const truckIcon = L.divIcon({
          className: '',
          html: `<div style="background:${sched.status === 'Delayed' ? '#F59E0B' : '#2563EB'};width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>`,
          iconSize: [16, 16], iconAnchor: [8, 8]
        });
        const marker = L.marker([pos.lat, pos.lng], { icon: truckIcon }).addTo(map)
          .bindPopup(`<strong>${escapeHtml(sched.schedule_code)}</strong><br>${escapeHtml(route.route_name)}<br>Vehicle: ${escapeHtml(sched.vehicle_code)}<br>~${Math.round(fraction * 100)}% of trip complete<br><em>(estimated from schedule, not live GPS)</em>`);
        liveMarkers.push({ schedule: sched, marker, routeCode: route.route_code });
      });
    } catch (e) { /* non-fatal — map still shows routes without live markers */ }

    const footer = opts.footerId ? document.getElementById(opts.footerId) : null;
    if (footer) {
      footer.innerHTML = `<span>${plottable.length} route${plottable.length === 1 ? '' : 's'} plotted</span><span>${inTransitCount} in transit now</span>`;
    }

    // Save everything so searchRouteMap() can find and act on it later
    // without needing to re-fetch or redraw the map.
    window._routeMapRegistry[containerId] = { map, routeEntries, liveMarkers, allPoints, footer };
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Failed to load map: ${err.message || err}</div>`;
  }
}

/**
 * Handles the map search/command box. Recognizes:
 *  - A route code or a substring of a route name → zooms to that route and opens its first stop's popup.
 *  - A vehicle code or schedule code among live (in-transit/delayed) markers → pans to it and opens its popup.
 *  - Commands: "delayed", "active"/"in transit", "reset"/"clear"/"all" → filters which routes are highlighted.
 * Anything unmatched shows a toast rather than failing silently.
 */
function searchRouteMap(containerId, rawQuery) {
  const registry = window._routeMapRegistry[containerId];
  if (!registry) { showToast('Map is still loading — try again in a moment.', true); return; }
  const { map, routeEntries, liveMarkers, allPoints } = registry;
  const query = rawQuery.trim().toLowerCase();

  // ---- Commands ----
  if (['reset', 'clear', 'all', 'show all'].includes(query)) {
    routeEntries.forEach(r => r.line.setStyle({ opacity: 0.8, weight: 4, color: r.defaultColor }));
    if (allPoints.length) map.fitBounds(allPoints, { padding: [24, 24] });
    showToast('Map view reset');
    return;
  }
  if (query === 'delayed') {
    const delayed = liveMarkers.filter(m => m.schedule.status === 'Delayed');
    if (!delayed.length) { showToast('No delayed vehicles right now'); return; }
    const bounds = delayed.map(m => m.marker.getLatLng());
    map.fitBounds(bounds, { padding: [40, 40] });
    delayed[0].marker.openPopup();
    showToast(`Showing ${delayed.length} delayed vehicle(s)`);
    return;
  }
  if (query === 'active' || query === 'in transit') {
    if (!liveMarkers.length) { showToast('No vehicles currently in transit'); return; }
    const bounds = liveMarkers.map(m => m.marker.getLatLng());
    map.fitBounds(bounds, { padding: [40, 40] });
    showToast(`Showing ${liveMarkers.length} vehicle(s) in transit`);
    return;
  }

  // ---- Route match (by code or name substring) ----
  const routeMatch = routeEntries.find(r =>
    r.route.route_code.toLowerCase() === query || r.route.route_name.toLowerCase().includes(query)
  );
  if (routeMatch) {
    routeEntries.forEach(r => r.line.setStyle({ opacity: r === routeMatch ? 1 : 0.15, weight: r === routeMatch ? 6 : 3 }));
    map.fitBounds(routeMatch.bounds, { padding: [40, 40] });
    if (routeMatch.stops[0]) routeMatch.stops[0].marker.openPopup();
    showToast(`Showing ${routeMatch.route.route_name} (${routeMatch.route.route_code})`);
    return;
  }

  // ---- Live vehicle/schedule match ----
  const liveMatch = liveMarkers.find(m =>
    m.schedule.vehicle_code.toLowerCase() === query || m.schedule.schedule_code.toLowerCase() === query
  );
  if (liveMatch) {
    map.setView(liveMatch.marker.getLatLng(), 10);
    liveMatch.marker.openPopup();
    showToast(`Found ${liveMatch.schedule.schedule_code} — vehicle ${liveMatch.schedule.vehicle_code}`);
    return;
  }

  showToast(`No match found for "${rawQuery}" — try a route code, route name, vehicle code, or "delayed"/"reset"`, true);
}
