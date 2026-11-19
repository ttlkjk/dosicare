/* DosiMachine replica - Star Shot Analysis window ("Star Shot Analysis (DOSICARE Platform)").
   Layout follows the original maximized window (client area of the original capture, 1707 x 996);
   positions below are written in capture y (ss) and shifted by OFF (the 23 px title bar).
   RUN ANALYSIS plays 5 steps: merging the exposures, circular profile + peaks, image overlay (circle, numbered peaks, fitted
   lines, angle labels), intersection plot (circles shrink into place), metrics table + verdict.
   All numbers are the baked results of the real run (DM_DATA.star). Tk 96 DPI: 9pt = 12px, 10pt = 13.33px;
   matplotlib 100 dpi: 1pt = 1.389px. */
(function (root) {
  const DM = root.DM = root.DM || {};
  DM.windows = DM.windows || {};

  const W = 1707, H = 996, OFF = 23;
  const PRIMARY = '#1A5276', BAR = '#D6EAF8', BORDER = '#BDC3C7', TEXT = '#1E293B';
  const MPL = '"DejaVu Sans", Verdana, "Segoe UI", sans-serif';
  const NS = 'http://www.w3.org/2000/svg';
  const PT = 100 / 72;

  const METRIC_ORDER = ['Isocenter Radius (TG142)', 'Isocenter Diameter (mm)', 'Beams Detected',
    'Avg. Intersect Dev (mm)', 'Max Perpendicular (mm)', 'Furthest Intersection Distance (mm)'];

  function h(tag, css, text, cls) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }
  const abs = (x, y, w, hh, extra) => 'position:absolute;left:' + x + 'px;top:' + (y - OFF) + 'px;' + (w != null ? 'width:' + w + 'px;' : '') + (hh != null ? 'height:' + hh + 'px;' : '') + (extra || '');
  function sv(tag, attrs, text) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const gfmt = (v) => String(Number(v.toPrecision(6)));          // Python's :g
  const sgn2 = (v) => (v >= 0 ? '+' : '-') + Math.abs(v).toFixed(2);

  // matplotlib MaxNLocator(nbins=9, steps 1/2/2.5/5/10) as the axes use it
  function mplTicks(lo, hi) {
    const raw = (hi - lo) / 9;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= raw - 1e-12);
    let dec = 0;
    while (Math.abs(Math.round(step * Math.pow(10, dec)) / Math.pow(10, dec) - step) > 1e-9 && dec < 6) dec += 1;
    const out = [];
    for (let k = Math.ceil(lo / step - 1e-9); k * step <= hi + 1e-9; k++) out.push(k * step);
    return { ticks: out, dec };
  }

  function mount(body) {
    const data = root.DM_DATA.star;
    const root_ = h('div', null, null, 'ss-root');
    body.appendChild(root_);
    let destroyed = false;
    const toast = () => DM.shell.toast('데모에서는 동작하지 않습니다');

    // ---------------- numbers ----------------
    const MM = data.mm_per_px;
    const CX = data.center[0], CY = data.center[1];
    const ISO = [CX * MM, CY * MM];
    const R = data.detect_radius;
    const nFrames = data.frames.length;
    const lines = data.lines.map(([t, r]) => ({ t, r, a: Math.cos(t), b: Math.sin(t) }));
    const inter = [];
    for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
      const p = lines[i], q = lines[j], det = p.a * q.b - q.a * p.b;
      if (Math.abs(det) < 1e-12) continue;
      inter.push([(p.r * q.b - q.r * p.b) / det, (p.a * q.r - q.a * p.r) / det]);
    }
    const ICEN = inter.length ? [inter.reduce((s, p) => s + p[0], 0) / inter.length, inter.reduce((s, p) => s + p[1], 0) / inter.length] : [CX, CY];
    const mval = (k) => { const v = parseFloat(data.metrics[k]); return isFinite(v) ? v : null; };
    const radMm = mval('Isocenter Radius (TG142)'), perpMm = mval('Max Perpendicular (mm)'), avgMm = mval('Avg. Intersect Dev (mm)');
    const lineOf = {};
    data.angle_results.forEach((res) => { if (res.measured !== null) lineOf[res.line] = res; });

    // ---------------- state ----------------
    const st = { sweep: 0, ov: 0, inter: 0, rows: 0, status: false, zoom: 1.0, labels: true, scroll: 0 };

    // ---------------- grading (starshot_analysis.judge) ----------------
    let tolIn, targetIn, angTolIn;
    const num = (inp, dflt) => { const v = parseFloat(inp.value); return isFinite(v) ? v : dflt; };
    function buildRows() {
      const tol = num(tolIn, 1.0), target = Math.round(num(targetIn, 0)), angTol = num(angTolIn, 0);
      const keys = METRIC_ORDER.filter((k) => k in data.metrics).concat(Object.keys(data.metrics).filter((k) => METRIC_ORDER.indexOf(k) < 0));
      const rows = [];
      keys.forEach((k) => {
        const val = data.metrics[k];
        let s = '-';
        if (k === 'Isocenter Radius (TG142)') s = parseFloat(val) <= tol ? 'PASS' : 'FAIL';
        else if (k === 'Isocenter Diameter (mm)') s = DM.grade.star(parseFloat(val), tol * 2.0);
        else if (k === 'Pixel Scale (mm/px)') s = 'OK';
        else if (k === 'Beams Detected' && target > 0) s = parseInt(val, 10) === target ? 'PASS' : 'FAIL';
        rows.push([k, val, s]);
      });
      rows.push(['Angle Sense', data.angle_sense, '-']);
      rows.push(['Angle Offset (deg) [' + data.angle_source + ']', sgn2(data.angle_offset), '-']);
      data.angle_results.forEach((res) => {
        const key = 'Angle ' + gfmt(res.nominal) + '°';
        if (res.measured === null) { rows.push([key, 'NOT FOUND', 'FAIL']); return; }
        let s = '-';
        if (angTol > 0) s = Math.abs(res.diff) <= angTol ? 'PASS' : 'FAIL';
        rows.push([key, res.measured.toFixed(2) + ' (' + sgn2(res.diff) + ')', s]);
      });
      return { rows, ok: rows.every((r) => r[2] !== 'FAIL' && r[2] !== 'ASSUMED') };
    }

    // ---------------- header ----------------
    const header = h('div', abs(0, 23, W, 60, 'background:' + PRIMARY + ';'));
    header.append(
      h('div', 'position:absolute;left:23px;top:16px;height:28px;font:700 21.33px "Segoe UI",sans-serif;line-height:28px;color:#F8FAFC;white-space:nowrap;', 'STARSHOT ANALYSIS'),
      h('div', 'position:absolute;right:23px;top:10px;height:20px;font:700 13.33px "Segoe UI",sans-serif;line-height:20px;color:#F8FAFC;white-space:nowrap;', 'FILE: composite (' + nFrames + ' frames)'),
      h('div', 'position:absolute;right:23px;top:32px;height:20px;font:12px "Segoe UI",sans-serif;line-height:20px;color:#AED6F1;white-space:nowrap;', 'REPORT AS: TB'));
    root_.appendChild(header);

    // ---------------- settings card ----------------
    root_.appendChild(h('div', abs(15, 98, 420, 396, 'background:#fff;border:1px solid ' + BORDER + ';')));
    root_.appendChild(h('div', abs(16, 99, 418, 44, 'background:' + BAR + ';text-align:center;font:700 14.67px "Segoe UI",sans-serif;line-height:44px;color:' + PRIMARY + ';'), 'ANALYSIS SETTINGS'));
    const lab = (t, x, cy, color, css) => root_.appendChild(h('div', abs(x, cy - 10, null, 20, 'font:13.33px "Segoe UI",sans-serif;line-height:20px;white-space:nowrap;color:' + (color || '#000') + ';' + (css || '')), t));
    const entry = (val, x, y, w, hh, bold, align) => {
      const e = h('input', abs(x, y, w, hh, 'font:' + (bold ? '700 14.67' : '13.33') + 'px "Segoe UI",sans-serif;text-align:' + (align || 'center') + ';'), null, 'ss-entry');
      e.type = 'text'; e.value = val; e.spellcheck = false;
      e.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') e.blur(); });
      root_.appendChild(e);
      return e;
    };
    const box = (x, cy, on, round) => {
      const e = h('div', abs(x, cy - 6.5, 13, 13, 'background:#fff;border:1px solid #333;display:flex;align-items:center;justify-content:center;cursor:default;' + (round ? 'border-radius:50%;' : '') + 'font:700 12px "Segoe UI Symbol",sans-serif;line-height:11px;'));
      if (round) { const d = h('div', 'width:5px;height:5px;border-radius:50%;background:#000;' + (on ? '' : 'display:none;')); e.appendChild(d); e.dot = d; }
      else e.textContent = on ? '✓' : '';
      root_.appendChild(e);
      return e;
    };
    lab('Target Beams:', 34, 161.5, '#475569');
    targetIn = entry(String(2 * nFrames), 125, 151, 47, 21, true);
    lab('Found:', 190, 161.5, '#475569');
    const foundEl = h('div', abs(224, 150, 40, 23, 'text-align:center;font:700 14.67px "Segoe UI",sans-serif;line-height:23px;color:' + PRIMARY + ';'), '0');
    root_.appendChild(foundEl);
    lab('Tol (mm):', 270, 161.5, '#475569');
    tolIn = entry('1.0', 333, 151, 47, 21, true);
    lab('Profile Rad (%):', 34, 198.5, '#475569');
    const radIn = entry('85.0', 131, 187, 75, 22, true);
    radIn.disabled = true;
    box(222, 198.5, true);
    lab('Auto-Opt', 239, 198.5);
    lab('Beam Center:', 34, 235.5, '#475569');
    const rd1 = box(124, 235.5, true, true), rd2 = box(260, 235.5, false, true);
    lab('Center of FWHM', 142, 235.5); lab('Max Peak Value', 277, 235.5);
    [[rd1, rd2], [rd2, rd1]].forEach(([a, b]) => a.addEventListener('click', () => { a.dot.style.display = ''; b.dot.style.display = 'none'; }));
    const inv = box(37, 272.5, false);
    let invOn = false;
    inv.addEventListener('click', () => { invOn = !invOn; inv.textContent = invOn ? '✓' : ''; });
    lab('Invert Image (Dark Beams on Light BG)', 54, 272.5);
    lab('Nominal Angles:', 34, 307.5, '#475569');
    const nomIn = entry(data.angle_results.map((r) => gfmt(r.nominal)).join(', '), 136, 297, 143, 19, false, 'left');
    nomIn.style.background = '#F1F5F9';
    lab('Tol (deg):', 297, 307.5, '#475569');
    angTolIn = entry('1.0', 361, 297, 47, 21, true);

    const press = (b, base, active) => {
      b.addEventListener('pointerdown', () => { b.style.background = active; });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, () => { b.style.background = base; }));
    };
    const mkBtn = (txt, base, active, x, y, w, hh, fn) => {
      const b = h('div', abs(x, y, w, hh, 'background:' + base + ';color:#fff;font:700 14.67px "Segoe UI",sans-serif;display:flex;align-items:center;justify-content:center;cursor:pointer;white-space:nowrap;'), txt);
      press(b, base, active);
      b.addEventListener('click', fn);
      root_.appendChild(b);
      return b;
    };
    mkBtn('LOAD IMAGE(S)...', '#117A65', '#0E6251', 31, 346.5, 140, 40.5, toast);
    mkBtn('CLOSE IMAGE', '#5D6D7E', '#34495E', 177, 346.5, 111, 40.5, toast);
    lab(nFrames + ' exposures combined', 299, 368, '#7F8C8D');
    // frame-mode widgets of the original: grey "from DICOM <axis>" note under Nominal Angles, Frames row under the load row
    lab('from DICOM ' + data.angle_source, 34, 332.5, '#7F8C8D', 'font-size:12px;');
    lab('Frames:', 34, 410.5, '#475569');
    const fr1 = box(94, 410.5, true, true), fr2 = box(184, 410.5, false, true);
    lab('Combine', 112, 410.5); lab('Bar shadow (one line each)', 202, 410.5);
    [[fr1, fr2], [fr2, fr1]].forEach(([a, b]) => a.addEventListener('click', () => { a.dot.style.display = ''; b.dot.style.display = 'none'; }));
    let player = null;
    const runClick = async () => {
      if (!player || destroyed) return;
      if (player.state.playing) { player.pause(); return; }
      if (player.index >= player.steps.length - 1) await player.reset();
      player.play();
    };
    const runBtn = mkBtn('RUN ANALYSIS', PRIMARY, '#2980B9', 31, 439, 155, 45, runClick);
    mkBtn('RESET', '#5D6D7E', '#34495E', 190, 439, 89, 45, toast);
    mkBtn('EXPORT PDF', '#E74C3C', '#C0392B', 283, 439, 136, 45, toast);

    // ---------------- metrics card ----------------
    root_.appendChild(h('div', abs(15, 510, 420, 401, 'background:#fff;border:1px solid ' + BORDER + ';')));
    root_.appendChild(h('div', abs(16, 511, 418, 44, 'background:' + BAR + ';text-align:center;font:700 14.67px "Segoe UI",sans-serif;line-height:44px;color:' + PRIMARY + ';'), 'ANALYSIS METRICS'));
    root_.appendChild(h('div', abs(32, 556, 387, 294, 'background:#fff;border:1px solid #8E8E8E;')));
    const COLS = [['METRIC', 33, 187], ['VALUE', 220, 97], ['STATUS', 317, 87]];
    root_.appendChild(h('div', abs(33, 557, 370, 27, 'background:' + BAR + ';')));
    COLS.forEach(([t, x, w]) => root_.appendChild(h('div', abs(x, 557, w, 27, 'text-align:center;font:700 14.67px "Segoe UI",sans-serif;line-height:27px;color:' + PRIMARY + ';'), t)));
    const view = h('div', abs(33, 584, 370, 265, 'overflow:hidden;background:#fff;'));
    const rowsIn = h('div', 'position:relative;');
    view.appendChild(rowsIn);
    root_.appendChild(view);
    const sb = h('div', abs(403.5, 556.5, 15, 292, 'background:#BAB5AB;'));
    const sbBtn = 'position:absolute;left:0;width:15px;height:15px;background:#DCDAD5;border:1px solid #9E9A91;box-sizing:border-box;font:7px "Segoe UI Symbol",sans-serif;text-align:center;line-height:13px;color:#000;cursor:default;';
    const sbUp = h('div', sbBtn + 'top:0;', '▲'), sbDn = h('div', sbBtn + 'bottom:0;', '▼');
    const sbTh = h('div', 'position:absolute;left:0;width:15px;background:#DCDAD5;border:1px solid #9E9A91;box-sizing:border-box;');
    sbTh.appendChild(h('div', 'position:absolute;left:3px;right:3px;top:50%;height:5px;margin-top:-3px;border-top:1px solid #9E9A91;border-bottom:1px solid #9E9A91;'));
    sb.append(sbTh, sbUp, sbDn);
    root_.appendChild(sb);
    const banner = h('div', abs(31, 858, 388, 41, 'text-align:center;font:700 16px "Segoe UI",sans-serif;line-height:41px;'), '');
    root_.appendChild(banner);
    root_.appendChild(h('div', abs(18, 917.5, null, 20, 'font:700 14.67px "Segoe UI",sans-serif;line-height:20px;color:' + PRIMARY + ';white-space:nowrap;'), 'CLINICAL COMMENTS'));
    root_.appendChild(h('textarea', abs(15, 944, 420, 50, 'border:1px solid ' + BORDER + ';font:13.33px "Segoe UI",sans-serif;'), null, 'ss-comment'));
    const ROWH = 32, VIEWH = 265;
    function setScroll(v) {
      const n = Math.min(st.rows, rowsIn.children.length), total = Math.max(n, 1) * ROWH, max = Math.max(0, total - VIEWH);
      st.scroll = Math.max(0, Math.min(max, v));
      rowsIn.style.top = -st.scroll + 'px';
      const track = 292 - 30, thH = Math.max(20, Math.round(track * Math.min(1, VIEWH / total)));
      sbTh.style.top = (15 + Math.round((track - thH) * (max ? st.scroll / max : 0))) + 'px';
      sbTh.style.height = thH + 'px';
    }
    view.addEventListener('wheel', (e) => { e.preventDefault(); setScroll(st.scroll + (e.deltaY > 0 ? 64 : -64)); }, { passive: false });
    sbUp.addEventListener('click', () => setScroll(st.scroll - ROWH));
    sbDn.addEventListener('click', () => setScroll(st.scroll + ROWH));

    // ---------------- image box ----------------
    root_.appendChild(h('div', abs(450, 98, 611, 686, 'background:#fff;border:1px solid ' + BORDER + ';')));
    const IS = 609, SC = IS / (0.9 * Math.min(data.combined.w, data.combined.h));
    const U = (x) => (x - (CX - 0.45 * Math.min(data.combined.w, data.combined.h))) * SC;
    const V = (y) => (y - (CY - 0.45 * Math.min(data.combined.w, data.combined.h))) * SC;
    const imgBox = h('div', abs(451, 113.5, IS, IS, 'overflow:hidden;background:#fff;'));
    let readyFlag = false;
    const img = new Image();
    img.draggable = false; img.alt = '';
    img.style.cssText = 'position:absolute;display:block;max-width:none;width:' + (data.combined.w * SC) + 'px;height:' + (data.combined.h * SC) + 'px;left:' + (-(CX - 0.45 * Math.min(data.combined.w, data.combined.h)) * SC) + 'px;top:' + (-(CY - 0.45 * Math.min(data.combined.w, data.combined.h)) * SC) + 'px;';
    img.onload = () => { readyFlag = true; }; img.onerror = () => { readyFlag = true; };
    img.src = 'data/' + data.combined.file;
    imgBox.appendChild(img);
    // opening step of RUN: the exposures are added one by one ('lighten', as the original combines them),
    // then the sum cross-fades into the combined image underneath
    const mergeLayer = h('div', 'position:absolute;left:0;top:0;width:100%;height:100%;background:#000;isolation:isolate;display:none;');
    let framesLeft = data.frames.length;
    const frameEls = data.frames.map((f) => {
      const e = new Image();
      e.draggable = false; e.alt = '';
      e.style.cssText = img.style.cssText + 'mix-blend-mode:lighten;opacity:0;';
      e.onload = e.onerror = () => { framesLeft -= 1; if (framesLeft === 0) readyFrames = true; };
      e.src = 'data/' + f;
      mergeLayer.appendChild(e);
      return e;
    });
    let readyFrames = false;
    imgBox.appendChild(mergeLayer);
    // m: 0..nFrames frames added (fraction = fade-in of the newest), fade: 0..1 cross-fade to the combined image; null = layer off
    function paintMerge(m, fade) {
      if (m == null) { mergeLayer.style.display = 'none'; return; }
      mergeLayer.style.display = 'block';
      mergeLayer.style.opacity = String(1 - (fade || 0));
      frameEls.forEach((e, i) => { e.style.opacity = String(Math.max(0, Math.min(1, m - i))); });
    }
    const osvg = sv('svg', { width: IS, height: IS, viewBox: '0 0 ' + IS + ' ' + IS, style: 'position:absolute;left:0;top:0;display:block;font-family:' + MPL + ';' });
    imgBox.appendChild(osvg);
    root_.appendChild(imgBox);
    const circ = sv('circle', { cx: U(CX), cy: V(CY), r: R * SC, fill: 'none', stroke: '#3B82F6', 'stroke-width': 2 * PT, transform: 'rotate(0 ' + U(CX) + ' ' + V(CY) + ')' });
    const gLines = sv('g'), gBadges = sv('g');
    osvg.append(circ, gLines, gBadges);
    const lineEls = lines.map((ln, i) => {
      const e = sv('line', { stroke: data.line_colors[i], 'stroke-width': 0.8 * PT, 'stroke-dasharray': (3.7 * 0.8 * PT) + ' ' + (1.6 * 0.8 * PT), 'stroke-opacity': 0.8, visibility: 'hidden' });
      gLines.appendChild(e);
      const e0 = (ln.r - (CX * ln.a + CY * ln.b));
      const foot = [CX + e0 * ln.a, CY + e0 * ln.b];
      return { e, foot, d: [-ln.b, ln.a] };
    });
    const badgeEls = data.peaks_deg.map((deg, i) => {
      const x = U(CX + R * Math.cos(deg * Math.PI / 180)), y = V(CY + R * Math.sin(deg * Math.PI / 180));
      const g = sv('g', { visibility: 'hidden' });
      g.append(sv('rect', { x: x - 7.5, y: y - 7.5, width: 15, height: 15, fill: '#EF4444', 'fill-opacity': 0.8 }),
        sv('text', { x: x, y: y + 4.5, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700, fill: '#fff' }, String(i + 1)));
      gBadges.appendChild(g);
      return g;
    });
    const labelEls = lines.map((ln, i) => {
      const res = lineOf[i];
      if (!res) return null;
      const f = lineEls[i], reach = R * (0.55 + 0.15 * (i % 3)), side = i % 2 === 0 ? 1 : -1;
      const x = U(f.foot[0] + side * reach * f.d[0]), y = V(f.foot[1] + side * reach * f.d[1]);
      const e = h('div', 'position:absolute;left:' + x + 'px;top:' + y + 'px;transform:translate(-50%,-50%);padding:1px 3px;border-radius:4px;background:' + data.line_colors[i] + ';color:#000;font:700 12.5px ' + MPL + ';line-height:15px;white-space:nowrap;display:none;',
        data.angle_axis + gfmt(res.nominal) + ' (' + res.measured.toFixed(2) + '°)');
      imgBox.appendChild(e);
      return e;
    });
    const labChk = h('div', abs(692, 755, 13, 13, 'background:#fff;border:1px solid #333;display:flex;align-items:center;justify-content:center;cursor:default;font:700 12px "Segoe UI Symbol",sans-serif;line-height:11px;'), '✓');
    labChk.addEventListener('click', () => { st.labels = !st.labels; labChk.textContent = st.labels ? '✓' : ''; paintOverlay(); });
    root_.append(labChk, h('div', abs(710, 751, null, 20, 'font:13.33px "Segoe UI",sans-serif;line-height:20px;white-space:nowrap;'), 'Show Angle Labels'));

    // ---------------- intersection box ----------------
    root_.appendChild(h('div', abs(1081, 98, 611, 686, 'background:#fff;border:1px solid ' + BORDER + ';')));
    const IW = 609, IH = 620, AXL = 0.15 * IW, AXR = 0.95 * IW, AYT = 0.05 * IH, AYB = 0.85 * IH;
    const isvg = sv('svg', { width: IW, height: IH, viewBox: '0 0 ' + IW + ' ' + IH, style: 'position:absolute;left:1082px;top:' + (101 - OFF) + 'px;display:block;font-family:' + MPL + ';' });
    root_.appendChild(isvg);
    const clipId = 'ssclip' + Math.floor(Math.random() * 1e9);
    const defs = sv('defs'); const cp = sv('clipPath', { id: clipId });
    cp.appendChild(sv('rect', { x: AXL, y: AYT, width: AXR - AXL, height: AYB - AYT }));
    defs.appendChild(cp); isvg.appendChild(defs);
    const gI = sv('g');
    isvg.appendChild(gI);
    lab('Intersection Zoom (mm):', 1189, 754, PRIMARY);
    const trough = h('div', abs(1346, 755.7, 249, 16, 'background:' + BAR + ';touch-action:none;cursor:default;'));
    const knob = h('div', 'position:absolute;top:0;width:30px;height:16px;background:#F0F0F0;border-top:1px solid #fff;border-left:1px solid #fff;border-right:2px solid #000;border-bottom:2px solid #000;box-sizing:border-box;');
    knob.appendChild(h('div', 'position:absolute;left:13px;top:0;bottom:0;width:1px;background:#000;'));
    trough.appendChild(knob);
    const zval = h('div', 'position:absolute;top:-18px;width:40px;text-align:center;font:13.33px "Segoe UI",sans-serif;line-height:16px;color:' + PRIMARY + ';');
    trough.appendChild(zval);
    root_.appendChild(trough);
    function setZoom(v) {
      st.zoom = Math.max(0.1, Math.min(2.0, Math.round(v * 10) / 10));
      const left = (st.zoom - 0.1) / 1.9 * (249 - 30);
      knob.style.left = left + 'px'; zval.style.left = (left + 15 - 20) + 'px'; zval.textContent = st.zoom.toFixed(1);
      paintInter();
    }
    const kScale = () => (body.offsetWidth ? body.getBoundingClientRect().width / body.offsetWidth : 1) || 1;
    let dragging = false;
    const zoomFrom = (ev) => {
      const r = trough.getBoundingClientRect(), k = kScale();
      const x = (ev.clientX - r.left) / k;
      setZoom(0.1 + clamp01((x - 15) / (249 - 30)) * 1.9);
    };
    trough.addEventListener('pointerdown', (ev) => { dragging = true; try { trough.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ } zoomFrom(ev); });
    trough.addEventListener('pointermove', (ev) => { if (dragging) zoomFrom(ev); });
    ['pointerup', 'pointercancel'].forEach((n) => trough.addEventListener(n, () => { dragging = false; }));

    function paintInter() {
      gI.textContent = '';
      if (destroyed || st.inter <= 0) return;
      const z = st.zoom, x0 = ISO[0] - z, x1 = ISO[0] + z, y0 = ISO[1] - z, y1 = ISO[1] + z;
      const X = (v) => AXL + (v - x0) / (x1 - x0) * (AXR - AXL);
      const Y = (v) => AYB - (v - y0) / (y1 - y0) * (AYB - AYT);
      const sx = (AXR - AXL) / (x1 - x0), sy = (AYB - AYT) / (y1 - y0);
      gI.appendChild(sv('rect', { x: AXL, y: AYT, width: AXR - AXL, height: AYB - AYT, fill: '#fff' }));
      const xt = mplTicks(x0, x1), yt = mplTicks(y0, y1);
      xt.ticks.forEach((v) => {
        const x = X(v);
        gI.append(sv('line', { x1: x, x2: x, y1: AYT, y2: AYB, stroke: '#b0b0b0', 'stroke-opacity': 0.4, 'stroke-width': 0.8 * PT, 'stroke-dasharray': (3.7 * 0.8 * PT) + ' ' + (1.6 * 0.8 * PT) }),
          sv('line', { x1: x, x2: x, y1: AYB, y2: AYB + 4.9, stroke: '#000', 'stroke-width': 1.1 }),
          sv('text', { x: x, y: AYB + 4.9 + 4.9 + 11, 'text-anchor': 'middle', 'font-size': 13.9 }, v.toFixed(xt.dec)));
      });
      yt.ticks.forEach((v) => {
        const y = Y(v);
        gI.append(sv('line', { x1: AXL, x2: AXR, y1: y, y2: y, stroke: '#b0b0b0', 'stroke-opacity': 0.4, 'stroke-width': 0.8 * PT, 'stroke-dasharray': (3.7 * 0.8 * PT) + ' ' + (1.6 * 0.8 * PT) }),
          sv('line', { x1: AXL - 4.9, x2: AXL, y1: y, y2: y, stroke: '#000', 'stroke-width': 1.1 }),
          sv('text', { x: AXL - 9.8, y: y + 4.8, 'text-anchor': 'end', 'font-size': 13.9 }, v.toFixed(yt.dec)));
      });
      const g = sv('g', { 'clip-path': 'url(#' + clipId + ')' });
      gI.appendChild(g);
      const fade = clamp01(st.inter / 0.2);
      const gl = sv('g', { opacity: fade });
      lines.forEach((ln, i) => {
        const d = (ln.r - CX * ln.a - CY * ln.b) * MM, L = 10;
        const px = ln.a * d + ISO[0], py = ln.b * d + ISO[1];
        gl.appendChild(sv('line', { x1: X(px + L * -ln.b), y1: Y(py + L * ln.a), x2: X(px - L * -ln.b), y2: Y(py - L * ln.a), stroke: data.line_colors[i], 'stroke-opacity': 0.9, 'stroke-width': 1.5 * PT, 'stroke-dasharray': (3.7 * 1.5 * PT) + ' ' + (1.6 * 1.5 * PT) }));
      });
      inter.forEach((p) => gl.appendChild(sv('circle', { cx: X(p[0] * MM), cy: Y(p[1] * MM), r: 2 * PT, fill: '#000', 'fill-opacity': 0.6 })));
      g.appendChild(gl);
      const grow = 1 - DM.anim.ease(clamp01((st.inter - 0.15) / 0.85));
      const rr = (fin) => fin + (0.9 * z - fin) * grow;
      const ell = (cx, cy, r, attrs) => g.appendChild(sv('ellipse', Object.assign({ cx: X(cx), cy: Y(cy), rx: r * sx, ry: r * sy, fill: 'none' }, attrs)));
      const plus = (cx, cy, size, w, color) => {
        const hs = size / 2;
        g.appendChild(sv('path', { d: 'M' + (X(cx) - hs) + ' ' + Y(cy) + 'H' + (X(cx) + hs) + 'M' + X(cx) + ' ' + (Y(cy) - hs) + 'V' + (Y(cy) + hs), stroke: color, 'stroke-width': w, fill: 'none' }));
      };
      const cen = [ICEN[0] * MM, ICEN[1] * MM];
      if (radMm > 0) ell(ISO[0], ISO[1], rr(radMm), { stroke: '#3B82F6', 'stroke-width': 4 * PT, 'stroke-opacity': 0.5 });
      if (perpMm > 0) {
        ell(cen[0], cen[1], rr(perpMm), { stroke: '#10B981', 'stroke-width': 1.5 * PT, 'stroke-dasharray': (3.7 * 1.5 * PT) + ' ' + (1.6 * 1.5 * PT) });
        plus(cen[0], cen[1], 10 * PT, 2 * PT, '#10B981');
      }
      if (avgMm > 0) ell(ISO[0], ISO[1], rr(avgMm), { stroke: '#F59E0B', 'stroke-width': 1.2 * PT, 'stroke-dasharray': [6.4, 1.6, 1, 1.6].map((s) => s * 1.2 * PT).join(' ') });
      plus(ISO[0], ISO[1], 15 * PT, 2.5 * PT, '#FF0000');
      // axes frame, labels
      gI.append(sv('rect', { x: AXL, y: AYT, width: AXR - AXL, height: AYB - AYT, fill: 'none', stroke: '#000', 'stroke-width': 1.1 }),
        sv('text', { x: (AXL + AXR) / 2, y: 571, 'text-anchor': 'middle', 'font-size': 13.9 }, 'X (mm)'),
        sv('text', { transform: 'translate(24,' + ((AYT + AYB) / 2 + 3) + ') rotate(-90)', 'text-anchor': 'middle', 'font-size': 13.9 }, 'Y (mm)'));
      if (st.inter >= 0.6) {
        const lx = 372, ly = 35, lw = 201, lh = 66;
        gI.appendChild(sv('rect', { x: lx + 0.5, y: ly + 0.5, width: lw, height: lh, rx: 3, fill: '#fff', 'fill-opacity': 0.8, stroke: '#CCCCCC', 'stroke-width': 1.1 }));
        const rowsY = [43.5, 59, 74.5, 90], hx = lx + 8, hw = 22, tx = lx + 36;
        const lbl = ['Min. Tangent Circle (R=' + radMm.toFixed(2) + ')', 'Max. Perp. Circle (R=' + perpMm.toFixed(2) + ')', 'Avg. Intersect Dev (R=' + avgMm.toFixed(2) + ')', 'Isocenter'];
        gI.append(
          sv('rect', { x: hx, y: rowsY[0] - 3.5, width: hw, height: 7, fill: '#3B82F6', 'fill-opacity': 0.5 }),
          sv('line', { x1: hx, x2: hx + hw, y1: rowsY[0], y2: rowsY[0], stroke: '#fff', 'stroke-opacity': 0.7, 'stroke-width': 1 }),
          sv('rect', { x: hx, y: rowsY[1] - 4, width: hw, height: 8, fill: 'none', stroke: '#10B981', 'stroke-width': 1.5 * PT, 'stroke-dasharray': '5 2.5' }),
          sv('rect', { x: hx, y: rowsY[2] - 4, width: hw, height: 8, fill: 'none', stroke: '#F59E0B', 'stroke-width': 1.2 * PT, 'stroke-dasharray': '8 2 1.5 2' }),
          sv('path', { d: 'M' + (hx + hw / 2 - 10) + ' ' + rowsY[3] + 'H' + (hx + hw / 2 + 10) + 'M' + (hx + hw / 2) + ' ' + (rowsY[3] - 10) + 'V' + (rowsY[3] + 10), stroke: '#FF0000', 'stroke-width': 2.5 * PT, fill: 'none' }));
        lbl.forEach((t, i) => gI.appendChild(sv('text', { x: tx, y: rowsY[i] + 3.9, 'font-size': 11.1 }, t)));
      }
    }

    // ---------------- profile box ----------------
    root_.appendChild(h('div', abs(450, 804, 1242, 200, 'background:#EBF5FB;border:1px solid ' + BORDER + ';')));
    const PW = 1240, PH = 198, PX0 = 0.05 * PW, PX1 = 0.98 * PW, PY0 = 0.1 * PH, PY1 = 0.75 * PH;
    const psvg = sv('svg', { width: PW, height: PH, viewBox: '0 0 ' + PW + ' ' + PH, style: 'position:absolute;left:451px;top:' + (805 - OFF) + 'px;display:block;font-family:' + MPL + ';' });
    root_.appendChild(psvg);
    const PXf = (d) => PX0 + d / 360 * (PX1 - PX0), PYf = (v) => PY1 - v / 110 * (PY1 - PY0);
    const gP = sv('g', { visibility: 'hidden' });
    psvg.appendChild(gP);
    gP.appendChild(sv('rect', { x: PX0, y: PY0, width: PX1 - PX0, height: PY1 - PY0, fill: '#fff' }));
    [0, 50, 100, 150, 200, 250, 300, 350].forEach((d) => {
      const x = PXf(d);
      gP.append(sv('line', { x1: x, x2: x, y1: PY0, y2: PY1, stroke: '#b0b0b0', 'stroke-opacity': 0.2, 'stroke-width': 0.8 * PT }),
        sv('line', { x1: x, x2: x, y1: PY1, y2: PY1 + 4.9, stroke: '#000', 'stroke-width': 1.1 }),
        sv('text', { x: x, y: PY1 + 4.9 + 4.9 + 11, 'text-anchor': 'middle', 'font-size': 13.9 }, String(d)));
    });
    [0, 50, 100].forEach((v) => {
      const y = PYf(v);
      gP.append(sv('line', { x1: PX0, x2: PX1, y1: y, y2: y, stroke: '#b0b0b0', 'stroke-opacity': 0.2, 'stroke-width': 0.8 * PT }),
        sv('line', { x1: PX0 - 4.9, x2: PX0, y1: y, y2: y, stroke: '#000', 'stroke-width': 1.1 }),
        sv('text', { x: PX0 - 9.8, y: y + 4.8, 'text-anchor': 'end', 'font-size': 13.9 }, String(v)));
    });
    const peakEls = data.peaks_deg.map((deg, i) => {
      const x = PXf(deg), cy = PYf(5) - 5;
      const g = sv('g', { visibility: 'hidden' });
      g.append(sv('line', { x1: x, x2: x, y1: PY0, y2: PY1, stroke: '#EF4444', 'stroke-opacity': 0.5, 'stroke-width': 1 * PT, 'stroke-dasharray': (1 * PT) + ' ' + (1.65 * PT) }),
        sv('rect', { x: x - 6.3, y: cy - 6.3, width: 12.6, height: 12.6, fill: '#EF4444', 'fill-opacity': 0.8 }),
        sv('text', { x: x, y: cy + 4, 'text-anchor': 'middle', 'font-size': 11.1, 'font-weight': 700, fill: '#fff' }, String(i + 1)));
      return { g, deg };
    });
    const ang = data.profile.angles_deg, dose = data.profile.dose;
    const pa = ang.map((a, i) => (i > 0 && a < ang[i - 1] ? a + 360 : a));
    const ppts = pa.map((a, i) => PXf(a).toFixed(1) + ',' + PYf(dose[i]).toFixed(1));
    const pline = sv('polyline', { fill: 'none', stroke: '#1E3F66', 'stroke-width': 2 * PT, 'stroke-linejoin': 'round', points: '' });
    gP.appendChild(pline);
    peakEls.forEach((p) => gP.appendChild(p.g));
    gP.append(sv('rect', { x: PX0, y: PY0, width: PX1 - PX0, height: PY1 - PY0, fill: 'none', stroke: '#000', 'stroke-width': 1.1 }),
      sv('text', { transform: 'translate(12,' + ((PY0 + PY1) / 2 + 4) + ') rotate(-90)', 'text-anchor': 'middle', 'font-size': 13.9 }, 'Dose (%)'));

    // ---------------- painting ----------------
    function paintProfile() {
      gP.setAttribute('visibility', st.sweep > 0 ? 'visible' : 'hidden');
      if (st.sweep <= 0) return;
      let n = 0;
      while (n < pa.length && pa[n] <= st.sweep + 1e-9) n++;
      pline.setAttribute('points', ppts.slice(0, Math.max(n, 1)).join(' '));
      peakEls.forEach((p) => p.g.setAttribute('visibility', st.sweep + 1e-9 >= p.deg ? 'visible' : 'hidden'));
    }
    function paintOverlay() {
      const p = st.ov, cpg = clamp01(p / 0.25), len = 2 * Math.PI * R * SC;
      circ.setAttribute('visibility', p > 0 ? 'visible' : 'hidden');
      circ.setAttribute('stroke-dasharray', cpg >= 1 ? 'none' : (len * cpg) + ' ' + len);
      badgeEls.forEach((g, i) => g.setAttribute('visibility', p >= 0.22 + 0.25 * i / badgeEls.length ? 'visible' : 'hidden'));
      lineEls.forEach((o, i) => {
        const f = clamp01((p - (0.45 + 0.35 * i / lines.length)) / 0.15);
        o.e.setAttribute('visibility', f > 0 ? 'visible' : 'hidden');
        if (f > 0) {
          const L = 1400 * DM.anim.ease(f);
          o.e.setAttribute('x1', U(o.foot[0] - L * o.d[0])); o.e.setAttribute('y1', V(o.foot[1] - L * o.d[1]));
          o.e.setAttribute('x2', U(o.foot[0] + L * o.d[0])); o.e.setAttribute('y2', V(o.foot[1] + L * o.d[1]));
        }
        if (labelEls[i]) labelEls[i].style.display = (f >= 1 && st.labels) ? '' : 'none';
      });
      foundEl.textContent = p >= 0.5 ? String(data.beams) : '0';
    }
    function paintTable() {
      const { rows, ok } = buildRows();
      rowsIn.textContent = '';
      rows.forEach((r, i) => {
        const row = h('div', 'height:' + ROWH + 'px;position:relative;' + (i < st.rows ? '' : 'display:none;'));
        const tag = r[2] === 'PASS' ? 'PASS' : (r[2] === 'FAIL' || r[2] === 'ASSUMED' ? 'FAIL' : '');
        const font = tag ? '700 14.67px' : '13.33px', color = tag === 'PASS' ? '#059669' : tag === 'FAIL' ? '#E74C3C' : TEXT;
        COLS.forEach(([, x, w], c) => row.appendChild(h('div', 'position:absolute;left:' + (x - 33) + 'px;top:0;width:' + w + 'px;height:' + ROWH + 'px;overflow:hidden;white-space:nowrap;line-height:' + ROWH + 'px;font:' + font + ' "Segoe UI",sans-serif;line-height:' + ROWH + 'px;color:' + color + ';text-align:' + (c ? 'center' : 'left') + (c ? '' : ';padding-left:4px;box-sizing:border-box;'), r[c])));
        rowsIn.appendChild(row);
      });
      const shown = Math.min(st.rows, rows.length);
      // the table grows as rows arrive: keep the viewport on the newest row, like Tk's see()
      const sticky = Math.max(0, shown * ROWH - VIEWH);
      rowsIn.style.height = (rows.length * ROWH) + 'px';
      rowsIn.dataset.n = shown;
      setScroll(st.autoScroll ? sticky : st.scroll);
      if (st.status) {
        banner.textContent = 'OVERALL STATUS: ' + (ok ? 'PASS' : 'FAIL');
        banner.style.background = ok ? '#DCFCE7' : '#FEE2E2'; banner.style.color = ok ? '#166534' : '#991B1B';
      } else {
        banner.textContent = 'STATUS: READY';
        banner.style.background = BAR; banner.style.color = PRIMARY;
      }
    }
    function paintAll() {
      if (destroyed) return;
      paintProfile(); paintOverlay(); paintInter(); paintTable();
    }

    // ---------------- player ----------------
    const wait = (ms, token) => DM.anim.wait(ms, token);
    const nRows = () => buildRows().rows.length;
    const steps = [
      { name: 'merge', async run(token) {
        paintMerge(0, 0);
        await DM.anim.tween(300 * nFrames, (t) => paintMerge(t * nFrames, 0), token);
        paintMerge(nFrames, 0);
        await wait(250, token);
        await DM.anim.tween(700, (t) => paintMerge(nFrames, t), token);
        paintMerge(null);
        await wait(200, token);
      } },
      { name: 'profile', async run(token) {
        st.autoScroll = false; st.sweep = 1e-6; paintAll();
        await DM.anim.tween(2600, (t) => { st.sweep = Math.max(1e-6, t * 360); paintProfile(); }, token);
        st.sweep = 360; paintAll();
        await wait(300, token);
      } },
      { name: 'overlay', async run(token) {
        st.ov = 1e-6; paintAll();
        await DM.anim.tween(3000, (t) => { st.ov = Math.max(1e-6, t); paintOverlay(); }, token);
        st.ov = 1; paintAll();
        await wait(300, token);
      } },
      { name: 'intersection', async run(token) {
        st.inter = 1e-6; paintAll();
        await DM.anim.tween(2600, (t) => { st.inter = Math.max(1e-6, t); paintInter(); }, token);
        st.inter = 1; paintAll();
        await wait(300, token);
      } },
      { name: 'table', async run(token) {
        const n = nRows();
        st.autoScroll = true;
        for (let i = 0; i < n; i++) { st.rows = i + 1; paintAll(); await wait(110, token); }
        st.autoScroll = false; st.scroll = 0;
        st.status = true; paintAll();
        await wait(700, token);
      } },
    ];
    function setFor(k) {
      paintMerge(null);
      st.sweep = k >= 1 ? 360 : 0;
      st.ov = k >= 2 ? 1 : 0;
      st.inter = k >= 3 ? 1 : 0;
      st.rows = k >= 4 ? nRows() : 0;
      st.status = k >= 4;
      st.autoScroll = false; st.scroll = 0;
    }
    player = new DM.Player({
      steps,
      render(k) { if (destroyed) return; setFor(k); paintAll(); },
      onChange(s) {
        if (destroyed) return;
        runBtn.textContent = s.playing ? 'ANALYZING...' : 'RUN ANALYSIS';
      },
    });
    [tolIn, targetIn, angTolIn].forEach((e) => e.addEventListener('input', () => { if (st.rows) { st.rows = Math.min(st.rows, nRows()); paintTable(); } }));

    setFor(-1);
    setZoom(1.0);
    paintAll();

    return {
      player: { toggle: runClick, next: () => player.next(), prev: () => player.prev(), get state() { return Object.assign({ count: steps.length }, player.state); }, },   // Space = the RUN button
      get ready() { return readyFlag && readyFrames; },
      destroy() {
        destroyed = true;
        player.destroy();
        root_.remove();
      },
    };
  }

  DM.windows.starshot = { title: 'Star Shot Analysis (DOSICARE Platform)', width: W, height: H, theme: 'light', mount };
})(typeof window !== 'undefined' ? window : globalThis);
