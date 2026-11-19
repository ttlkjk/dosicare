/* DosiMachine replica - Winston-Lutz window ("DOSICARE Winston-Lutz Analysis Platform").
   Layout follows the original maximized window (client area of the original capture, 1707 x 996).
   RUN ANALYSIS plays 4 steps: results table + thumbnail markers, bars, statistical indicators, verdict.
   All numbers are the baked results of the real run (DM_DATA.wl). Tk 96 DPI: 9pt = 12px, 10pt = 13.33px. */
(function (root) {
  const DM = root.DM = root.DM || {};
  DM.windows = DM.windows || {};

  const W = 1707, H = 996;
  const PRIMARY = '#1A5276', BAR = '#D6EAF8', BORDER = '#BDC3C7', TEXT = '#1E293B';
  const MPL = '"DejaVu Sans", Verdana, "Segoe UI", sans-serif';
  const NS = 'http://www.w3.org/2000/svg';

  const METRICS = [
    ['OVERALL STATUS', true, 'status'],
    ['3D Iso Center Offset (mm)', true, 'iso_3d_offset'],
    ['Max. 2D Deviation (mm)', false, 'iso_2d_max'],
    ['Mean 2D Deviation (mm)', false, 'iso_2d_mean'],
    ['Setup Error X (mm)', false, 'setup_error_x'],
    ['Setup Error Y (mm)', false, 'setup_error_y'],
    ['Setup Error Z (mm)', false, 'setup_error_z'],
    ['Gantry Iso Radius (mm)', false, 'gantry_iso_radius'],
    ['Couch Iso Radius (mm)', false, 'couch_iso_radius'],
    ['Collimator Iso Radius (mm)', false, 'collimator_iso_radius'],
    ['Gantry 3D Iso Diameter (mm)', false, 'gantry_3d_iso_diameter'],
    ['Gantry+Coll 3D Iso Diameter (mm)', false, 'gantry_coll_3d_iso_diameter'],
    ['Max. Machine Dev. (mm)', false, 'machine_dev_max'],
    ['Std. Machine Dev. (mm)', false, 'machine_dev_std'],
    ['--- SUGGESTED SHIFT ---', true, 'shift'],
    ['Move Couch LAT (X) by', false, 'lat'],
    ['Move Couch LONG (Y) by', false, 'long'],
    ['Move Couch VERT (Z) by', false, 'vert'],
  ];
  const COLS = ['File', 'Gantry', 'Couch', 'Collimator', 'Horizontal (mm)', 'Vertical (mm)', 'Dev 2D (mm)', 'Status'];
  const COLW = [264, 134, 134, 134, 134, 134, 154, 132];
  const SCALE_TXT = 'Scale: 0.260985 mm/px (3002,0011) [PDIP export: already at iso scale] | 0.261159 mm/px (3002,0011) '
    + '[PDIP export: already at iso scale]  (+3 more variants, all in the report)';

  const fmt = (v) => v.toFixed(3);
  const sgn = (v) => (v >= 0 ? '+' : '-') + Math.abs(v).toFixed(3);
  const atZero = (a) => { const m = ((a % 360) + 360) % 360; return Math.min(m, 360 - m) <= 1.0; };
  const lighten = (hex) => '#' + [1, 3, 5].map((i) => Math.min(255, Math.floor(parseInt(hex.substr(i, 2), 16) * 1.3)).toString(16).padStart(2, '0')).join('');

  function h(tag, css, text, cls) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }
  const abs = (x, y, w, hh, extra) => 'position:absolute;left:' + x + 'px;top:' + y + 'px;' + (w != null ? 'width:' + w + 'px;' : '') + (hh != null ? 'height:' + hh + 'px;' : '') + (extra || '');
  function sv(tag, attrs, text) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }

  function niceTicks(max) {
    const steps = [0.01, 0.02, 0.025, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10];
    let s = steps[steps.length - 1];
    for (const c of steps) if (Math.floor(max / c + 1e-9) + 1 <= 8) { s = c; break; }
    const out = [];
    for (let v = 0; v <= max + 1e-9; v += s) out.push(Math.round(v / s) * s);
    return { step: s, ticks: out };
  }
  const tickTxt = (v, s) => v.toFixed(s >= 1 ? 0 : (String(s).split('.')[1] || '').length >= 2 ? 2 : 1);

  function mount(body) {
    const data = root.DM_DATA.wl;
    const imgs = data.images;
    const N = imgs.length;
    const root_ = h('div', null, null, 'wl-root');
    body.appendChild(root_);
    let destroyed = false;
    const timers = [];

    const toast = () => DM.shell.toast('데모에서는 동작하지 않습니다');

    // ---------------- state ----------------
    const st = { rows: 0, bars: 0, chart: false, stat: 0, prov: false, status: false, tol: data.tols.iso_3d_offset.fail, sel: -1 };
    const tolResid = () => data.tols.machine_dev_max.fail;
    const dev = (i) => imgs[i].dist2d;
    const rowStatus = (i) => {
      const t = data.tols.iso_2d_max;
      if (t.enabled === false) return 'n/a';
      return dev(i) <= t.fail ? 'PASS' : 'FAIL';
    };
    const tolsNow = () => {
      const t = JSON.parse(JSON.stringify(data.tols));
      t.iso_3d_offset.fail = st.tol;
      return t;
    };
    const verdict = () => DM.grade.wl(data.measured, tolsNow());
    const metricStatus = (key) => {
      const t = tolsNow()[key], v = data.measured[key];
      if (!t || t.enabled === false || v === null || v === undefined) return null;
      return (t.sides === 'two' ? Math.abs(v) : v) > t.fail ? 'FAIL' : 'PASS';
    };
    const couchGroup = imgs.filter((it) => atZero(it.gantry) && atZero(it.collimator)).length;
    const naText = (key) => (key === 'couch_iso_radius' ? 'n/a (' + couchGroup + ' img isolate couch)' : 'n/a');

    // ---------------- header ----------------
    const header = h('div', abs(0, 0, W, 60, 'background:' + PRIMARY + ';display:flex;align-items:center;'));
    header.append(
      h('div', 'font:700 21.33px "Segoe UI",sans-serif;color:#F8FAFC;padding:0 20px;white-space:nowrap;', 'DOSICARE PRECISION PLATFORM'),
      h('div', 'font:700 12px "Segoe UI",sans-serif;color:#AED6F1;white-space:nowrap;margin-top:0;', '|  Winston-Lutz Clinical QA Module'));
    root_.appendChild(header);

    // ---------------- settings ----------------
    const sp = h('div', abs(15, 75, 233, 662, 'background:#fff;border:1px solid ' + BORDER + ';'));
    sp.appendChild(h('div', abs(6, 5, null, null, 'font:700 14.67px "Segoe UI",sans-serif;color:' + PRIMARY + ';white-space:pre;'), 'ANALYSIS PARAMETERS'));
    const lab = (t, cy, color) => sp.appendChild(h('div', abs(14, cy - 75 - 10, null, 20, 'font:13.33px "Segoe UI",sans-serif;line-height:20px;white-space:nowrap;color:' + (color || '#000')), t));
    const entry = (val, y, w) => {
      const e = h('input', abs(11, y, w, y === 361 ? 20 : 23, 'font:' + (y === 361 ? '13.33' : '14.67') + 'px "Segoe UI",sans-serif;'), null, 'wl-entry');
      e.type = 'text'; e.value = val; e.spellcheck = false;
      e.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') e.blur(); });
      sp.appendChild(e);
      return e;
    };
    lab('Physical Ball Dia (cm):', 129); entry('0.5', 69, 132);
    lab('Source-Imager Dist (cm):', 200); entry('150.0', 140, 132);
    lab('Source-Ball Dist (cm):', 271); entry('100.0', 211, 132);
    lab('Clinical Tolerance (mm):', 342);
    const tolIn = entry(String(data.tols.iso_3d_offset.fail.toFixed(1)), 282, 132);
    const perItem = h('div', abs(149, 282, 74, 23, 'background:#5D6D7E;color:#fff;font:700 10.67px "Segoe UI",sans-serif;display:flex;align-items:center;justify-content:center;cursor:pointer;'), 'Per-Item...');
    perItem.addEventListener('click', toast);
    sp.appendChild(perItem);
    lab('File Name Filter:', 420, '#475569'); entry('*', 361, 212);
    const chk = h('div', abs(16, 407, 13, 13, 'border:1px solid #333;background:#fff;display:flex;align-items:center;justify-content:center;font:700 12px "Segoe UI Symbol",sans-serif;line-height:11px;cursor:default;'), '✓');
    let chkOn = true;
    chk.addEventListener('click', () => { chkOn = !chkOn; chk.textContent = chkOn ? '✓' : ''; });
    sp.append(chk, h('div', abs(34, 405, null, 20, 'font:13.33px "Segoe UI",sans-serif;line-height:20px;white-space:nowrap;'), 'Auto-detect from DICOM'));
    root_.appendChild(sp);

    // ---------------- results table ----------------
    const tc = h('div', abs(261, 77, 1220, 222, 'background:#fff;border:1px solid ' + BORDER + ';overflow:hidden;'));
    const th = h('div', abs(0, 0, 1218, 37, 'background:' + PRIMARY + ';'));
    th.append(
      h('div', abs(16, 0, null, 37, 'font:700 13.33px "Segoe UI",sans-serif;color:#fff;line-height:37px;white-space:pre;'), 'DOSICARE RESULTS DATASET  |  DOSICARE IEC 1217'),
      h('div', abs(0, 0, null, 37, 'right:16px;left:auto;font:12px "Segoe UI",sans-serif;color:#D6EAF8;line-height:37px;white-space:nowrap;'), 'Angles read from DICOM - double-click a row, or select it and press Edit Angles'));
    const headRow = h('div', abs(0, 37, 1218, 25, 'background:' + BAR + ';display:flex;'));
    COLS.forEach((c, i) => headRow.appendChild(h('div', 'width:' + COLW[i] + 'px;flex:none;text-align:' + (i ? 'center' : 'center') + ';font:700 13.33px "Segoe UI",sans-serif;color:' + PRIMARY + ';line-height:25px;', c)));
    const rowsBox = h('div', abs(0, 62, 1218, 160, 'overflow:hidden;'));
    const rowsIn = h('div', 'position:relative;');
    rowsBox.appendChild(rowsIn);
    const rowEls = [];
    imgs.forEach((im, i) => {
      const r = h('div', 'height:32px;display:flex;font:13.33px "Segoe UI",sans-serif;line-height:32px;color:#000;');
      const cells = [];
      const vals = ['G' + im.gantry + ' C' + im.couch + ' T' + im.collimator, im.gantry.toFixed(1), im.couch.toFixed(1), im.collimator.toFixed(1), '', '', '', ''];
      vals.forEach((v, c) => {
        const cell = h('div', 'width:' + COLW[c] + 'px;flex:none;white-space:nowrap;overflow:hidden;text-align:' + (c ? 'center' : 'left') + (c ? '' : ';padding-left:5px'), v);
        cells.push(cell); r.appendChild(cell);
      });
      r.addEventListener('click', () => select(st.sel === i ? -1 : i));
      rowsIn.appendChild(r); rowEls.push({ r, cells });
    });
    rowsBox.addEventListener('wheel', (e) => { e.preventDefault(); rowsBox.scrollTop += e.deltaY > 0 ? 32 : -32; }, { passive: false });
    tc.append(th, headRow, rowsBox);
    root_.appendChild(tc);

    // ---------------- chart ----------------
    const CW = 800, CH = 437, AX0 = 71, AX1 = 786, AY0 = 44, AY1 = 327;
    const UNIT = (AX1 - AX0) / 11.88, XOFF = 0.94;
    const chartBox = h('div', abs(261, 300, CW, CH, 'background:' + '#EBF5FB' + ';border:1px solid ' + BORDER + ';border-right:0;'));
    const svg = sv('svg', { width: CW, height: CH, viewBox: '0 0 ' + CW + ' ' + CH, style: 'position:absolute;left:-1px;top:-1px;display:block;font-family:' + MPL });
    chartBox.appendChild(svg);
    root_.appendChild(chartBox);
    const gGrid = sv('g'), gBars = sv('g'), gTop = sv('g'), gAxes = sv('g'), gLegend = sv('g');
    svg.append(sv('rect', { x: AX0, y: AY0, width: AX1 - AX0, height: AY1 - AY0, fill: '#fff' }), gGrid, gBars, gTop, gAxes, gLegend);
    const barEls = [], valEls = [];
    let ymaxNow = 1;
    const maxRes = Math.max.apply(null, imgs.map((i) => i.residual));

    function buildAxesEmpty() {
      gGrid.textContent = ''; gBars.textContent = ''; gTop.textContent = ''; gAxes.textContent = ''; gLegend.textContent = '';
      barEls.length = 0; valEls.length = 0;
      const ticks = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
      gAxes.appendChild(sv('rect', { x: AX0, y: AY0, width: AX1 - AX0, height: AY1 - AY0, fill: 'none', stroke: '#000', 'stroke-width': 1.1 }));
      ticks.forEach((v) => {
        const y = AY1 - v * (AY1 - AY0), x = AX0 + v * (AX1 - AX0);
        gAxes.append(sv('line', { x1: AX0 - 4.9, x2: AX0, y1: y, y2: y, stroke: '#000', 'stroke-width': 1.1 }),
          sv('text', { x: AX0 - 9.8, y: y + 4.8, 'text-anchor': 'end', 'font-size': 13.9 }, v.toFixed(1)),
          sv('line', { x1: x, x2: x, y1: AY1, y2: AY1 + 4.9, stroke: '#000', 'stroke-width': 1.1 }),
          sv('text', { x: x, y: AY1 + 4.9 + 4.9 + 11, 'text-anchor': 'middle', 'font-size': 13.9 }, v.toFixed(1)));
      });
    }

    function buildChart() {
      gGrid.textContent = ''; gBars.textContent = ''; gTop.textContent = ''; gAxes.textContent = ''; gLegend.textContent = '';
      barEls.length = 0; valEls.length = 0;
      const tr = tolResid();
      const ymax = Math.max(maxRes * 1.5, tr * 1.5);
      ymaxNow = ymax;
      const Y = (v) => AY1 - v / ymax * (AY1 - AY0);
      const X = (i) => AX0 + (i + XOFF) * UNIT;
      const nt = niceTicks(ymax);
      nt.ticks.forEach((v) => {
        const y = Y(v);
        gGrid.appendChild(sv('line', { x1: AX0, x2: AX1, y1: y, y2: y, stroke: '#EBEDEF', 'stroke-width': 1.1, 'stroke-dasharray': '1.1 1.8' }));
        gAxes.append(sv('line', { x1: AX0 - 4.9, x2: AX0, y1: y, y2: y, stroke: '#000', 'stroke-width': 1.1 }),
          sv('text', { x: AX0 - 9.8, y: y + 4.8, 'text-anchor': 'end', 'font-size': 13.9 }, tickTxt(v, nt.step)));
      });
      imgs.forEach((im, i) => {
        const rect = sv('rect', { x: X(i) - 0.4 * UNIT, width: 0.8 * UNIT, y: AY1, height: 0, fill: '#60829A', 'fill-opacity': 0.9 });
        gBars.appendChild(rect); barEls.push(rect);
        const t = sv('text', { x: X(i), y: Y(im.residual + 0.05), 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700, fill: PRIMARY, opacity: 0 }, im.residual.toFixed(2));
        gTop.appendChild(t); valEls.push(t);
        gAxes.append(sv('line', { x1: X(i), x2: X(i), y1: AY1, y2: AY1 + 4.9, stroke: '#000', 'stroke-width': 1.1 }));
        const lines = ['G' + Math.round(im.gantry), 'C' + Math.round(im.couch), 'R' + Math.round(im.collimator)];
        lines.forEach((ln, k) => gAxes.appendChild(sv('text', { x: X(i), y: 342 + 16 * k + 4.8, 'text-anchor': 'middle', 'font-size': 13.9, 'font-weight': 700, fill: TEXT }, ln)));
      });
      gTop.insertBefore(sv('line', { x1: AX0, x2: AX1, y1: Y(tr), y2: Y(tr), stroke: '#E74C3C', 'stroke-width': 2.78, 'stroke-dasharray': '10.3 4.4' }), gTop.firstChild);
      gAxes.appendChild(sv('rect', { x: AX0, y: AY0, width: AX1 - AX0, height: AY1 - AY0, fill: 'none', stroke: '#000', 'stroke-width': 1.1 }));
      gAxes.append(
        sv('text', { x: (AX0 + AX1) / 2, y: 416, 'text-anchor': 'middle', 'font-size': 16.2 }, 'Beam Configuration (G: Gantry, C: Couch, R: Collimator)'),
        sv('text', { transform: 'translate(22,' + ((AY0 + AY1) / 2 + 4) + ') rotate(-90)', 'text-anchor': 'middle', 'font-size': 16.7 }, 'Deviation (mm)'),
        sv('text', { x: (AX0 + AX1) / 2, y: 30, 'text-anchor': 'middle', 'font-size': 20.4, 'font-weight': 700, fill: PRIMARY }, 'DOSICARE 3D STEREOTACTIC ALIGNMENT SUMMARY'));
      gLegend.append(
        sv('rect', { x: 78.5, y: 47.5, width: 248, height: 50, rx: 3, fill: '#fff', 'fill-opacity': 0.8, stroke: '#CCCCCC', 'stroke-width': 1.1 }),
        sv('line', { x1: 84, x2: 116, y1: 62, y2: 62, stroke: '#E74C3C', 'stroke-width': 2.78, 'stroke-dasharray': '10.3 4.4' }),
        sv('text', { x: 128, y: 67.3, 'font-size': 15.1 }, 'Tolerance (' + (+tr.toPrecision(6)) + 'mm)'),
        sv('rect', { x: 84, y: 77, width: 32, height: 13, fill: '#60829A', 'fill-opacity': 0.9 }),
        sv('text', { x: 128, y: 89.3, 'font-size': 15.1 }, 'Machine Performance (R)'));
      st.built = true;
    }

    function paintBars() {
      const Y = (v) => AY1 - v / ymaxNow * (AY1 - AY0);
      imgs.forEach((im, i) => {
        const f = Math.max(0, Math.min(1, st.bars - i));
        const e = DM.anim.ease(f);
        const top = Y(im.residual * e);
        barEls[i].setAttribute('y', top);
        barEls[i].setAttribute('height', AY1 - top);
        valEls[i].setAttribute('opacity', f >= 1 ? 1 : 0);
      });
    }

    // ---------------- statistical indicators ----------------
    const stp = h('div', abs(1061, 300, 420, 437, 'background:' + BAR + ';border:1px solid ' + BORDER + ';'));
    stp.appendChild(h('div', abs(18, 22, null, 20, 'font:700 14.67px "Segoe UI",sans-serif;color:' + PRIMARY + ';white-space:nowrap;line-height:20px;'), 'STATISTICAL INDICATORS'));
    const mview = h('div', abs(18, 53, 369, 302, 'overflow:hidden;'));
    const mrows = h('div', 'position:relative;');
    mview.appendChild(mrows);
    const valEl = {};
    METRICS.forEach(([name, bold, key]) => {
      const r = h('div', 'height:27px;position:relative;');
      r.appendChild(h('div', 'position:absolute;left:0;top:2px;font:' + (bold ? '700 ' : '') + '13.33px "Segoe UI",sans-serif;line-height:23px;color:' + TEXT + ';white-space:nowrap;', name));
      const v = h('div', 'position:absolute;right:0;top:2px;font:700 13.33px "Segoe UI",sans-serif;line-height:23px;color:' + PRIMARY + ';white-space:nowrap;', '--');
      r.appendChild(v); mrows.appendChild(r); valEl[key] = v;
    });
    const MH = METRICS.length * 27;
    const sb = h('div', abs(389, 53, 15, 302, 'background:#F0F0F0;'));
    const sbUp = h('div', abs(0, 0, 15, 15, 'font:8px "Segoe UI Symbol",sans-serif;color:#606060;text-align:center;line-height:15px;cursor:default;'), '▲');
    const sbDn = h('div', abs(0, 287, 15, 15, 'font:8px "Segoe UI Symbol",sans-serif;color:#606060;text-align:center;line-height:15px;cursor:default;'), '▼');
    const sbTh = h('div', abs(2, 15, 11, 100, 'background:#CDCDCD;'));
    sb.append(sbUp, sbDn, sbTh);
    let mscroll = 0;
    const maxScroll = MH - 302;
    const setScroll = (v) => {
      mscroll = Math.max(0, Math.min(maxScroll, v));
      mrows.style.top = -mscroll + 'px';
      const track = 302 - 30, thH = Math.max(20, Math.round(track * 302 / MH));
      sbTh.style.height = thH + 'px';
      sbTh.style.top = (15 + Math.round((track - thH) * (maxScroll ? mscroll / maxScroll : 0))) + 'px';
    };
    mview.addEventListener('wheel', (e) => { e.preventDefault(); setScroll(mscroll + (e.deltaY > 0 ? 69 : -69)); }, { passive: false });
    sbUp.addEventListener('click', () => setScroll(mscroll - 23));
    sbDn.addEventListener('click', () => setScroll(mscroll + 23));
    setScroll(0);
    const prov = h('div', abs(18, 366, 385, 52, 'font:10.67px "Segoe UI",sans-serif;line-height:13px;color:#5D6D7E;white-space:pre-wrap;'), 'Scale: --');
    stp.append(mview, sb, prov);
    root_.appendChild(stp);

    // ---------------- action buttons ----------------
    const mkBtn = (txt, color, y, fn) => {
      const b = h('div', abs(1493, y, 189, 36, 'background:' + color + ';color:#fff;font:700 13.33px "Segoe UI",sans-serif;display:flex;align-items:center;justify-content:center;cursor:pointer;'), txt);
      b.addEventListener('mouseenter', () => { b.style.background = lighten(color); });
      b.addEventListener('mouseleave', () => { b.style.background = color; });
      b.addEventListener('click', fn);
      root_.appendChild(b);
      return b;
    };
    const section = (txt, cy) => root_.appendChild(h('div', abs(1496, cy - 10, null, 20, 'font:700 12px "Segoe UI",sans-serif;line-height:20px;color:#7F8C8D;white-space:nowrap;'), txt));
    let player = null, vstar = null;
    const runClick = async () => {
      if (!player || destroyed || vstar) return;
      if (player.state.playing) { player.pause(); return; }
      if (player.index >= player.steps.length - 1) await player.reset();
      player.play();
    };
    mkBtn('RUN ANALYSIS', '#1E8449', 77, runClick);
    mkBtn('EXPORT PDF', '#E74C3C', 121, toast);
    section('FILE MANAGEMENT', 182);
    ['Load Folder', 'Load File(s)', 'Edit Angles', 'Delete Selected'].forEach((t, i) => mkBtn(t, '#5D6D7E', 199 + 46 * i, toast));
    mkBtn('Clear Dataset', '#E74C3C', 383, toast);
    section('ADVANCED ANALYTICS', 445);
    // VIRTUAL STARSHOT (generate_synthetic_starshot): the original always re-runs the analysis first,
    // then builds the film, asks where to save the DICOM and loads it into the main viewer.
    const virtualStarshot = async () => {
      if (!player || destroyed || vstar || !DM.vstar) return;
      vstar = { destroy() {} };            // claims the window now: RUN / Space / the auto-run leave the analysis alone
      const last = player.steps.length - 1;
      if (player.index < last) {
        if (player.state.playing) player.pause();
        await player.play();
        if (destroyed || player.index < last) { vstar = null; return; }
      }
      vstar = DM.vstar.build(root_, {
        images: imgs,
        onClose: () => { if (vstar) { vstar.destroy(); vstar = null; } },
        onLoaded: (res) => {
          if (vstar) { vstar.destroy(); vstar = null; }
          if (DM.win) DM.win.close();     // the main viewer sits behind this maximized window
          if (DM.mainview && DM.mainview.openSynthetic) DM.mainview.openSynthetic(res);
        },
      });
    };
    mkBtn('VIRTUAL STARSHOT', '#5D6D7E', 462, virtualStarshot);
    ['BEAM CROSSING', '3D ISOCENTER VIEW'].forEach((t, i) => mkBtn(t, '#5D6D7E', 508 + 46 * i, toast));

    // ---------------- thumbnails ----------------
    const bs = h('div', abs(15, 754, 1677, 227, 'background:#fff;border:1px solid ' + BORDER + ';overflow:hidden;'));
    bs.appendChild(h('div', abs(0, 0, 1675, 40, 'background:' + BAR + ';font:700 13.33px "Segoe UI",sans-serif;color:' + PRIMARY + ';line-height:40px;padding-left:18px;white-space:nowrap;'), 'IMAGE PREVIEW & VERIFICATION (85px ZOOM)'));
    const strip = h('div', abs(0, 40, 1675, 185, 'overflow-x:auto;overflow-y:hidden;background:#fff;'), null, 'wl-strip');
    const stripIn = h('div', 'position:relative;height:168px;width:' + (6 + 162 * N) + 'px;');
    strip.appendChild(stripIn);
    bs.appendChild(strip);
    root_.appendChild(bs);
    const BOX = 108.5, ZR = 85 * (0.260985 / imgs[0].mm_per_px), SC = BOX / (2 * ZR);
    const thumbs = [];
    let loaded = 0, readyFlag = false;
    imgs.forEach((im, i) => {
      const fr = h('div', abs(6 + 162 * i, 5, 154, 163, 'background:#fff;border:1px solid ' + BORDER + ';cursor:default;'));
      const box = h('div', abs(23, 20, BOX, BOX, 'overflow:hidden;background:#fff;'));
      const img = new Image();
      img.draggable = false; img.alt = '';
      img.style.cssText = 'position:absolute;display:block;max-width:none;filter:invert(1) brightness(0.93);width:' + (im.w * SC) + 'px;height:' + (im.h * SC) + 'px;left:' + (-(im.cax[0] - ZR) * SC) + 'px;top:' + (-(im.cax[1] - ZR) * SC) + 'px;';
      const done = () => { loaded += 1; if (loaded >= N) readyFlag = true; };
      img.onload = done; img.onerror = done;
      img.src = 'data/' + im.png;
      box.appendChild(img);
      const mk = sv('svg', { width: BOX, height: BOX, viewBox: '0 0 ' + BOX + ' ' + BOX, style: 'position:absolute;left:0;top:0;display:none;' });
      const c = BOX / 2, bx = c + (im.bb[0] - im.cax[0]) * SC, by = c + (im.bb[1] - im.cax[1]) * SC, a = 6.95;
      mk.append(
        sv('path', { d: 'M' + (c - a) + ' ' + c + 'H' + (c + a) + 'M' + c + ' ' + (c - a) + 'V' + (c + a), stroke: '#FF0000', 'stroke-width': 2.08, fill: 'none' }),
        sv('path', { d: 'M' + (bx - a) + ' ' + (by - a) + 'L' + (bx + a) + ' ' + (by + a) + 'M' + (bx - a) + ' ' + (by + a) + 'L' + (bx + a) + ' ' + (by - a), stroke: '#008000', 'stroke-width': 2.08, fill: 'none' }));
      box.appendChild(mk);
      const cap = h('div', abs(0, 144, 152, 20, 'text-align:center;font:700 12px "Segoe UI",sans-serif;line-height:20px;color:' + TEXT + ';white-space:nowrap;'),
        'G:' + Math.round(im.gantry) + ' C:' + Math.round(im.couch) + ' R:' + Math.round(im.collimator));
      fr.append(box, cap);
      fr.addEventListener('click', () => select(st.sel === i ? -1 : i));
      stripIn.appendChild(fr);
      thumbs.push({ fr, mk, cap });
    });

    // ---------------- painting ----------------
    function select(i) { st.sel = i; paintSel(); }
    function paintSel() {
      rowEls.forEach((o, i) => {
        const on = i === st.sel;
        o.r.style.background = on ? '#2980B9' : ''; o.r.style.color = on ? '#fff' : '#000';
      });
      thumbs.forEach((t, i) => {
        const on = i === st.sel;
        t.fr.style.background = on ? BAR : '#fff';
        t.fr.style.border = (on ? '3px solid ' + PRIMARY : '1px solid ' + BORDER);
        t.fr.style.left = (6 + 162 * i) + 'px';
        t.cap.style.background = on ? BAR : '';
        t.cap.style.color = on ? PRIMARY : TEXT;
        t.cap.style.marginLeft = on ? '-2px' : '0';
        t.cap.style.top = on ? '142px' : '144px';
      });
    }
    function paintTable() {
      imgs.forEach((im, i) => {
        const on = i < st.rows, c = rowEls[i].cells;
        c[4].textContent = on ? fmt(im.horiz) : '';
        c[5].textContent = on ? fmt(im.vert) : '';
        c[6].textContent = on ? fmt(im.dist2d) : '';
        c[7].textContent = on ? rowStatus(i) : '';
        thumbs[i].mk.style.display = on ? 'block' : 'none';
      });
    }
    function colorFor(key) {
      const s = metricStatus(key);
      return s === null ? PRIMARY : (s === 'FAIL' ? '#C0392B' : '#1D8348');
    }
    function paintStats() {
      const f = st.stat, e = f >= 1 ? 1 : DM.anim.ease(f);
      const shown = f > 0;
      METRICS.forEach(([name, bold, key]) => {
        if (key === 'status') return;
        const el = valEl[key];
        if (!shown) { el.textContent = '--'; el.style.color = PRIMARY; return; }
        const m = data.measured;
        let txt, col = PRIMARY;
        if (key === 'shift') {
          txt = (m.iso_3d_offset * e).toFixed(3) + ' mm';
          col = metricStatus('iso_3d_offset') === 'FAIL' ? '#E67E22' : '#28B463';
        } else if (key === 'lat' || key === 'long' || key === 'vert') {
          const v = key === 'lat' ? -m.setup_error_x : key === 'long' ? -m.setup_error_y : -m.setup_error_z;
          txt = sgn(v * e) + ' mm'; col = '#2980B9';
        } else {
          const v = m[key];
          if (v === null || v === undefined) txt = key === 'machine_dev_std' ? 'n/a (' + N + ' img)' : naText(key);
          else txt = fmt(v * e);
          col = colorFor(key);
        }
        el.textContent = txt; el.style.color = col;
      });
      const so = valEl.status;
      if (st.status) {
        const v = verdict();
        so.textContent = v; so.style.color = v === 'PASS' ? '#1D8348' : (v === 'FAIL' ? '#C0392B' : '#E67E22');
      } else { so.textContent = '--'; so.style.color = PRIMARY; }
      prov.textContent = st.prov ? SCALE_TXT + '\nEngine: pylinac x' + N + '   Angles: tags' : 'Scale: --';
    }
    function paintChart() {
      if (!st.chart) { if (st.built !== 'empty') { buildAxesEmpty(); st.built = 'empty'; } return; }
      if (st.built !== true) buildChart();
      paintBars();
    }
    function paintAll() {
      if (destroyed) return;
      paintTable(); paintChart(); paintStats(); paintSel();
    }

    // ---------------- player ----------------
    const wait = (ms, token) => DM.anim.wait(ms, token);
    const steps = [
      { name: 'rows', async run(token) {
        for (let i = 0; i < N; i++) { st.rows = i + 1; paintAll(); await wait(190, token); }
      } },
      { name: 'bars', async run(token) {
        st.chart = true; st.bars = 0; paintAll();
        await DM.anim.tween(2000, (t) => { st.bars = t * N; paintAll(); }, token);
        st.bars = N; paintAll();
        await wait(250, token);
      } },
      { name: 'stats', async run(token) {
        st.prov = true; st.stat = 1e-6; paintAll();
        await DM.anim.tween(1400, (t) => { st.stat = Math.max(1e-6, t); paintAll(); }, token);
        st.stat = 1; paintAll();
        await wait(250, token);
      } },
      { name: 'verdict', async run(token) {
        st.status = true; paintAll();
        await wait(700, token);
      } },
    ];
    function setFor(k) {
      st.rows = k >= 0 ? N : 0;
      st.chart = k >= 1; st.bars = k >= 1 ? N : 0;
      st.stat = k >= 2 ? 1 : 0; st.prov = k >= 2;
      st.status = k >= 3;
    }
    player = new DM.Player({
      steps,
      render(k) { if (destroyed) return; setFor(k); paintAll(); },
      onChange() {},
    });

    tolIn.addEventListener('input', () => {
      const v = parseFloat(tolIn.value);
      if (!isFinite(v)) return;
      st.tol = v;
      paintStats();
    });

    setFor(-1);
    paintAll();

    return {
      player: { toggle: runClick, next: () => !vstar && player.next(), prev: () => !vstar && player.prev(), get state() { return Object.assign({ count: steps.length }, player.state); }, },   // Space = the RUN button
      get ready() { return readyFlag; },
      destroy() {
        destroyed = true;
        if (vstar) { vstar.destroy(); vstar = null; }
        player.destroy();
        timers.forEach(clearTimeout);
        root_.remove();
      },
    };
  }

  DM.windows.wl = { title: 'DOSICARE Winston-Lutz Analysis Platform', width: W, height: H, theme: 'light', mount };
})(typeof window !== 'undefined' ? window : globalThis);
