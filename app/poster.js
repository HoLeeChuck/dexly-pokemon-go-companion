// Shareable images drawn entirely in the browser. Colors are fixed (dark poster) so an image
// looks the same whatever appearance the viewer uses.
const INK = '#eceef1';
const MUTED = '#a4afbf';
const BG = '#101115';
const SURFACE = '#181b22';
const EMPTY = '#262b35';
const RAINBOW = ['#ff6b6b', '#ffb84d', '#ffe66d', '#6bd68f', '#5ec8f2', '#8f86ff', '#e27ce5'];
const MEDAL = { bronze: '#c98a57', silver: '#c9d1dc', gold: '#f2c14e', platinum: '#b8e6ff' };

function canvas(width, height) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const g = c.getContext('2d');
  g.fillStyle = BG;
  g.fillRect(0, 0, width, height);
  return [c, g];
}
function text(g, value, x, y, size, color = INK, weight = 600, align = 'left') {
  g.font = `${weight} ${size}px "Segoe UI", Arial, sans-serif`;
  g.fillStyle = color;
  g.textAlign = align;
  g.fillText(value, x, y);
}
function rounded(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}
function rainbow(g, x, y, w, h) {
  const grad = g.createLinearGradient(x, y, x + w, y + h);
  RAINBOW.forEach((c, i) => grad.addColorStop(i / (RAINBOW.length - 1), c));
  return grad;
}

function check(g, cx, cy, s, color) {
  g.beginPath();
  g.moveTo(cx - s * 0.5, cy);
  g.lineTo(cx - s * 0.12, cy + s * 0.38);
  g.lineTo(cx + s * 0.55, cy - s * 0.4);
  g.strokeStyle = color;
  g.lineWidth = Math.max(1.5, s * 0.22);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.stroke();
}
function dash(g, cx, cy, s, color) {
  g.beginPath();
  g.moveTo(cx - s * 0.45, cy);
  g.lineTo(cx + s * 0.45, cy);
  g.strokeStyle = color;
  g.lineWidth = Math.max(1.5, s * 0.16);
  g.lineCap = 'round';
  g.stroke();
}
/** One map cell: state symbol, optional Dex number, and a category-progress bar. */
function drawCell(g, cell, x, y, size, accent) {
  rounded(g, x, y, size, size, Math.max(3, size / 5));
  if (cell.state === 'complete') g.fillStyle = rainbow(g, x, y, size, size);
  else if (cell.state === 'owned') g.fillStyle = accent;
  else g.fillStyle = cell.state === 'unavailable' ? BG : EMPTY;
  g.fill();
  if (cell.state === 'unavailable') {
    g.strokeStyle = EMPTY;
    g.lineWidth = 1;
    g.stroke();
  }
  const big = size >= 36;
  const cx = x + size / 2;
  const cy = y + size * (big ? 0.48 : 0.4);
  const mark = size * (big ? 0.32 : 0.42);
  if (cell.state === 'unavailable') dash(g, cx, cy, mark, MUTED);
  else if (cell.state === 'owned') check(g, cx, cy, mark, BG);
  if (big)
    text(
      g,
      String(cell.n),
      x + 5,
      y + 13,
      10,
      cell.state === 'missing' || cell.state === 'unavailable' ? MUTED : BG,
      600,
    );
  // Share of this Pokémon's eligible categories already registered (the rainbow already says 100%).
  if (!['unavailable', 'complete'].includes(cell.state) && cell.progress > 0) {
    const inset = Math.max(2, size * 0.14);
    const barH = Math.max(2, size * 0.1);
    const barW = size - inset * 2;
    const barY = y + size - inset - barH;
    rounded(g, x + inset, barY, barW, barH, barH / 2);
    g.fillStyle = cell.state === 'missing' ? '#3a4050' : 'rgba(16,17,21,0.35)';
    g.fill();
    rounded(g, x + inset, barY, Math.max(barH, barW * cell.progress), barH, barH / 2);
    g.fillStyle = cell.state === 'missing' ? accent : BG;
    g.fill();
  }
}
function legend(g, x, y, width, accent, label) {
  const items = [
    ['complete', 'All complete'],
    ['owned', `${label} registered`],
    ['missing', `${label} missing`],
    ['unavailable', 'Not released'],
    ['progress', 'Categories done'],
  ];
  const slot = width / items.length;
  const s = 26;
  items.forEach(([state, name], i) => {
    const sx = x + slot * i;
    if (state === 'progress')
      drawCell(g, { n: '', state: 'missing', progress: 0.6 }, sx, y, s, accent);
    else drawCell(g, { n: '', state, progress: 0 }, sx, y, s, accent);
    text(g, name, sx + s + 10, y + 18, 15, MUTED, 400);
  });
}

/**
 * cells: [{ n, state: 'owned' | 'missing' | 'complete' | 'unavailable', progress: 0..1 }]
 * medals: optional medalShelf() output for the footer.
 */
export function drawCollectionPoster({
  title,
  subtitle,
  cells,
  count,
  total,
  trainer,
  accent,
  medals,
  label = 'Normal',
}) {
  const width = 1080;
  const pad = 56;
  const columns = cells.length > 400 ? 41 : cells.length > 150 ? 25 : 16;
  const gap = cells.length > 400 ? 3 : 5;
  const size = Math.floor((width - pad * 2 - gap * (columns - 1)) / columns);
  const rows = Math.ceil(cells.length / columns);
  const gridTop = 250;
  const gridHeight = rows * (size + gap);
  const legendHeight = 64;
  const medalHeight = medals ? 130 : 0;
  const height = gridTop + gridHeight + legendHeight + medalHeight + 120;
  const [c, g] = canvas(width, height);

  text(g, 'CATCHGRID · COLLECTION MAP', pad, 78, 20, MUTED, 600);
  text(g, title, pad, 140, 52, INK, 600);
  text(g, subtitle, pad, 184, 24, MUTED, 400);
  text(g, String(count), width - pad - 118, 140, 64, INK, 300, 'right');
  text(g, `/ ${total}`, width - pad, 140, 28, MUTED, 400, 'right');
  const pct = total ? Math.floor((count / total) * 100) : 0;
  text(g, `${pct}% collected`, width - pad, 184, 22, MUTED, 400, 'right');

  cells.forEach((cell, i) => {
    const x = pad + (i % columns) * (size + gap);
    const y = gridTop + Math.floor(i / columns) * (size + gap);
    drawCell(g, cell, x, y, size, accent);
  });

  legend(g, pad, gridTop + gridHeight + 22, width - pad * 2, accent, label);
  let y = gridTop + gridHeight + legendHeight + 30;
  if (medals) {
    text(g, 'REGIONAL MEDALS', pad, y + 10, 18, MUTED, 600);
    const slot = (width - pad * 2) / medals.length;
    medals.forEach((m, i) => {
      const cx = pad + slot * i + slot / 2;
      g.beginPath();
      g.arc(cx, y + 60, 24, 0, Math.PI * 2);
      g.fillStyle = MEDAL[m.tier] || SURFACE;
      g.fill();
      if (m.tier === 'none') {
        g.strokeStyle = EMPTY;
        g.lineWidth = 2;
        g.stroke();
      }
      text(g, m.mark, cx, y + 67, 20, m.tier === 'none' ? MUTED : BG, 700, 'center');
      text(g, m.region, cx, y + 106, 13, MUTED, 400, 'center');
    });
    y += medalHeight;
  }
  text(
    g,
    trainer ? `Trainer ${trainer}` : 'Independent Pokémon GO collection companion',
    pad,
    height - 50,
    20,
    INK,
    500,
  );
  text(g, 'dex.cjdev.app', width - pad, height - 50, 20, MUTED, 400, 'right');
  return c;
}

export function drawRecapCard({
  period,
  total,
  byCategory,
  labels,
  highlights,
  activeDays,
  trainer,
  accent,
}) {
  const width = 1080;
  const height = 1080;
  const pad = 72;
  const [c, g] = canvas(width, height);
  g.fillStyle = rainbow(g, 0, 0, width, 8);
  g.fillRect(0, 0, width, 8);
  text(g, 'CATCHGRID RECAP', pad, 110, 22, MUTED, 600);
  text(g, period, pad, 180, 56, INK, 600);
  text(g, String(total), pad, 360, 160, accent, 300);
  text(g, total === 1 ? 'new collection entry' : 'new collection entries', pad, 420, 30, INK, 400);
  text(g, `${activeDays} active ${activeDays === 1 ? 'day' : 'days'}`, pad, 462, 24, MUTED, 400);
  const rows = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  rows.slice(0, 8).forEach(([id, n], i) => {
    const x = pad + (i % 2) * 468;
    const y = 540 + Math.floor(i / 2) * 76;
    rounded(g, x, y, 444, 60, 14);
    g.fillStyle = SURFACE;
    g.fill();
    text(g, labels[id] || id, x + 24, y + 39, 24, INK, 500);
    text(g, `+${n}`, x + 420, y + 39, 26, accent, 600, 'right');
  });
  if (highlights.length) {
    text(
      g,
      'Highlights: ' +
        highlights
          .slice(0, 4)
          .map((h) => `${h.p.name} (${labels[h.entry.categoryId]})`)
          .join(' · '),
      pad,
      900,
      20,
      MUTED,
      400,
    );
  }
  text(
    g,
    trainer ? `Trainer ${trainer}` : 'Independent Pokémon GO collection companion',
    pad,
    height - 72,
    22,
    INK,
    500,
  );
  text(g, 'dex.cjdev.app', width - pad, height - 72, 22, MUTED, 400, 'right');
  return c;
}

/** Share through the device share sheet when it accepts files; otherwise download the PNG. */
export async function shareCanvas(c, filename, title) {
  const blob = await new Promise((resolve) => c.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('The image could not be created on this device.');
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
