/* DosiMachine replica - Picket Fence window ("DOSICARE | Picket Fence Precision Analysis", dark theme).
   Layout follows the original maximized window (client area of the original capture, 1707 x 996);
   positions below are written in capture y and shifted by OFF (the 23 px title bar).
   RUN ANALYSIS plays 4 steps: picket lines on the image, Position Plot (top to bottom), leaf-error bars
   (one after another), SUMMARY numbers and OVERALL RESULTS.
   All numbers are the baked results of the real run (DM_DATA.pf); changing Tolerance regrades them
   with DM.grade.pf. Tk 96 DPI: 9pt = 12px, 10pt = 13.33px; matplotlib 100 dpi: 1pt = 1.389px. */
(function (root) {
  const DM = root.DM = root.DM || {};
  DM.windows = DM.windows || {};

  const W = 1707, H = 996, OFF = 23;
  const PRIMARY = '#2E86C1', SUCCESS = '#28B463', DANGER = '#CB4335';
  const MPL = '"DejaVu Sans", Verdana, "Segoe UI", sans-serif';
  const MONO = '"DejaVu Sans Mono", Consolas, "Courier New", monospace';
  const NS = 'http://www.w3.org/2000/svg';
  const PT = 100 / 72;
  const SUM_BOTTOM = 945;                      // bottom of the summary frame (PDF button is packed below it)

  const ROW_DEFS = [
    ['OVERALL RESULTS', true], ['Total Junctions Analyzed', false], ['Number of Leaf Pairs', false],
    ['Leaves Not Measured', true], ['Position Tolerance (mm)', false], ['Junctions Passing (%)', true],
    ['Leaf Pairs Passing (%)', true], ['FWHM Pass Rate (%)', false], ['Abs. Maximum Deviation (mm)', true],
    ['95th Percentile Error (mm)', true], ['RMS Error (mm)', false], ['Average Picket Tilt (deg)', false],
    ['Max. Deviation Location [J L]', true], ['Median Deviation (mm)', false], ['Std. Deviation (mm)', false],
    ['Pickets Found', false],
  ];

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
  const pyFloat = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));      // Python's str(float)

  // matplotlib MaxNLocator(nbins, steps 1/2/2.5/5/10), ticks inside [lo, hi] only
  function mplTicks(lo, hi, nbins) {
    const raw = (hi - lo) / nbins;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= raw - 1e-12);
    let dec = 0;
    while (Math.abs(Math.round(step * Math.pow(10, dec)) / Math.pow(10, dec) - step) > 1e-9 && dec < 6) dec += 1;
    const out = [];
    for (let k = Math.ceil(lo / step - 1e-9); k * step <= hi + 1e-9; k++) out.push(k * step);
    return { ticks: out, dec };
  }

  function mount(body) {
    const data = root.DM_DATA.pf;
    const S = data.summary;
    const root_ = h('div', null, null, 'pf-root');
    body.appendChild(root_);
    let destroyed = false;
    const toast = () => DM.shell.toast('데모에서는 동작하지 않습니다');

    // ---------------- numbers ----------------
    const errors = data.errors;
    const nP = errors.length, nL = errors[0].length;
    const SC = data.image.scale;                       // PNG px per original px
    const OW = data.image.w / SC, OH = data.image.h / SC;      // original image size in px (axes units)
    const st = { lines: 0, pos: -1, bars: -1, sum: 0, tol: data.tolerance };

    function calc(tol) {
      const g = DM.grade.pf(errors, tol);
      let n = 0, leafN = 0, leafPass = 0;
      const leafMax = [];
      for (let l = 0; l < nL; l++) {
        let mx = 0, any = false;
        for (let p = 0; p < nP; p++) {
          const e = errors[p][l];
          if (e === null || e === undefined) continue;
          any = true; n += 1;
          if (Math.abs(e) > mx) mx = Math.abs(e);
        }
        leafMax.push(mx);
        if (any) { leafN += 1; if (mx <= tol) leafPass += 1; }
      }
      const leafPct = S.leaves_in_view > 0 ? leafPass / S.leaves_in_view * 100 : 0;
      let status = g.status;
      if (status === 'PASS' && S.leaves_not_measured > 0) status = 'FAIL';
      const fails = [];
      if (S.leaves_not_measured) fails.push(S.leaves_not_measured + ' of ' + S.leaves_in_view + ' leaf pairs in view were not measured');
      if (g.passing_pct < 99.9) fails.push(g.passing_pct.toFixed(2) + '% of junctions within ' + tol.toFixed(2) + ' mm');
      const base = status === 'PASS' ? 'all ' + n + ' junctions within ' + tol.toFixed(2) + ' mm' : fails.join('; ');
      const cut = S.verdict_reason.indexOf(' | ');
      const reason = base + (cut >= 0 ? S.verdict_reason.slice(cut) : '');
      return { g, n, leafMax, leafPct, status, reason };
    }

    // ---------------- window background, header ----------------
    root_.appendChild(h('div', abs(0, 23, W, 70, 'background:#17202A;')));
    root_.appendChild(h('div', abs(33, 36, null, 46, 'font:700 34.67px "Segoe UI",sans-serif;line-height:46px;color:' + PRIMARY + ';white-space:nowrap;'), 'DOSICARE'));
    root_.appendChild(h('div', abs(240, 46, null, 32, 'font:24px "Segoe UI",sans-serif;line-height:32px;color:#D5DBDB;white-space:nowrap;'), 'PICKET FENCE ANALYTICS'));
    root_.appendChild(h('div', 'position:absolute;top:' + (48 - OFF) + 'px;height:20px;right:' + (W - 1505) + 'px;font:13.33px "Segoe UI",sans-serif;line-height:20px;color:#D5DBDB;white-space:nowrap;', 'FILE: sample'));
    root_.appendChild(h('div', abs(0, 93, W, 926, 'background:#1C2833;')));

    const press = (b, base, active) => {
      b.addEventListener('pointerdown', () => { b.style.background = active; });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, () => { b.style.background = base; }));
    };
    const mkBtn = (txt, base, active, x, y, w, hh, size, fn) => {
      const b = h('div', abs(x, y, w, hh, 'background:' + base + ';color:#fff;font:700 ' + size + 'px "Segoe UI",sans-serif;display:flex;align-items:center;justify-content:center;cursor:pointer;white-space:nowrap;'), txt);
      press(b, base, active);
      b.addEventListener('click', fn);
      root_.appendChild(b);
      return b;
    };
    mkBtn('LOAD IMAGE...', '#117A65', '#0E6251', 1535, 37, 142, 40, 14.67, toast);

    // ---------------- left panel ----------------
    root_.appendChild(h('div', abs(10, 101, 350, 909, 'background:#F8F9F9;')));
    const lab = (t, x, cy, size, color, css) => root_.appendChild(h('div', abs(x, cy - 12, null, 24, 'font:' + size + 'px "Segoe UI",sans-serif;line-height:24px;white-space:nowrap;color:' + color + ';' + (css || '')), t));
    lab('ANALYSIS CONTROL', 33, 128, '700 17.33', '#2C3E50');
    lab('Tolerance (mm):', 38, 160, '13.33', '#000');
    const tolIn = h('input', abs(35, 173, 300, 26, 'font:16px "Segoe UI",sans-serif;'), null, 'pf-entry');
    tolIn.type = 'text'; tolIn.value = pyFloat(data.tolerance); tolIn.spellcheck = false;
    tolIn.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') tolIn.blur(); });
    root_.appendChild(tolIn);
    lab('MLC Model (used only if absent from DICOM):', 38, 215, '12', '#000');
    const combo = h('div', abs(35, 227, 300, 27, 'background:#DCDAD5;border:1px solid #ADADAD;cursor:default;'));
    combo.appendChild(h('div', 'position:absolute;left:3px;top:0;line-height:25px;font:14.67px "Segoe UI",sans-serif;color:#000;white-space:nowrap;', 'Millennium 120'));
    const cbtn = h('div', 'position:absolute;right:0;top:0;width:15px;height:25px;border-left:1px solid #ADADAD;background:#DCDAD5;');
    cbtn.appendChild(h('div', 'position:absolute;left:3px;top:11px;width:0;height:0;border-left:4.5px solid transparent;border-right:4.5px solid transparent;border-top:4px solid #000;'));
    combo.appendChild(cbtn);
    combo.addEventListener('click', toast);
    root_.appendChild(combo);
    const chk = h('div', abs(40, 267, 13, 13, 'background:#fff;border:1px solid #333;display:flex;align-items:center;justify-content:center;cursor:default;font:700 12px "Segoe UI Symbol",sans-serif;line-height:11px;'), '✓');
    let chkOn = true;
    chk.addEventListener('click', () => { chkOn = !chkOn; chk.textContent = chkOn ? '✓' : ''; });
    root_.appendChild(chk);
    lab('DOSICARE Advanced Engine', 58, 273, '13.33', '#000');
    let player = null;
    const runClick = async () => {
      if (!player || destroyed) return;
      if (player.state.playing) { player.pause(); return; }
      if (player.index >= player.steps.length - 1) await player.reset();
      player.play();
    };
    mkBtn('RUN ANALYSIS', PRIMARY, '#2471A3', 35, 300, 300, 47, 16, runClick);
    mkBtn('GENERATE PDF REPORT', '#117864', '#0E6251', 35, 950, 300, 49, 14.67, toast);
    lab('SUMMARY', 10, 378, '700 17.33', PRIMARY, 'width:350px;text-align:center;');

    const provEl = h('div', abs(30, 399, 300, null, 'font:12px "Segoe UI",sans-serif;line-height:15px;padding:1px 0;min-height:17px;color:#7B241C;white-space:pre-wrap;overflow-wrap:anywhere;'));
    const reasonEl = h('div', abs(30, 438, 300, null, 'font:12px "Segoe UI",sans-serif;line-height:15px;padding:1px 0;min-height:17px;color:#2C3E50;white-space:pre-wrap;overflow-wrap:anywhere;'));
    root_.append(provEl, reasonEl);
    const rowsClip = h('div', abs(10, 475, 350, SUM_BOTTOM - 475, 'overflow:hidden;'));
    root_.appendChild(rowsClip);
    const ROWH = 28.47;
    const rows = ROW_DEFS.map(([name, bold], i) => {
      const top = 7 + i * ROWH;
      const l = h('div', 'position:absolute;left:21px;top:' + top + 'px;height:20px;line-height:20px;white-space:nowrap;color:#333;font:' + (bold ? '700 14.67' : '13.33') + 'px "Segoe UI",sans-serif;', name + ':');
      const v = h('div', 'position:absolute;right:23px;top:' + (top - 1) + 'px;height:22px;line-height:22px;white-space:pre;font:700 ' + (bold ? '16' : '14.67') + 'px "Segoe UI",sans-serif;', '--');
      rowsClip.append(l, v);
      return { name, bold, v };
    });
    // Tk packs the labels one under the other: the reason label grows, the rows move down (and the last ones are cut off)
    function layout() {
      const pTop = 399, pH = provEl.offsetHeight;
      const rTop = pTop + pH + 7;
      reasonEl.style.top = (rTop - OFF) + 'px';
      const r0 = rTop + reasonEl.offsetHeight + 5;
      rowsClip.style.top = (r0 - OFF) + 'px';
      rowsClip.style.height = Math.max(0, SUM_BOTTOM - r0) + 'px';
    }

    // ---------------- notebook ----------------
    root_.appendChild(h('div', abs(370, 101, 1327, 909, 'background:#DCDAD5;border:1px solid #9E9A91;')));
    const tab = (txt, x, y, w, hh, bg, sel) => {
      const t = h('div', abs(x, y, w, hh, 'background:' + bg + ';border:1px solid #9E9A91;border-bottom:0;' + (sel ? 'border-top-color:#737472;' : '') + 'font:12px "Segoe UI",sans-serif;display:flex;align-items:center;justify-content:center;white-space:pre;color:#000;cursor:default;box-sizing:border-box;'), txt);
      if (!sel) t.addEventListener('click', toast);
      root_.appendChild(t);
    };
    tab(' Detailed Leaf Data ', 473, 102, 117, 26, '#BAB5AB', false);
    tab(' Advanced Metrics ', 592, 102, 116, 26, '#BAB5AB', false);
    tab(' Visual Analysis ', 371, 101, 101, 28, '#DCDAD5', true);
    root_.appendChild(h('div', abs(372, 128, 1323, 879, 'background:#fff;border-top:1px solid #F2F2F0;')));
    root_.appendChild(h('div', abs(372, 129, 1323, 548, 'background:#FDFEFE;')));
    root_.appendChild(h('div', abs(372, 687, 1323, 320, 'background:#FDFEFE;border:1px solid #000;')));

    // ---------------- figure 1: image + Position Plot ----------------
    const svgA = sv('svg', { width: 1323, height: 548, viewBox: '372 129 1323 548', style: 'position:absolute;left:372px;top:' + (129 - OFF) + 'px;display:block;font-family:' + MPL + ';' });
    root_.appendChild(svgA);
    const rnd = Math.floor(Math.random() * 1e9);
    const defsA = sv('defs');
    svgA.appendChild(defsA);

    // image axes (aspect equal, height set by the Position Plot row: tight_layout)
    const AT = 206, AH = 420.6, AB = AT + AH;
    const YLIM1 = OH + 0.05 * (OH + 0.5);                // autoscale margin of the picket lines drawn down to y = OH
    const KK = AH / (YLIM1 + 0.5);
    const IWd = OW * KK;
    const AXL0 = 726.5 - IWd / 2;
    const XI = (x) => AXL0 + (x + 0.5) * KK, YI = (y) => AT + (y + 0.5) * KK;
    const gImg = sv('g');
    svgA.appendChild(gImg);
    gImg.appendChild(sv('rect', { x: AXL0, y: AT, width: IWd, height: AH, fill: '#fff' }));
    const imgEl = sv('image', { x: AXL0, y: AT, width: IWd, height: OH * KK, preserveAspectRatio: 'none' });
    imgEl.setAttribute('href', 'data/' + data.image.file);
    gImg.appendChild(imgEl);
    let readyFlag = false;
    const pre = new Image();
    pre.onload = () => { readyFlag = true; }; pre.onerror = () => { readyFlag = true; };
    pre.src = 'data/' + data.image.file;
    const clipA = 'pfclipA' + rnd;
    const cpA = sv('clipPath', { id: clipA });
    cpA.appendChild(sv('rect', { x: AXL0, y: AT, width: IWd, height: AH }));
    defsA.appendChild(cpA);
    const gLines = sv('g', { 'clip-path': 'url(#' + clipA + ')' });
    gImg.appendChild(gLines);
    const lineEls = data.fits.map(([a, b]) => {
      const e = sv('line', { stroke: '#FF0000', 'stroke-opacity': 0.5, 'stroke-width': 0.8 * PT, 'stroke-dasharray': (3.7 * 0.8 * PT) + ' ' + (1.6 * 0.8 * PT), visibility: 'hidden' });
      gLines.appendChild(e);
      const x0 = b / SC;                                  // x_orig = a * y_orig + b / scale
      return { e, a, x0 };
    });
    const axisFrame = (x0, y0, x1, y1, sw, color) => sv('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, fill: 'none', stroke: color || '#000', 'stroke-width': sw });
    const tickLen = 3.5 * PT;
    const xT = mplTicks(-0.5, OW - 0.5, 9), yT = mplTicks(-0.5, YLIM1, 9);
    xT.ticks.forEach((v) => {
      const x = XI(v);
      gImg.append(sv('line', { x1: x, x2: x, y1: AB, y2: AB + tickLen, stroke: '#000', 'stroke-width': 0.8 * PT }),
        sv('text', { x: x, y: AB + tickLen + tickLen + 10, 'text-anchor': 'middle', 'font-size': 10 * PT }, v.toFixed(xT.dec)));
    });
    yT.ticks.forEach((v) => {
      const y = YI(v);
      gImg.append(sv('line', { x1: AXL0 - tickLen, x2: AXL0, y1: y, y2: y, stroke: '#000', 'stroke-width': 0.8 * PT }),
        sv('text', { x: AXL0 - tickLen - tickLen, y: y + 4.8, 'text-anchor': 'end', 'font-size': 10 * PT }, v.toFixed(yT.dec)));
    });
    gImg.appendChild(axisFrame(AXL0, AT, AXL0 + IWd, AB, 0.8 * PT));
    const titleL = sv('text', { x: 726.5, y: AT - 8.3, 'text-anchor': 'middle', 'font-size': 12 * PT, visibility: 'hidden' }, 'DOSICARE Precision: Detected Pickets');
    gImg.appendChild(titleL);

    // Position Plot axes
    const PL = 1102, PR = 1675, PW = (PR - PL) / nP, PLH = AH / nL;
    const gPos = sv('g', { visibility: 'hidden' });
    svgA.appendChild(gPos);
    gPos.appendChild(sv('rect', { x: PL, y: AT, width: PR - PL, height: AH, fill: '#FDFDFD' }));
    for (let l = 0; l < nL; l++) {
      const y = AT + l * PLH;
      if (l % 2 === 0) {
        gPos.append(sv('line', { x1: PL - tickLen, x2: PL, y1: y, y2: y, stroke: '#000', 'stroke-width': 0.5 * PT }),
          sv('text', { x: PL - tickLen - tickLen + 0.4, y: y + 3.9, 'text-anchor': 'end', 'font-size': 8 * PT }, String(l + 1)));
      } else {
        gPos.appendChild(sv('line', { x1: PL - 2 * PT, x2: PL, y1: y, y2: y, stroke: '#CCCCCC', 'stroke-width': 0.6 * PT }));
      }
    }
    for (let p = 0; p < nP; p++) {
      const x = PL + (p + 0.5) * PW;
      gPos.appendChild(sv('line', { x1: x, x2: x, y1: AT, y2: AB, stroke: '#000', 'stroke-opacity': 0.9, 'stroke-width': 0.6 * PT }));
      [['-2', -0.35], ['0', 0], ['2', 0.35]].forEach(([t, d]) => gPos.appendChild(sv('text', { x: x + d * PW, y: AT + (nL + 3) * PLH, 'text-anchor': 'middle', 'font-size': 5 * PT, fill: '#666666' }, t)));
    }
    const gMarks = sv('g');
    const clipP = 'pfclipP' + rnd;
    const cpP = sv('clipPath', { id: clipP });
    const clipPRect = sv('rect', { x: PL - 40, y: AT - 2, width: PR - PL + 80, height: 0 });
    cpP.appendChild(clipPRect);
    defsA.appendChild(cpP);
    gMarks.setAttribute('clip-path', 'url(#' + clipP + ')');
    gPos.appendChild(gMarks);
    gPos.appendChild(axisFrame(PL, AT, PR, AB, 0.5 * PT, '#333333'));
    gPos.append(
      sv('text', { transform: 'translate(1068.5,' + (AT + AH / 2) + ') rotate(-90)', 'text-anchor': 'middle', 'font-size': 10 * PT, 'font-weight': 700 }, 'Leaf Pair'),
      sv('text', { x: (PL + PR) / 2, y: AT - 3.5 * PT * 3 + 0.3, 'text-anchor': 'middle', 'font-size': 12 * PT, 'font-weight': 700 }, 'Position Plot'));
    const xlabP = sv('text', { x: (PL + PR) / 2, y: AB + 29.5, 'text-anchor': 'middle', 'font-size': 10 * PT }, '');
    gPos.appendChild(xlabP);

    // ---------------- figure 2: Individual Leaf Errors ----------------
    const svgB = sv('svg', { width: 1321, height: 318, viewBox: '373 688 1321 318', style: 'position:absolute;left:373px;top:' + (688 - OFF) + 'px;display:block;font-family:' + MPL + ';' });
    root_.appendChild(svgB);
    const BL = 448, BR = 1677, BT = 722, BB = 953, BH = BB - BT;
    const gBar = sv('g', { visibility: 'hidden' });
    svgB.appendChild(gBar);
    const gBarDyn = sv('g');
    svgB.appendChild(gBarDyn);

    // ---------------- painting ----------------
    function paintLines() {
      titleL.setAttribute('visibility', st.lines > 0 ? 'visible' : 'hidden');
      lineEls.forEach((o, i) => {
        const f = clamp01((st.lines - i / nP * 0.5) / 0.5);
        o.e.setAttribute('visibility', f > 0 ? 'visible' : 'hidden');
        if (f <= 0) return;
        const y1 = OH * DM.anim.ease(f);
        o.e.setAttribute('x1', XI(o.x0)); o.e.setAttribute('y1', YI(0));
        o.e.setAttribute('x2', XI(o.a * y1 + o.x0)); o.e.setAttribute('y2', YI(y1));
      });
    }
    function paintPosFrame() {
      gPos.setAttribute('visibility', st.pos >= 0 ? 'visible' : 'hidden');
      xlabP.textContent = 'Position Delta (mm): Tolerance +/- ' + pyFloat(st.tol) + ' mm';
    }
    function paintMarks() {
      gMarks.textContent = '';
      clipPRect.setAttribute('height', Math.max(0, st.pos) * (AH + 4));
      if (st.pos <= 0) return;
      const tol = st.tol;
      errors.forEach((row, p) => row.forEach((e, l) => {
        if (e === null || e === undefined) return;
        const x = PL + (p + 0.5) * PW + e / 6 * PW;
        gMarks.appendChild(sv('line', { x1: x, x2: x, y1: AT + (l + 0.1) * PLH, y2: AT + (l + 0.9) * PLH, stroke: Math.abs(e) <= tol ? '#00FF00' : '#FF0000', 'stroke-width': 2 * PT }));
      }));
    }
    function paintBars() {
      gBar.setAttribute('visibility', st.bars >= 0 ? 'visible' : 'hidden');
      gBar.textContent = ''; gBarDyn.textContent = '';
      if (st.bars < 0) return;
      const c = calc(st.tol), tol = st.tol, mx = Math.max.apply(null, c.leafMax);
      const ymax = Math.max(mx * 1.4, tol * 1.6);
      const X = (v) => BL + v / (nL + 1) * (BR - BL), Y = (v) => BB - v / ymax * BH;
      gBar.appendChild(sv('rect', { x: BL, y: BT, width: BR - BL, height: BH, fill: '#fff' }));
      const yt = mplTicks(0, ymax, Math.max(1, Math.min(9, Math.floor(BH / PT / 20))));
      yt.ticks.forEach((v) => {
        const y = Y(v);
        gBar.append(sv('line', { x1: BL, x2: BR, y1: y, y2: y, stroke: '#b0b0b0', 'stroke-opacity': 0.6, 'stroke-width': 0.8 * PT, 'stroke-dasharray': (3.7 * 0.8 * PT) + ' ' + (1.6 * 0.8 * PT) }),
          sv('line', { x1: BL - tickLen, x2: BL, y1: y, y2: y, stroke: '#000', 'stroke-width': 0.8 * PT }),
          sv('text', { x: BL - 2 * tickLen, y: y + 4.8, 'text-anchor': 'end', 'font-size': 10 * PT }, v.toFixed(yt.dec)));
      });
      for (let v = 0; v <= nL; v += 2) {
        const x = X(v);
        gBar.append(sv('line', { x1: x, x2: x, y1: BB, y2: BB + tickLen, stroke: '#000', 'stroke-width': 0.8 * PT }),
          sv('text', { x: x, y: BB + 2 * tickLen + 11, 'text-anchor': 'middle', 'font-size': 10 * PT }, String(v)));
      }
      // bars grow one after another (left to right)
      c.leafMax.forEach((val, i) => {
        if (!(val > 0) || (!errors.some((r) => r[i] !== null && r[i] !== undefined))) return;
        const f = st.bars >= 1 ? 1 : DM.anim.ease(clamp01(st.bars * 1.6 - (i / nL) * 0.6));
        if (f <= 0) return;
        const hh = Math.max(0, BB - Y(val)) * f;
        gBar.appendChild(sv('rect', { x: X(i + 1 - 0.4), y: BB - hh, width: 0.8 / (nL + 1) * (BR - BL), height: hh, fill: val <= tol ? '#85C1E9' : '#CB4335' }));
      });
      const ty = Y(tol);
      gBar.appendChild(sv('line', { x1: BL, x2: BR, y1: ty, y2: ty, stroke: '#28B463', 'stroke-width': 1 * PT, 'stroke-dasharray': (3.7 * PT) + ' ' + (1.6 * PT) }));
      if (st.bars >= 1) {
        c.leafMax.forEach((val, i) => {
          if (!(val > tol * 0.5)) return;
          const over = val > tol;
          gBar.appendChild(sv('text', { x: X(i + 1), y: Y(val + ymax * 0.01) - 2.5, 'text-anchor': 'middle', 'font-size': (over ? 9 : 8) * PT, 'font-weight': over ? 700 : 400, fill: over ? '#CB4335' : '#5D6D7E' }, val.toFixed(2)));
        });
      }
      gBar.append(sv('rect', { x: BL, y: BT, width: BR - BL, height: BH, fill: 'none', stroke: '#000', 'stroke-width': 0.8 * PT }),
        sv('text', { x: (BL + BR) / 2, y: BT - 8.3, 'text-anchor': 'middle', 'font-size': 13 * PT, 'font-weight': 700 }, 'Individual Leaf Errors (sample)'),
        sv('text', { transform: 'translate(406,' + ((BT + BB) / 2 + 5) + ') rotate(-90)', 'text-anchor': 'middle', 'font-size': 11 * PT }, 'Error (mm)'),
        sv('text', { x: (BL + BR) / 2, y: 992, 'text-anchor': 'middle', 'font-size': 11 * PT }, 'Leaf Number'));
      // legend (upper right) and info box (upper left)
      const ltxt = 'Tol: ' + pyFloat(tol) + ' mm', lw = 5.6 + 27.8 + 11.1 + ltxt.length * 7.75 + 5.6, lx = BR - 6.9 - lw, ly = BT + 6.9;
      gBar.append(sv('rect', { x: lx, y: ly, width: lw, height: 24, rx: 3, fill: '#fff', 'fill-opacity': 0.8, stroke: '#CCCCCC', 'stroke-width': 1.1 }),
        sv('line', { x1: lx + 5.6, x2: lx + 5.6 + 27.8, y1: ly + 12, y2: ly + 12, stroke: '#28B463', 'stroke-width': 1 * PT, 'stroke-dasharray': (3.7 * PT) + ' ' + (1.6 * PT) }),
        sv('text', { x: lx + 5.6 + 27.8 + 11.1, y: ly + 17, 'font-size': 10 * PT }, ltxt));
      if (st.bars >= 1) {
        const lines = ['Junction Pass Rate: ' + c.g.passing_pct.toFixed(1) + '%', 'Leaf Pair Pass Rate: ' + c.leafPct.toFixed(1) + '%', 'Max Error: ' + c.g.max_abs.toFixed(3) + ' mm'];
        const cw = 0.602 * 11 * PT, bw = Math.max.apply(null, lines.map((s) => s.length)) * cw + 9.2, ix = BL + 0.02 * (BR - BL) - 4.6, iy = BT + 0.04 * BH - 4.6;
        gBar.appendChild(sv('rect', { x: ix, y: iy, width: bw, height: 59.5, rx: 4.6, fill: '#fff', 'fill-opacity': 0.9, stroke: '#CCCCCC', 'stroke-width': 1.1 }));
        lines.forEach((s, k) => gBar.appendChild(sv('text', { x: ix + 4.6, y: iy + 4.6 + 11.5 + 17.8 * k, 'font-size': 11 * PT, 'font-weight': 700, 'font-family': MONO, textLength: s.length * cw, lengthAdjust: 'spacing' }, s)));
      }
    }
    function fmtRow(i, c) {
      switch (i) {
        case 0: return c.status;
        case 1: return String(c.n);
        case 2: return S.leaves_in_view + ' in view / ' + S.leaf_pairs;
        case 3: return String(S.leaves_not_measured);
        case 4: return st.tol.toFixed(2);
        case 5: return c.g.passing_pct.toFixed(2) + '%';
        case 6: return c.leafPct.toFixed(2) + '%';
        case 7: return S.fwhm_pass_pct.toFixed(2) + '%';
        case 8: return c.g.max_abs.toFixed(3);
        case 9: return S.p95.toFixed(3);
        case 10: return S.rms.toFixed(3);
        case 11: return S.tilt_deg.toFixed(3) + '°';
        case 12: return S.max_loc;
        case 13: return S.median.toFixed(3);
        case 14: return S.std.toFixed(3);
        default: return String(S.pickets);
      }
    }
    // reveal order: the rows top to bottom, OVERALL RESULTS last
    const revealed = (i) => (i === 0 ? st.sum >= 16 : st.sum >= i);
    function paintSummary() {
      const c = calc(st.tol);
      const on = st.sum > 0;
      provEl.textContent = on ? 'Scale: ' + S.pixel_spacing_text + '\nMLC:   ' + S.mlc_text : '';
      reasonEl.textContent = on ? c.reason : '';
      layout();
      rows.forEach((r, i) => {
        const vis = revealed(i);
        r.v.textContent = vis ? fmtRow(i, c) : '--';
        let color = r.bold ? PRIMARY : '#1A5276';
        if (vis && i === 0) color = c.status === 'PASS' ? SUCCESS : DANGER;
        if (vis && i === 3) color = S.leaves_not_measured ? DANGER : SUCCESS;
        r.v.style.color = color;
      });
    }
    function paintAll() {
      if (destroyed) return;
      paintLines(); paintPosFrame(); paintMarks(); paintBars(); paintSummary();
    }

    // ---------------- tolerance ----------------
    tolIn.addEventListener('input', () => {
      const v = parseFloat(tolIn.value);
      if (!isFinite(v)) return;
      st.tol = v;
      paintAll();
    });

    // ---------------- player ----------------
    const wait = (ms, token) => DM.anim.wait(ms, token);
    const steps = [
      { name: 'lines', async run(token) {
        st.lines = 1e-6; paintAll();
        await DM.anim.tween(2400, (t) => { st.lines = Math.max(1e-6, t); paintLines(); }, token);
        st.lines = 1; paintAll();
        await wait(300, token);
      } },
      { name: 'positions', async run(token) {
        st.pos = 1e-6; paintAll();
        await wait(250, token);
        await DM.anim.tween(2600, (t) => { st.pos = Math.max(1e-6, t); clipPRect.setAttribute('height', st.pos * (AH + 4)); }, token);
        st.pos = 1; paintAll();
        await wait(300, token);
      } },
      { name: 'bars', async run(token) {
        st.bars = 1e-6; paintAll();
        await DM.anim.tween(2600, (t) => { st.bars = Math.max(1e-6, Math.min(t, 0.999999)); paintBars(); }, token);
        st.bars = 1; paintAll();
        await wait(300, token);
      } },
      { name: 'summary', async run(token) {
        for (let i = 1; i <= 16; i++) { st.sum = i; paintAll(); await wait(i === 16 ? 250 : 110, token); }
        st.sum = 16; paintAll();
        await wait(700, token);
      } },
    ];
    function setFor(k) {
      st.lines = k >= 0 ? 1 : 0;
      st.pos = k >= 1 ? 1 : -1;
      st.bars = k >= 2 ? 1 : -1;
      st.sum = k >= 3 ? 16 : 0;
    }
    player = new DM.Player({
      steps,
      render(k) { if (destroyed) return; setFor(k); paintAll(); },
    });

    setFor(-1);
    paintAll();

    return {
      player: { toggle: runClick, next: () => player.next(), prev: () => player.prev(), get state() { return Object.assign({ count: steps.length }, player.state); }, },   // Space = the RUN button
      get ready() { return readyFlag; },
      destroy() {
        destroyed = true;
        player.destroy();
        root_.remove();
      },
    };
  }

  DM.windows.pf = { title: 'DOSICARE | Picket Fence Precision Analysis', width: W, height: H, theme: 'dark', mount };
})(typeof window !== 'undefined' ? window : globalThis);
