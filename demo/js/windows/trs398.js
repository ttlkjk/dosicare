/* DosiMachine replica - Photon_Calibration(TRS-398) Calibration window (light theme).
   Replica of Calibration_TRS398.py (create_widgets 226-548, calculate 615-1031). The original is a scrollable Tk form
   (canvas + scrollbar) on a window of min(1500, screen height - 100) px; the reference capture was taken at 150 % DPI,
   so every length below is in CAPTURE pixels (Arial 11 pt = 22 px, Consolas 12 pt = 24 px) and the form scrolls inside
   the window like the original. Positions are written in capture coordinates and shifted by OFF (the title bar).
   Calculate (button or Space) prints the original's results text line by line using DM.trs398 (Rev.1 only).
   Differences from the original: k_Q Table is fixed to Rev.1 (the original default is V.12), the Override boxes and
   Unit/Humidity/Nominal Accel are shape only, Save PDF is inactive, errors are printed in the results box. */
(function (root) {
  const DM = root.DM = root.DM || {};
  DM.windows = DM.windows || {};

  const W = 1250, H = 1000, OFF = 45, FORM_W = 1233, BOTTOM = 1757;
  const BG = '#EBF5FB', TITLE = '#2E86C1', RED = '#C0392B';
  const FONT = 'Arial, "Liberation Sans", Helvetica, sans-serif';
  const REV1 = 'TRS-398 Rev.1 (2024)', V12 = 'TRS-398 V.12 (2006)';
  const CAVITY_LENGTH_CM = { 2571: 2.41, 30010: 2.30, 30012: 2.30, 30013: 2.30, CC13: 0.58, 'FC65-G': 2.30, 'FC65-P': 2.30 };
  const LINE_MS = 55;

  function h(tag, css, text, cls) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }
  const Y = (y) => y - OFF;
  let mctx = null;
  const textW = (t, font) => { if (!mctx) mctx = document.createElement('canvas').getContext('2d'); mctx.font = font; return mctx.measureText(t).width; };
  const LABEL_FONT = 'bold 22px Arial';

  // Python str(float) for the default boxes
  const num = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));

  // ---------------- the original's refusals and results text (pure; tested in node) ----------------
  class InputError extends Error {}
  const fmt = (v, d) => v.toFixed(d);
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const TPR_USUAL = { '6MV': [0.64, 0.70], '6FFF': [0.60, 0.70], '10MV': [0.70, 0.76], '10FFF': [0.68, 0.75], '15MV': [0.74, 0.79] };
  const g = (v) => String(v);                        // Python {:g} for the plain numbers used here

  // x: parsed inputs (DM.trs398.calculate shape, pdd/tmr null when unused); ctx: {calTempText, calPressText, savedDefaults}
  function buildLines(x, ctx) {
    const CH = (root.DM || {}).trs398;
    const { mRef, mOpp, mRed } = x;
    const bad = (m) => { throw new InputError(m); };
    const mRefAvg = mean(mRef);
    if (mRefAvg === 0) bad('기준 전압(Reference) 읽음값 평균이 0입니다.');
    const mOppAvg = mOpp.length ? mean(mOpp) : 0, mRedAvg = mRed.length ? mean(mRed) : 0;
    // pylinac's bounds (tg51.py): temperature 15-35 C, pressure 90-115 kPa, k_elec / k_pol 0.98-1.02, k_s 1-1.05
    if (!(x.temp >= 15 && x.temp <= 35)) bad('Temperature = ' + g(x.temp) + ' C는 15-35 C 범위 밖입니다 - 입력을 확인해 주세요.');
    if (!(x.press >= 90 && x.press <= 115)) bad('Pressure = ' + g(x.press) + ' kPa는 90-115 kPa 범위 밖입니다 - kPa 단위가 맞나요?');
    if (!(x.calTemp >= 15 && x.calTemp <= 30)) bad('Cal. Temp = ' + g(x.calTemp) + ' C는 15-30 C 범위 밖입니다 - 교정 성적서를 확인해 주세요.');
    if (!(x.calPress >= 90 && x.calPress <= 115)) bad('Cal. Press = ' + g(x.calPress) + '는 90-115 kPa 범위 밖입니다 - 교정 성적서를 확인해 주세요.');
    if (!(x.kelec >= 0.98 && x.kelec <= 1.02)) bad('K_elec = ' + g(x.kelec) + '는 0.98-1.02 범위 밖입니다 - 입력을 확인해 주세요.');
    if (!(x.ndw > 0)) bad('N_D,w는 0보다 커야 합니다.');
    if (!(x.vRed > 0 && x.vRed < x.vRef)) bad('Red Voltage (' + g(x.vRed) + ' V)는 0보다 크고 Ref Voltage (' + g(x.vRef) + ' V)보다 작아야 합니다.');
    if (mOpp.length) {
      const cPol = (Math.abs(mRefAvg) + Math.abs(mOppAvg)) / (2 * Math.abs(mRefAvg));
      if (!(cPol >= 0.98 && cPol <= 1.02)) bad('Opposite 읽음값에서 나온 k_pol = ' + fmt(cPol, 4) + '는 0.98-1.02 범위 밖입니다 - 읽음값을 확인해 주세요.');
    }
    let ratioM = null;
    if (mRed.length) {
      if (mRedAvg === 0) bad('낮은 전압(Reduced voltage) 읽음값 평균이 0입니다.');
      ratioM = Math.abs(mRefAvg) / Math.abs(mRedAvg);
      if (ratioM > 1.05) bad('Reference / Reduced voltage 읽음값 = ' + fmt(ratioM, 3) + '는 1.05를 넘습니다 - 읽음값을 확인해 주세요.');
    }
    if (!(x.mu > 0)) bad('MU는 0보다 커야 합니다.');
    if (!(x.target > 0)) bad('Target은 0보다 커야 합니다.');
    if (x.setup === 'SSD') {
      if (!(x.pdd >= 40 && x.pdd <= 100)) bad('PDD @ zref = ' + g(x.pdd) + ' %는 40-100 % 범위 밖입니다 - 입력을 확인해 주세요.');
    } else if (x.setup === 'SAD') {
      if (x.tmr !== null && !(x.tmr >= 0.4 && x.tmr <= 1.0)) bad('TMR @ zref = ' + g(x.tmr) + '는 0.4-1.0 범위 밖입니다 - 퍼센트가 아니라 비율로 넣어 주세요.');
    } else bad('Setup(SSD 또는 SAD)을 골라 주세요.');

    const r = CH.calculate(x);
    Object.keys(r).forEach((k) => {
      if (r[k] !== null && !Number.isFinite(r[k])) bad('계산 결과가 올바른 숫자가 아닙니다(' + k + '). 입력값을 확인해 주세요.');
    });

    let kvolLabel = null;
    if (/FFF/.test(x.energy)) {
      const length = CAVITY_LENGTH_CM[x.chamber];
      const sdd = x.setup === 'SSD' ? 100 + x.depth : 100;
      kvolLabel = fmt(r.k_vol, 4) + ' (generic, Eq. 22, L ' + fmt(length, 2) + ' cm, SDD ' + g(sdd) + ' cm)';
    }
    const L = [];
    const eq = '='.repeat(90);
    L.push(eq, '                      CALCULATION RESULTS SUMMARY', eq, '');
    L.push('--- Measurement Averages ---');
    L.push('  M_ref (avg):  ' + fmt(mRefAvg, 4) + ' nC  (from ' + mRef.length + ' measurements)');
    L.push(mOpp.length ? '  M_opp (avg):  ' + fmt(mOppAvg, 4) + ' nC  (from ' + mOpp.length + ' measurements)'
      : '  M_opp:        Not Provided (k_pol defaults to 1.0)');
    L.push(mRed.length ? '  M_red (avg):  ' + fmt(mRedAvg, 4) + ' nC  (from ' + mRed.length + ' measurements)'
      : '  M_red:        Not Provided (k_s defaults to 1.0)');
    L.push('');
    L.push('--- Correction Factors ---');
    L.push('  C_TP (Temp/Press):     ' + fmt(r.c_tp, 4) + ' (cert: ' + ctx.calTempText + ' C / ' + ctx.calPressText + ' kPa)');
    L.push('  C_pol (Polarity):      ' + fmt(r.c_pol, 4) + (!mOpp.length ? ' (Default)' : ''));
    L.push('  C_IR (Ion Recomb):     ' + fmt(r.c_ir, 4) + (!mRed.length ? ' (Default)' : ''));
    L.push('  K_elec:                ' + fmt(x.kelec, 4));
    L.push('  k_Q (Beam Quality):    ' + fmt(r.kq, 4) + ' (' + x.chamber + ', ' + REV1 + ' Eq. 34, Table 45)');
    L.push('  k_Q edition:           ' + REV1);
    if (kvolLabel) L.push('  k_vol (FFF):           ' + kvolLabel);
    L.push('  M_Q (Corrected):       ' + fmt(r.m_q, 4) + ' nC');
    L.push('');
    const sgn = (v) => (v < 0 || Object.is(v, -0) ? '-' : '+') + Math.abs(v).toFixed(2);
    const targetDose = x.mu * x.target * 0.01;
    L.push('--- Final Dose Calibration ---');
    L.push('  Dose/MU @ z_ref:  ' + fmt(r.dose_mu_zref, 5) + ' Gy/MU  (' + fmt(r.dose_mu_zref * 100, 3) + ' cGy/MU)');
    if (x.setup === 'SSD') {
      L.push('  Dose/MU @ z_max:  ' + fmt(r.dose_mu_zmax, 5) + ' Gy/MU  (' + fmt(r.dose_mu_zmax * 100, 3) + ' cGy/MU)');
      L.push('  Total Dose @ z_max (' + fmt(x.mu, 0) + ' MU):  ' + fmt(r.dose_mu_zmax * x.mu, 4) + ' Gy');
    } else {
      L.push('  Dose @ Isocenter (' + fmt(x.mu, 0) + ' MU):   ' + fmt(r.dose_mu_zref * x.mu, 4) + ' Gy');
      if (r.dose_mu_zmax !== null) {
        L.push('  Dose/MU @ z_max:  ' + fmt(r.dose_mu_zmax, 5) + ' Gy/MU  (' + fmt(r.dose_mu_zmax * 100, 3) + ' cGy/MU), from TMR ' + fmt(x.tmr, 4));
      } else {
        L.push('  Dose/MU @ z_max:  not computed - SAD setup needs TMR @ zref, not PDD');
        L.push('  Error vs Target:  not computed');
      }
    }
    if (r.error_pct !== null) L.push('  Error vs Target (' + fmt(targetDose, 4) + ' Gy):      ' + sgn(r.error_pct) + ' %');
    if (x.setup === 'SAD') L.push('  [Note: SAD calibration results are reported at Isocenter depth]');

    const notes = [];
    if (ctx.savedDefaults) notes.push("Temperature and pressure are the saved machine values - were today's entered?");
    if (notes.length) { L.push('', '--- Notes ---'); notes.forEach((n) => L.push('  ' + n)); }

    const checks = [];
    const [lo, hi] = TPR_USUAL[x.energy];
    if (!(lo <= x.tpr && x.tpr <= hi)) {
      let c = 'CHECK: TPR20,10 = ' + fmt(x.tpr, 3) + ' is outside the usual ' + fmt(lo, 2) + '-' + fmt(hi, 2) + ' for ' + x.energy + '.';
      if (x.tpr >= 0.5 && x.tpr <= 1.0) {
        const asPdd = 1.2661 * x.tpr - 0.0595;       // pylinac tpr2010_from_pdd2010
        if (lo <= asPdd && asPdd <= hi) c += ' If ' + fmt(x.tpr, 3) + ' is a PDD20,10, then TPR20,10 = ' + fmt(asPdd, 3) + '.';
      }
      checks.push(c);
    } else if (x.pdd !== null && x.depth === 10 && Math.abs(x.tpr - x.pdd / 100) > 0.03) {
      checks.push('CHECK: TPR20,10 = ' + fmt(x.tpr, 3) + ' does not go with PDD ' + fmt(x.pdd, 2) + ' %.');
    }
    if (x.depth !== 10) checks.push('CHECK: z_ref = ' + g(x.depth) + ' cm, but TRS-398 Rev.1 asks for 10 cm at every TPR20,10.');
    [['Reference', mRef], ['Opposite', mOpp], ['Reduced voltage', mRed]].forEach(([n, v]) => {
      if (v.length > 1 && Math.max.apply(null, v) - Math.min.apply(null, v) > 0.005 * Math.abs(mean(v))) {
        checks.push('CHECK: ' + n + ' readings differ by more than 0.5 % - typing error?');
      }
    });
    if (ratioM !== null && ratioM < 1.0) checks.push('CHECK: Reduced voltage readings are above the Reference readings - k_s 1.0 used.');
    if (!(0.004 <= r.dose_mu_zref && r.dose_mu_zref <= 0.015)) {
      checks.push('CHECK: ' + fmt(r.dose_mu_zref * 100, 3) + ' cGy/MU at z_ref is far from ~1 cGy/MU - is N_D,w in Gy/nC and the MU right?');
    }
    if (checks.length) { L.push(''); checks.forEach((c) => L.push('  ' + c)); }
    L.push('', eq);
    return L;
  }

  function mount(body) {
    const D = root.DM_DATA.trs398.cases[0].inputs;
    const CH = DM.trs398;
    const root_ = h('div', null, null, 't3-root');
    const form = h('div', 'position:absolute;left:0;top:0;width:' + FORM_W + 'px;height:' + Y(BOTTOM) + 'px;background:' + BG + ';');
    root_.appendChild(form);
    body.appendChild(root_);
    let destroyed = false, token = 0, timer = 0, lastToast = 0;
    let printing = false, paused = false, pending = null;
    const toast = (msg) => {
      const now = Date.now();
      if (now - lastToast < 1200) return;
      lastToast = now;
      DM.shell.toast(msg || '데모에서는 동작하지 않습니다');
    };

    // ---------------- building blocks ----------------
    const frame = (x1, x2, titleCy, bottom, title) => {
      form.appendChild(h('div', 'position:absolute;left:' + x1 + 'px;top:' + Y(titleCy + 2) + 'px;width:' + (x2 - x1) + 'px;height:' + (bottom - titleCy - 2) + 'px;border:1px solid #D0D7DE;box-sizing:border-box;'));
      form.appendChild(h('div', 'position:absolute;left:' + (x1 + 8) + 'px;top:' + Y(titleCy - 16) + 'px;height:32px;line-height:32px;padding:0 3px;background:' + BG + ';font:700 24px ' + FONT + ';color:' + TITLE + ';white-space:nowrap;', title));
    };
    const label = (t, x, cy, color) => form.appendChild(h('div', 'position:absolute;left:' + x + 'px;top:' + Y(cy - 14) + 'px;height:28px;line-height:28px;font:700 22px ' + FONT + ';white-space:nowrap;color:' + (color || '#000') + ';', t));
    const entry = (x, cy, w, val, opts) => {
      opts = opts || {};
      const hh = opts.h || 30;
      const e = h('input', 'left:' + x + 'px;top:' + Y(cy - hh / 2) + 'px;width:' + w + 'px;height:' + hh + 'px;' + (opts.center ? 'text-align:center;' : ''), null, 't3-entry');
      e.type = 'text'; e.value = val == null ? '' : val; e.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') e.blur(); });
       e.spellcheck = false; e.autocomplete = 'off';
      if (opts.override) {
        e.addEventListener('input', () => toast('데모에서는 Override 칸을 계산에 쓰지 않습니다'));
      }
      form.appendChild(e);
      return e;
    };
    // column of label + entry rows; entry x follows the widest label like Tk's grid (padx 10 + 10)
    const colX = (x, labels) => Math.round(x + Math.max.apply(null, labels.map((t) => textW(t, LABEL_FONT))) + 23);

    // simple readonly combobox with a popup list
    let popup = null;
    const closePopup = () => { if (popup) { popup.remove(); popup = null; } };
    const onDocDown = (ev) => { if (popup && !popup.contains(ev.target)) closePopup(); };
    document.addEventListener('pointerdown', onDocDown, true);
    const onEsc = (ev) => { if (ev.key === 'Escape' && popup) { closePopup(); ev.stopPropagation(); ev.preventDefault(); } };   // Esc closes an open dropdown first
    document.addEventListener('keydown', onEsc, true);
    const combo = (x, cy, w, items, value, onPick, hh) => {
      hh = hh || 30;
      const top = Y(cy - hh / 2);
      const box = h('div', 'position:absolute;left:' + x + 'px;top:' + top + 'px;width:' + w + 'px;height:' + hh + 'px;background:#fff;border:1px solid #7A7A7A;box-sizing:border-box;cursor:default;');
      const txt = h('div', 'position:absolute;left:4px;top:0;right:30px;line-height:' + (hh - 2) + 'px;font:22px ' + FONT + ';color:#000;white-space:nowrap;overflow:hidden;', value);
      box.appendChild(txt);
      const chev = h('div', 'position:absolute;right:11px;top:' + (hh / 2 - 9) + 'px;width:9px;height:9px;border-right:2px solid #404040;border-bottom:2px solid #404040;transform:rotate(45deg) scale(.8);');
      box.appendChild(chev);
      const api = { get value() { return txt.textContent; }, set(v) { txt.textContent = v; } };
      box.addEventListener('click', () => {
        const had = popup;
        closePopup();
        if (had && had.dataset.owner === String(x) + ',' + String(cy)) return;
        const pop = h('div', 'position:absolute;left:' + x + 'px;top:' + (top + hh) + 'px;min-width:' + w + 'px;background:#fff;border:1px solid #7A7A7A;z-index:20;box-shadow:0 2px 6px rgba(0,0,0,.3);');
        pop.dataset.owner = String(x) + ',' + String(cy);
        items.forEach((it) => {
          const li = h('div', 'padding:0 8px;height:30px;line-height:30px;font:22px ' + FONT + ';white-space:nowrap;cursor:default;color:#000;', it);
          if (it === txt.textContent) { li.style.background = '#E5F1FB'; }
          li.addEventListener('pointerenter', () => { li.style.background = '#0078D7'; li.style.color = '#fff'; });
          li.addEventListener('pointerleave', () => { li.style.background = it === txt.textContent ? '#E5F1FB' : ''; li.style.color = '#000'; });
          li.addEventListener('click', (ev) => { ev.stopPropagation(); closePopup(); if (onPick) onPick(it, api); });
          pop.appendChild(li);
        });
        form.appendChild(pop);
        popup = pop;
      });
      form.appendChild(box);
      return api;
    };

    // ---------------- Report Information ----------------
    const today = new Date();
    const pad2 = (n) => String(n).padStart(2, '0');
    frame(24, 1226, 62, 121, 'Report Information');
    label('Date:', 39, 99);
    entry(115, 99, 147, today.getFullYear() + '-' + pad2(today.getMonth() + 1) + '-' + pad2(today.getDate()), { h: 28 });
    label('Measurer:', 316, 99);
    entry(440, 99, 184, '', { h: 28 });
    label('Energy (MV):', 678, 99);
    let fffBox = null, fffOn = /FFF/.test(D.energy);
    const paintFff = () => { fffBox.textContent = fffOn ? '✓' : ''; };
    const energy = combo(826, 99, 127, CH.ENERGIES, D.energy, (v, api) => {
      api.set(v); fffOn = /FFF/.test(v); paintFff();
    }, 31);

    // ---------------- Environmental Data (left) ----------------
    frame(24, 639, 143, 283, 'Environmental Data');
    const envL = ['Temperature (°C):', 'Pressure (kPa):', 'Humidity (%):'];
    const envX = colX(44, envL);
    envL.forEach((t, i) => label(t, 44, 183 + 38 * i));
    const temp = entry(envX, 183, 622 - envX, num(D.temp));
    const press = entry(envX, 221, 622 - envX, num(D.press));
    entry(envX, 259, 622 - envX, '');

    // ---------------- Machine / Setup (left) ----------------
    frame(24, 639, 304, 568, 'Machine / Setup');
    const setL = ['Unit Name:', 'Nominal Accel:', 'Setup:', 'Dose Rate (MU/min):', 'Depth (cm):'];
    const setX = colX(44, setL);
    setL.forEach((t, i) => label(t, 44, [345, 385, 423, 461, 499][i]));
    combo(setX, 345, 622 - setX, ['TB'], 'TB', null);
    entry(setX, 385, 622 - setX, '6');
    const setup = combo(setX, 423, 622 - setX, ['SSD', 'SAD'], D.setup, (v, api) => api.set(v));
    entry(setX, 461, 622 - setX, '300.0');
    const depth = entry(setX, 499, 622 - setX, num(D.depth));
    fffBox = h('div', 'position:absolute;left:45px;top:' + Y(534) + 'px;width:13px;height:13px;background:#fff;border:1px solid #333;display:flex;align-items:center;justify-content:center;font:700 12px "Segoe UI Symbol",sans-serif;line-height:11px;cursor:default;');
    fffBox.addEventListener('click', () => { fffOn = !fffOn; paintFff(); });
    form.appendChild(fffBox);
    paintFff();
    label('FFF', 68, 540);

    // ---------------- Beam Quality (left) ----------------
    frame(24, 639, 589, 767, 'Beam Quality');
    const bqL = ['TPR 20/10:', 'PDD @ zref:', 'TMR @ zref (SAD only):', 'Target @ z_max (cGy/MU):'];
    const bqX = colX(44, bqL);
    bqL.forEach((t, i) => label(t, 44, 629 + 38 * i));
    const tpr = entry(bqX, 629, 622 - bqX, String(D.tpr));
    const pdd = entry(bqX, 667, 622 - bqX, String(D.pdd));
    const tmr = entry(bqX, 705, 622 - bqX, D.tmr == null ? '' : String(D.tmr));
    const target = entry(bqX, 743, 622 - bqX, '1.000');

    // ---------------- Chamber Data (right) ----------------
    frame(651, 1226, 143, 511, 'Chamber Data');
    const chL = ['Model:', 'Serial #:', 'N_D,w (Gy/nC):', 'Cal. Date:', 'Cal. Temp (°C):', 'Cal. Press (kPa):', 'K_elec:', 'k_Q Override:', 'k_Q Table:'];
    const chX = colX(670, chL);
    chL.forEach((t, i) => label(t, 670, 183 + 38 * i, t === 'k_Q Override:' ? RED : null));
    const chamber = entry(chX, 183, 1209 - chX, D.chamber);
    entry(chX, 221, 1209 - chX, '');
    const ndw = entry(chX, 259, 1209 - chX, String(D.ndw));
    entry(chX, 297, 1209 - chX, '');
    const calTemp = entry(chX, 335, 1209 - chX, num(D.calTemp));
    const calPress = entry(chX, 373, 1209 - chX, String(D.calPress));
    const kelec = entry(chX, 411, 1209 - chX, D.kelec.toFixed(3));
    entry(chX, 449, 1209 - chX, '', { override: true });
    combo(chX, 487, 1209 - chX, [V12, REV1], REV1, (v, api) => {
      if (v === V12) toast('데모는 TRS-398 Rev.1만 계산합니다'); else api.set(v);
    });

    // ---------------- Voltage Settings (right) ----------------
    frame(651, 1226, 532, 748, 'Voltage Settings');
    const vL = ['Ref Voltage (V):', 'Red Voltage (V):', 'MU:', 'k_s Override:', 'k_vol Override:'];
    const vX = colX(670, vL);
    vL.forEach((t, i) => label(t, 670, 572 + 38 * i, i > 2 ? RED : null));
    const vRef = entry(vX, 572, 1209 - vX, String(D.vRef));
    const vRed = entry(vX, 610, 1209 - vX, String(D.vRed));
    const mu = entry(vX, 648, 1209 - vX, String(D.mu));
    entry(vX, 686, 1209 - vX, '', { override: true });
    entry(vX, 724, 1209 - vX, '', { override: true });

    // ---------------- Measurement Readings ----------------
    frame(24, 1226, 789, 1034, 'Measurement Readings (nC)');
    const COLX = [241, 490, 739, 987], COLW = [237, 237, 236, 224];
    const heads = ['Measurement 1', 'Measurement 2', 'Measurement 3', 'Average'];
    heads.forEach((t, i) => {
      const bg = i === 3 ? '#F9E79F' : '#D6EAF8';
      form.appendChild(h('div', 'position:absolute;left:' + COLX[i] + 'px;top:' + Y(814) + 'px;width:' + COLW[i] + 'px;height:46px;box-sizing:border-box;background:' + bg + ';border:2px solid;border-color:#FDFEFE #8E9AA4 #8E9AA4 #FDFEFE;font:700 20px ' + FONT + ';display:flex;align-items:center;justify-content:center;color:#000;', t));
    });
    const rowDefs = [['Reference (+V):', D.mRef, 888], ['Opposite (-V):', D.mOpp, 943], ['Reduced Voltage:', D.mRed, 998]];
    const rows = rowDefs.map(([t, vals, cy]) => {
      label(t, 44, cy);
      const es = [0, 1, 2].map((i) => entry(COLX[i], cy, COLW[i], vals[i] == null ? '' : vals[i].toFixed(2), { center: true, h: 28 }));
      const avg = h('div', 'position:absolute;left:' + COLX[3] + 'px;top:' + Y(cy - 16) + 'px;width:' + COLW[3] + 'px;height:32px;box-sizing:border-box;background:#FFEB9C;border:2px solid;border-color:#8E9AA4 #FDFEFE #FDFEFE #8E9AA4;font:700 24px ' + FONT + ';display:flex;align-items:center;justify-content:center;color:#000;', '0.000');
      form.appendChild(avg);
      return { es, avg };
    });
    const parseCell = (e) => {
      const t = e.value.trim();
      if (!t) return null;
      const v = Number(t);
      return Number.isFinite(v) ? v : NaN;
    };
    const updateAverages = () => {
      rows.forEach((r) => {
        const vals = r.es.map(parseCell).filter((v) => v !== null);
        if (vals.some(Number.isNaN)) r.avg.textContent = '?';
        else r.avg.textContent = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(4) : '-';
      });
    };
    rows.forEach((r) => r.es.forEach((e) => e.addEventListener('input', updateAverages)));
    updateAverages();

    // ---------------- buttons ----------------
    const mkBtn = (txt, base, active, x1, x2, color, fn) => {
      const b = h('div', 'position:absolute;left:' + x1 + 'px;top:' + Y(1044) + 'px;width:' + (x2 - x1) + 'px;height:78px;box-sizing:border-box;background:' + base + ';border:2px solid;border-color:' + color + ';color:#fff;font:700 24px ' + FONT + ';display:flex;align-items:center;justify-content:center;cursor:pointer;');
      b.textContent = txt;
      b.addEventListener('pointerdown', () => { b.style.background = active; });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, () => { b.style.background = base; }));
      b.addEventListener('click', fn);
      form.appendChild(b);
      return b;
    };
    mkBtn('Calculate', '#28A745', '#1E8838', 220, 604, '#7EDB92 #0E4D1D #0E4D1D #7EDB92', () => calculate());
    mkBtn('Save PDF', '#6C9BCF', '#5C8BBF', 646, 1029, '#A9C6E4 #3F6288 #3F6288 #A9C6E4', () => toast());

    // ---------------- results ----------------
    form.appendChild(h('div', 'position:absolute;left:24px;top:' + Y(1133) + 'px;width:1202px;height:44px;background:#34495E;color:#fff;font:700 24px ' + FONT + ';display:flex;align-items:center;justify-content:center;', 'Calculation Results'));
    const results = h('div', 'left:24px;top:' + Y(1177) + 'px;width:1202px;height:566px;', null, 't3-results');
    form.appendChild(results);

    // ---------------- calculate ----------------
    const number = (e, name) => {
      const t = e.value.trim();
      if (!t) throw new InputError(name + ' 칸이 비어 있습니다.');
      const v = Number(t);
      if (!Number.isFinite(v)) throw new InputError(name + " '" + t + "'은(는) 숫자가 아닙니다.");
      return v;
    };
    const readings = (r, name, allowEmpty) => {
      const vals = [];
      r.es.forEach((e, i) => { if (e.value.trim()) vals.push(number(e, name + ' 측정 ' + (i + 1))); });
      if (!vals.length && !allowEmpty) throw new InputError(name + ' 읽음값을 하나 이상 넣어 주세요.');
      return vals;
    };

    function buildText() {
      const x = {
        temp: number(temp, 'Temperature'), press: number(press, 'Pressure'), ndw: number(ndw, 'N_D,w'),
        mu: number(mu, 'MU'), tpr: number(tpr, 'TPR 20/10'), kelec: number(kelec, 'K_elec'),
        target: number(target, 'Target'), depth: number(depth, 'Depth'),
        energy: energy.value, setup: setup.value, vRef: number(vRef, 'Ref Voltage'), vRed: number(vRed, 'Red Voltage'),
        calTemp: number(calTemp, 'Cal. Temp'), calPress: number(calPress, 'Cal. Press'),
        chamber: chamber.value.trim(),
      };
      x.mRef = readings(rows[0], 'Reference', false);
      x.mOpp = readings(rows[1], 'Opposite', true);
      x.mRed = readings(rows[2], 'Reduced voltage', true);
      x.pdd = null; x.tmr = null;
      if (x.setup === 'SSD') x.pdd = number(pdd, 'PDD @ zref');
      else if (tmr.value.trim()) x.tmr = number(tmr, 'TMR @ zref');
      return buildLines(x, {
        calTempText: calTemp.value, calPressText: calPress.value,
        savedDefaults: temp.value.trim() === num(D.temp) && press.value.trim() === num(D.press),
      });
    }

    function calculate() {
      if (destroyed) return;
      token++;
      const my = token;
      clearTimeout(timer);
      printing = false; paused = false; pending = null;
      results.textContent = '';
      let lines;
      let isError = false;
      try {
        lines = buildText();
      } catch (err) {
        isError = true;
        lines = ['계산 오류: ' + (err && err.message ? err.message : String(err))];
      }
      const scroller = root_;
      scroller.scrollTop = scroller.scrollHeight;
      let i = 0;
      const step = () => {
        if (destroyed || my !== token) return;
        if (i >= lines.length) { printing = false; pending = null; return; }
        results.textContent += lines[i] + '\n';
        results.scrollTop = results.scrollHeight;     // the Tk box does not follow; the demo keeps the newest lines in view
        const ln = lines[i];
        i += 1;
        timer = setTimeout(step, ln === '' ? 25 : LINE_MS);
      };
      if (isError) { results.textContent = lines[0] + '\n'; results.classList.add('err'); } else {
        results.classList.remove('err');
        printing = true;
        pending = { step, rest: () => { while (i < lines.length) { results.textContent += lines[i++] + '\n'; } results.scrollTop = results.scrollHeight; printing = false; pending = null; } };
        step();
      }
    }

    const player = {
      toggle() {
        if (printing && !paused) { paused = true; clearTimeout(timer); }
        else if (printing && paused) { paused = false; pending.step(); }
        else calculate();
      },
      next() {
        if (printing) { clearTimeout(timer); paused = false; pending.rest(); } else calculate();
      },
      prev() {},
    };

    return {
      player,
      get ready() { return true; },
      destroy() {
        destroyed = true;
        clearTimeout(timer);
        document.removeEventListener('pointerdown', onDocDown, true);
        document.removeEventListener('keydown', onEsc, true);
        root_.remove();
      },
    };
  }

  DM.windows.trs398 = { buildLines, InputError, title: 'Photon_Calibration(TRS-398) Calibration', width: W, height: H, theme: 'light', mount };
})(typeof window !== 'undefined' ? window : globalThis);
