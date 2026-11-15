/* Profile View: opening a beam-data file (CSV / IBA OPAB / PTW MCC) as DosiMachine's load_external_profile does
   (main.py:3363). Draws the Profile View plot (update_large_plots, main.py:10881), fills the Loaded Profiles table
   and the Profile / PDD filter buttons (ProfileListboxWrapper.insert, main.py:1998; _update_opab_filter_buttons,
   main.py:3252), writes the Detailed Text (update_sidebar_metadata, main.py:3560) and feeds the two bottom plots
   (on_profile_select, main.py:7608). The numbers come from demo/data/beamdata.js (bake/bake_beamdata.py). */
(function (root) {
  const DM = root.DM = root.DM || {};
  const COLORS = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#bcbd22', '#17becf', '#d4ac0d',
    '#2e4053', '#27ae60', '#2980b9', '#8e44ad', '#d35400', '#c0392b', '#16a085', '#7d6608', '#2c3e50', '#7f8c8d'];
  const FONT = '"DejaVu Sans", "Segoe UI", sans-serif';
  const LW = 1.5;                     // matplotlib points -> px at the screenshot scale

  /* ---------------- pure helpers (tested in node) ---------------- */
  const isProfile = (c) => c.type !== 'PDD';
  function visible(curves, filter) {
    if (filter === 'profile') return curves.filter(isProfile);
    if (filter === 'pdd') return curves.filter((c) => !isProfile(c));
    return curves.slice();
  }
  const counts = (curves) => ({ profile: curves.filter(isProfile).length, pdd: curves.filter((c) => !isProfile(c)).length });
  const mm = (v) => (v == null ? '' : v.toFixed(1) + ' mm');
  const rowTexts = (c) => [c.scan_mode, c.energy, mm(c.field_x), mm(c.field_y)];

  /* Detailed Text as lines of [class, text] segments: h = header, l = label, v = value */
  function detailLines(fileName, c) {
    const L = [[['h', '=== PROFILE INFO ===']], [['l', 'File: '], ['v', fileName]]];
    c.info.rows.forEach(([k, v]) => L.push([['l', (k + ': ').padEnd(14)], ['v', v]]));
    if (c.info.extra.length) {
      L.push([]); L.push([['h', '--- Additional Info ---']]);
      c.info.extra.forEach(([k, v]) => L.push([['l', (k + ': ').padEnd(14)], ['v', v]]));
    }
    if (c.analysis) {
      L.push([['h', '--- ' + c.analysis.title + ' Analysis Results ---']]);
      L.push([['l', 'Protocol: ' + c.analysis.protocol]]);
      c.analysis.rows.forEach(([k, v]) => L.push([['l', k.padEnd(18)], ['v', v]]));
    }
    return L;
  }

  /* matplotlib autoscale: 5 % margin around all data */
  function limits(curves) {
    let a = Infinity, b = -Infinity, p = Infinity, q = -Infinity;
    curves.forEach((c) => {
      for (let i = 0; i < c.x.length; i++) {
        if (c.x[i] < a) a = c.x[i]; if (c.x[i] > b) b = c.x[i];
        if (c.y[i] < p) p = c.y[i]; if (c.y[i] > q) q = c.y[i];
      }
    });
    if (!isFinite(a)) { a = 0; b = 1; p = 0; q = 1; }
    if (a === b) { a -= 1; b += 1; } if (p === q) { p -= 1; q += 1; }
    return { xl: a - (b - a) * 0.05, xh: b + (b - a) * 0.05, yl: p - (q - p) * 0.05, yh: q + (q - p) * 0.05 };
  }

  /* legend loc='best': matplotlib tries the codes in this order and keeps the place with the fewest data
     points under the legend box (first one wins a tie). */
  const LEGEND_ORDER = ['upper right', 'upper left', 'lower left', 'lower right', 'right', 'center left', 'center right', 'lower center', 'upper center', 'center'];
  function legendRect(loc, ax, w, h, pad) {
    const [v, hz] = loc === 'center' ? ['center', 'center'] : loc === 'right' ? ['center', 'right'] : loc.split(' ');
    const x = hz === 'left' ? ax.x0 + pad : hz === 'right' ? ax.x1 - pad - w : (ax.x0 + ax.x1) / 2 - w / 2;
    const y = v === 'upper' ? ax.y0 + pad : v === 'lower' ? ax.y1 - pad - h : (ax.y0 + ax.y1) / 2 - h / 2;
    return { x, y, w, h };
  }
  function bestLegend(points, ax, w, h, pad) {
    let best = null, bestN = Infinity;
    for (const loc of LEGEND_ORDER) {
      const r = legendRect(loc, ax, w, h, pad);
      let n = 0;
      for (const [px, py] of points) if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) n++;
      if (n < bestN) { bestN = n; best = Object.assign({ loc }, r); if (n === 0) break; }
    }
    return best;
  }

  /* ---------------- state ---------------- */
  let S = null;            // { file, all, filter, vis, sel }
  let bottom = null;       // { h: {title, ...} , v: {...} } last options of the two small plots
  const DEFAULT_TITLE = { h: 'Horizontal (Crossline)', v: 'Vertical (Inline)' };
  const u = () => DM.shell.ui();
  const datasets = () => (root.DM_DATA && root.DM_DATA.beamdata) || null;

  /* ---------------- large plot ---------------- */
  function drawLarge() {
    const u_ = u(), cv = u_.profileCanvas;
    const dpr = root.devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H) return;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#EBF5FB'; c.fillRect(0, 0, W, H);
    if (!S) return;
    const vis = S.vis;
    // axes box: subplots_adjust(left=.06, right=.98, top=.97, bottom=.08)
    const ax = { x0: 0.06 * W, x1: 0.98 * W, y0: 0.03 * H, y1: 0.92 * H };
    const lim = limits(vis);
    const xt = DM.shell.plotUtil.niceTicks(lim.xl, lim.xh, 7), yt = DM.shell.plotUtil.niceTicks(lim.yl, lim.yh, 5);
    const fmt = DM.shell.plotUtil.fmtTick;
    const X = (v) => ax.x0 + (v - lim.xl) / (lim.xh - lim.xl) * (ax.x1 - ax.x0);
    const Y = (v) => ax.y1 - (v - lim.yl) / (lim.yh - lim.yl) * (ax.y1 - ax.y0);
    c.fillStyle = '#fff'; c.fillRect(ax.x0, ax.y0, ax.x1 - ax.x0, ax.y1 - ax.y0);
    c.save(); c.strokeStyle = 'rgba(176,176,176,0.6)'; c.lineWidth = 1; c.setLineDash([5.5, 2.4]); c.beginPath();
    xt.ticks.forEach((v) => { const px = Math.round(X(v)) + 0.5; c.moveTo(px, ax.y0); c.lineTo(px, ax.y1); });
    yt.ticks.forEach((v) => { const py = Math.round(Y(v)) + 0.5; c.moveTo(ax.x0, py); c.lineTo(ax.x1, py); });
    c.stroke(); c.restore();
    // curves (the selected one last = on top)
    c.save(); c.beginPath(); c.rect(ax.x0, ax.y0, ax.x1 - ax.x0, ax.y1 - ax.y0); c.clip(); c.lineJoin = 'round';
    const order = vis.map((_, i) => i).sort((a, b) => (a === S.sel) - (b === S.sel));
    order.forEach((i) => {
      const k = vis[i], on = i === S.sel;
      c.globalAlpha = on ? 1 : 0.9; c.strokeStyle = COLORS[i % COLORS.length]; c.lineWidth = (on ? 2.0 : 0.8) * LW;
      c.beginPath();
      for (let j = 0; j < k.x.length; j++) { const px = X(k.x[j]), py = Y(k.y[j]); if (j) c.lineTo(px, py); else c.moveTo(px, py); }
      c.stroke();
    });
    c.restore();
    c.strokeStyle = '#CCCCCC'; c.lineWidth = 1.5; c.strokeRect(Math.round(ax.x0) + 0.5, Math.round(ax.y0) + 0.5, Math.round(ax.x1 - ax.x0), Math.round(ax.y1 - ax.y0));
    // ticks and labels
    c.strokeStyle = '#000'; c.fillStyle = '#000'; c.lineWidth = 0.8; c.font = '11.7px ' + FONT;
    c.textAlign = 'center'; c.textBaseline = 'top';
    xt.ticks.forEach((v) => { const px = Math.round(X(v)) + 0.5; c.beginPath(); c.moveTo(px, ax.y1); c.lineTo(px, ax.y1 + 4); c.stroke(); c.fillText(fmt(v, xt.step), px, ax.y1 + 6); });
    c.textAlign = 'right'; c.textBaseline = 'middle'; let tw = 0;
    yt.ticks.forEach((v) => {
      const py = Math.round(Y(v)) + 0.5, s = fmt(v, yt.step);
      c.beginPath(); c.moveTo(ax.x0, py); c.lineTo(ax.x0 - 4, py); c.stroke(); c.fillText(s, ax.x0 - 6, py);
      tw = Math.max(tw, c.measureText(s).width);
    });
    c.font = '12.5px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'top';
    c.fillText(vis.some((k) => k.type === 'PDD') ? 'Depth (mm)' : 'Distance (mm)', (ax.x0 + ax.x1) / 2, ax.y1 + 23);
    c.save(); c.translate(ax.x0 - tw - 18, (ax.y0 + ax.y1) / 2); c.rotate(-Math.PI / 2); c.textBaseline = 'middle';
    c.fillText('Relative Dose (%)', 0, 0); c.restore();
    // legend only while fewer than 15 profiles are listed (main.py:10958)
    if (vis.length && vis.length < 15) drawLegend(c, ax, vis, X, Y);
  }

  function drawLegend(c, ax, vis, X, Y) {
    c.font = '12.5px ' + FONT;
    const pad = 6, row = 15.2, hl = 25, gap = 10;
    const tw = Math.max(...vis.map((k) => c.measureText(k.label).width));
    const w = pad * 2 + hl + gap + tw, h = pad * 2 + vis.length * row - 2;
    const pts = [];
    vis.forEach((k) => { for (let j = 0; j < k.x.length; j++) pts.push([X(k.x[j]), Y(k.y[j])]); });
    const r = bestLegend(pts, ax, w, h, 7);
    c.save();
    c.fillStyle = 'rgba(255,255,255,0.8)'; c.strokeStyle = 'rgba(204,204,204,0.9)'; c.lineWidth = 1;
    c.beginPath(); (c.roundRect ? c.roundRect(r.x, r.y, r.w, r.h, 3) : c.rect(r.x, r.y, r.w, r.h)); c.fill(); c.stroke();
    c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = '#000';
    vis.forEach((k, i) => {
      const cy = r.y + pad + i * row + row / 2 - 1;
      c.strokeStyle = COLORS[i % COLORS.length]; c.lineWidth = (i === S.sel ? 2.0 : 0.8) * LW;
      c.beginPath(); c.moveTo(r.x + pad, cy); c.lineTo(r.x + pad + hl, cy); c.stroke();
      c.fillText(k.label, r.x + pad + hl + gap, cy);
    });
    c.restore();
  }

  /* ---------------- bottom plots ---------------- */
  const sideOf = (c) => (c.type === 'PDD' ? 'v' : 'h');
  function drawBottom(side) {
    const o = bottom[side];
    DM.shell.drawPlot(u().plots[side], o.data ? o : { title: o.title });
  }
  function setBottom(side, c, idx, title, on) {
    const top = Math.max(...c.y) * 1.1;                       // set_ylim(0, max * 1.1)
    bottom[side] = { title, data: true, x: c.x, y: c.y, color: COLORS[idx % COLORS.length], lineWidth: (on ? 2.0 : 0.8) * LW,
      xlim: [Math.min(...c.x), Math.max(...c.x)], ylim: [0, top] };
    drawBottom(side);
  }
  function resetBottom() {
    bottom = { h: { title: DEFAULT_TITLE.h }, v: { title: DEFAULT_TITLE.v } };
    drawBottom('h'); drawBottom('v');
  }
  // refresh_profile_plots: the first horizontal and the first vertical / PDD curve, plain titles
  function plotFirsts() {
    ['h', 'v'].forEach((side) => {
      const i = S.vis.findIndex((c) => sideOf(c) === side);
      if (i < 0) { bottom[side] = { title: bottom[side].title }; drawBottom(side); return; }
      setBottom(side, S.vis[i], i, side === 'h' ? 'Horizontal' : 'Vertical / PDD', false);
    });
  }

  /* ---------------- right panel ---------------- */
  function writeText(c) {
    const pre = u().rightTabs.detailedText;
    pre.textContent = '';
    detailLines(S.file.name, c).forEach((segs) => {
      segs.forEach(([cls, t]) => { const s = document.createElement('span'); s.className = 'dt-' + cls; s.textContent = t; pre.appendChild(s); });
      pre.appendChild(document.createTextNode('\n'));
    });
    pre.parentNode.scrollTop = pre.parentNode.scrollHeight;     // info_text.see(END)
  }

  function buildTable() {
    const tb = u().profileTable;
    tb.textContent = '';
    S.vis.forEach((c, i) => {
      const tr = document.createElement('tr');
      rowTexts(c).forEach((t) => { const td = document.createElement('td'); td.textContent = t; tr.appendChild(td); });
      tr.addEventListener('mousedown', () => select(i));
      tb.appendChild(tr);
    });
  }

  function styleButtons() {
    const b = u().filterBtns, n = counts(S.all);
    const set = (btn, bg, fg, text) => { btn.style.background = bg; btn.style.color = fg; btn.textContent = text; };
    set(b.all, S.filter === 'all' ? '#1B4F72' : '#85929E', '#fff', 'All');
    if (n.profile) set(b.profile, S.filter === 'profile' ? '#1E8449' : '#27AE60', '#fff', '∿ Profile (' + n.profile + ')');
    else set(b.profile, '#7F8C8D', '#CCCCCC', '∿ Profile');
    if (n.pdd) set(b.pdd, S.filter === 'pdd' ? '#CA6F1E' : '#E67E22', '#fff', '↘ PDD (' + n.pdd + ')');
    else set(b.pdd, '#7F8C8D', '#CCCCCC', '↘ PDD');
    b.profile.style.cursor = n.profile ? 'pointer' : 'default'; b.pdd.style.cursor = n.pdd ? 'pointer' : 'default';
  }
  function clearButtons() {
    const b = u().filterBtns;
    [['all', 'All'], ['profile', '∿ Profile'], ['pdd', '↘ PDD']].forEach(([k, t]) => {
      b[k].style.background = ''; b[k].style.color = ''; b[k].style.cursor = ''; b[k].textContent = t;
    });
  }

  function select(i) {
    if (!S || i < 0 || i >= S.vis.length) return;
    S.sel = i;
    [...u().profileTable.children].forEach((tr, j) => tr.classList.toggle('sel', j === i));
    const c = S.vis[i];
    setBottom(sideOf(c), c, i, (c.type === 'PDD' ? 'PDD' : 'Horizontal') + ': ' + c.label, true);
    writeText(c);
    drawLarge();
  }

  function filter(kind) {
    if (!S) return false;
    const n = counts(S.all);
    if ((kind === 'profile' && !n.profile) || (kind === 'pdd' && !n.pdd)) return true;   // disabled button
    S.filter = kind; S.vis = visible(S.all, kind); S.sel = -1;
    styleButtons(); buildTable(); plotFirsts(); drawLarge();
    return true;
  }

  /* ---------------- image view text, open, reset ---------------- */
  // The original shows white "Profile Loaded" text here (main.py:3510); the demo keeps the start screen instead (user request).
  function paintImage() {
    if (S) DM.shell.showWelcome();
  }

  function open(name) {
    const D = datasets();
    const f = D && D.files.find((x) => x.name === name);
    if (!f) { DM.shell.toast('샘플 데이터를 찾을 수 없습니다'); return false; }
    if (DM.mainview && DM.mainview.leaveImage) DM.mainview.leaveImage();
    S = { file: f, all: f.curves, filter: 'all', vis: f.curves.slice(), sel: -1 };    // opening replaces the previous file
    const U = u();
    U.setProfileTab(f.name);
    U.statusLabel.textContent = 'Profile Loaded: ' + f.name;
    paintImage();
    resetBottom(); styleButtons(); buildTable();
    select(0);                                                                        // the first profile is selected on load
    U.setView(1);
    drawLarge();
    return true;
  }

  function reset() {
    if (!S) return;
    S = null;
    const U = u();
    U.setProfileTab(null); U.profileTable.textContent = ''; clearButtons(); drawLarge();
  }

  function init() {
    DM.shell.onFilter(filter);
    DM.shell.onProfileShow(drawLarge);
    if (root.ResizeObserver) new ResizeObserver(drawLarge).observe(u().profileCanvas);
  }

  const util = { visible, counts, rowTexts, detailLines, limits, bestLegend, legendRect, LEGEND_ORDER, COLORS };
  DM.profileview = { open, reset, init, paintImage, util, get loaded() { return !!S; } };
  if (typeof module === 'object' && module.exports) module.exports = util;
})(typeof window !== 'undefined' ? window : globalThis);
