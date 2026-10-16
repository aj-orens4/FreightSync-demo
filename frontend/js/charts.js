/**
 * Minimal chart rendering helpers used by the dashboard. Deliberately
 * dependency-free (no Chart.js/D3) to keep the frontend a plain HTML/CSS/JS
 * stack with zero build step, per the project's chosen tech stack.
 */

const STATUS_COLORS = {
  Active: '#2e7d4f', Approved: '#2e7d4f', Published: '#2e7d4f', Completed: '#2e7d4f', Scheduled: '#3d5a73',
  Inactive: '#b3261e', Rejected: '#b3261e', Cancelled: '#b3261e', Archived: '#8a97a3',
  Draft: '#b8681c', Submitted: '#b8681c', 'Pending Approval': '#b8681c', 'Under Review': '#b8681c',
  Delayed: '#b8681c', 'In Transit': '#1b3a57'
};
function colorFor(label, index) {
  return STATUS_COLORS[label] || ['#d9822b', '#3d5a73', '#8a97a3', '#5c6b78'][index % 4];
}

/** Renders a simple horizontal bar list: data = [{label, value}, ...].
 *  Pass onClick(label, value) to make each row clickable (cursor + handler). */
function renderBarChart(container, data, onClick) {
  const max = Math.max(1, ...data.map(d => d.value));
  container.innerHTML = data.map((d, i) => {
    const pct = Math.round((d.value / max) * 100);
    const color = colorFor(d.label, i);
    return `
      <div class="bar-chart-row${onClick ? ' bar-chart-row--clickable' : ''}" data-label="${d.label}">
        <div class="bar-label">${d.label}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%; background:${color}"></div></div>
        <div class="bar-value">${d.value}</div>
      </div>`;
  }).join('') || '<div class="empty-state">No data yet</div>';

  if (onClick) {
    container.querySelectorAll('.bar-chart-row').forEach(row => {
      const item = data.find(d => d.label === row.dataset.label);
      row.addEventListener('click', () => onClick(item.label, item.value));
    });
  }
}

/** Renders an SVG donut chart: data = [{label, value}, ...]; returns total count via center label.
 *  Pass onClick(label, value) to make each legend row clickable. */
function renderDonutChart(container, data, centerLabel = 'Total', onClick) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const size = 140, radius = 55, cx = size / 2, cy = size / 2, circumference = 2 * Math.PI * radius;

  let offset = 0;
  const segments = data.filter(d => d.value > 0).map((d, i) => {
    const fraction = total ? d.value / total : 0;
    const dash = fraction * circumference;
    const seg = `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${colorFor(d.label, i)}"
      stroke-width="18" stroke-dasharray="${dash} ${circumference - dash}"
      stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})" />`;
    offset += dash;
    return seg;
  }).join('');

  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="var(--chart-track)" stroke-width="18" />
      ${segments}
      <text x="${cx}" y="${cy - 2}" text-anchor="middle" class="donut-center-label">${total}</text>
      <text x="${cx}" y="${cy + 14}" text-anchor="middle" class="donut-center-sublabel">${centerLabel}</text>
    </svg>`;

  const legend = `
    <div class="chart-legend">
      ${data.map((d, i) => `
        <div class="legend-item${onClick ? ' legend-item--clickable' : ''}" data-label="${d.label}">
          <span class="swatch" style="background:${colorFor(d.label, i)}"></span>${d.label} (${d.value})
        </div>`).join('')}
    </div>`;

  container.innerHTML = `<div class="donut-wrap"><div>${svg}</div><div style="flex:1">${legend}</div></div>`;

  if (onClick) {
    container.querySelectorAll('.legend-item').forEach(row => {
      const item = data.find(d => d.label === row.dataset.label);
      row.addEventListener('click', () => onClick(item.label, item.value));
    });
  }
}
