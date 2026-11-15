/* ESAPI > Portal Dosimetry QA Report: QAReportScript_v15.dll (PDIP_V18 project), a Portal Dosimetry (Eclipse V18)
   script with two tabs: QA Report (field list -> GENERATE PDF REPORT) and DICOM Export (plan -> images -> destination).

   There is no capture of the real window, so the window is re-drawn from QAReportScript_v15.cs: Execute (header band,
   tabs), CreateQAReportContent (Detail / Field ID / Pass (%) list, Logo, Save To, green button), CreateDICOMExportContent
   (Step 1-3, field groups with their own check box, Pixel Values CU/Original, Machine Name, Export Here),
   GenerateHtmlAndPrintPdf (the report's HTML and CSS) and SaveImageRefined / SaveProfileImage / SaveHistogramImage
   (the four pictures of a field page: colours, legend, crosshair, axis texts as in the code).

   Not from Eclipse, and said so on screen:
   - the plan, the patient and every dose image are made up here (seeded, so every run shows the same numbers):
     five IMRT-like fields; the "measured" image is the predicted one shifted 0.2 / -0.15 mm, +0.3 % output, 0.4 % noise,
     and for F4 a 1.4 mm MLC bank offset so one field is worse;
   - the gamma (global, 10 % threshold) and dose difference are computed in the browser from those images. In the real
     script they are read from Portal Dosimetry's own analysis (Analyses / EvaluationTests);
   - the Eclipse workspace behind the window and its Tools > Scripts dialog are a plain stand-in;
   - the real script closes its window after the PDF opens; the demo shows it again for the DICOM Export tab. */
(function (root) {
  const DM = root.DM = root.DM || {};
  DM.windows = DM.windows || {};

  const W = 1600, H = 1000;
  const N = 200;                                   // dose grid N x N, 1 mm per pixel, beam axis between px 99 and 100
  const PAT = { name: 'DEMO, PATIENT', id: 'PD-DEMO-001' };
  const COURSE = 'C1', PLAN = 'PD_HN_IMRT';
  const MACHINE = 'TrueBeam_1';
  const SAVE_TO = 'C:\\Users\\Physicist\\Desktop';
  const DESTS = [['Local', 'C:\\PDIP_Export'], ['Verification', '\\\\QA-Server\\PD_Import']];
  const FIELDS = [
    { id: 'F1 G000', seed: 101 },
    { id: 'F2 G072', seed: 202 },
    { id: 'F3 G144', seed: 303 },
    { id: 'F4 G216', seed: 404, mlc: 1.4 },
    { id: 'F5 G288', seed: 505 },
  ];
  const BAD = 3;                                   // index of the field with the MLC offset
  const END_TEXT = '시연 끝 · 화면은 코드대로 다시 그린 것, 숫자는 가상 플랜으로 계산';
  const STEPS = [
    { t: '스크립트 실행', cap: '① Portal Dosimetry에서 스크립트를 실행합니다', sub: 'Tools > Scripts → QAReportScript_v15.dll' },
    { t: '필드별 결과 읽기', cap: '② ESAPI가 필드마다 분석 결과를 읽어 옵니다', sub: '창이 뜰 때 이미 목록이 채워져 있습니다' },
    { t: 'PDF 리포트 만들기', cap: '③ [GENERATE PDF REPORT] 한 번', sub: '필드마다 그림 4장을 그리고 Edge로 PDF 인쇄' },
    { t: '리포트: 요약 표', cap: '④ 1쪽: 3%/3mm · 2%/2mm 요약 표', sub: '두 기준을 한 장에서 비교' },
    { t: '리포트: 필드 상세', cap: '⑤ 필드마다 한 쪽: 감마 · 선량차 · 프로파일 · 히스토그램', sub: 'Detail에 체크한 필드만 들어갑니다' },
    { t: 'DICOM: 영상 고르기', cap: '⑥ [DICOM Export] 탭: 내보낼 영상을 고릅니다', sub: '예측(Predicted) · 측정(Measured)이 필드별로 묶여 있습니다' },
    { t: 'DICOM: 내보내기', cap: '⑦ 저장 위치를 골라 [Export Here]', sub: 'ESAPI에는 DICOM 저장 기능이 없어 스크립트가 직접 씁니다' },
    { t: '결과 폴더', cap: '⑧ 영상마다 .dcm 파일 하나', sub: '다른 QA 프로그램으로 가져가 독립 분석' },
  ];

  /* ---------------- made-up plan and dose images (pure; tested in node) ---------------- */
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // jaws and MLC segments of a field (mm at the imager plane, beam axis = 0); 5 mm leaves from -50 to +50
  function fieldPlan(f) {
    const R = rng(f.seed);
    const jaw = { x1: -(28 + R() * 14), x2: 28 + R() * 14, y1: -(26 + R() * 14), y2: 26 + R() * 14 };
    const segs = [];
    const nS = 5 + Math.floor(R() * 3);
    for (let s = 0; s < nS; s++) {
      const w = 0.35 + R() * 0.65, ph = R() * 6.28, amp = 6 + R() * 16, hw0 = 10 + R() * 22, fr = 12 + R() * 14;
      const leaves = [];
      for (let ly = -50; ly < 50; ly += 5) {
        const c = amp * Math.sin(ly / fr + ph);
        const hw = hw0 * (0.6 + 0.4 * Math.cos(ly / 30 + ph * 0.5));
        leaves.push([ly, c - hw, c + hw]);
      }
      segs.push({ w, leaves });
    }
    return { jaw, segs };
  }
  const cover = (a, b, c) => Math.max(0, Math.min(b, c + 0.5) - Math.max(a, c - 0.5));   // part of pixel c inside [a,b]
  const pxOf = (mm) => mm + N / 2 - 0.5;                                                  // mm -> pixel index
  const mmOf = (p) => p - N / 2 + 0.5;
  function blur(F, sig) {
    const r = Math.ceil(sig * 3), k = [];
    let s = 0;
    for (let i = -r; i <= r; i++) { const v = Math.exp(-i * i / (2 * sig * sig)); k.push(v); s += v; }
    for (let i = 0; i < k.length; i++) k[i] /= s;
    const T = new Float32Array(N * N), O = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let v = 0;
      for (let i = -r; i <= r; i++) { const xx = x + i; if (xx >= 0 && xx < N) v += F[y * N + xx] * k[i + r]; }
      T[y * N + x] = v;
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let v = 0;
      for (let i = -r; i <= r; i++) { const yy = y + i; if (yy >= 0 && yy < N) v += T[yy * N + x] * k[i + r]; }
      O[y * N + x] = v;
    }
    return O;
  }
  // fluence through the segments (o.dx/o.dy: setup shift, o.mlc: left bank opened by this many mm), 1.5 % MLC
  // transmission inside the jaws, blurred by a 1.8 mm penumbra
  function raster(P, o) {
    const F = new Float32Array(N * N);
    const jx1 = P.jaw.x1 + o.dx, jx2 = P.jaw.x2 + o.dx, jy1 = P.jaw.y1 + o.dy, jy2 = P.jaw.y2 + o.dy;
    let wsum = 0;
    P.segs.forEach((s) => {
      wsum += s.w;
      s.leaves.forEach(([ly, l, r]) => {
        const a = Math.max(jx1, l - o.mlc + o.dx), b = Math.min(jx2, r + o.dx);
        const c = Math.max(ly + o.dy, jy1), d = Math.min(ly + 5 + o.dy, jy2);
        if (b <= a || d <= c) return;
        for (let y = Math.max(0, Math.floor(pxOf(c))); y <= Math.min(N - 1, Math.ceil(pxOf(d))); y++) {
          const cy = cover(c, d, mmOf(y));
          if (cy <= 0) continue;
          for (let x = Math.max(0, Math.floor(pxOf(a))); x <= Math.min(N - 1, Math.ceil(pxOf(b))); x++) {
            const cx = cover(a, b, mmOf(x));
            if (cx > 0) F[y * N + x] += s.w * cx * cy;
          }
        }
      });
    });
    for (let y = 0; y < N; y++) {
      const cy = cover(jy1, jy2, mmOf(y));
      if (cy <= 0) continue;
      for (let x = 0; x < N; x++) F[y * N + x] += 0.015 * wsum * cy * cover(jx1, jx2, mmOf(x));
    }
    return blur(F, 1.8);
  }
  function maxOf(A) { let m = -Infinity; for (let i = 0; i < A.length; i++) if (A[i] > m) m = A[i]; return m; }
  function makeField(f) {
    const P = fieldPlan(f);
    const pred = raster(P, { dx: 0, dy: 0, mlc: 0 });
    const meas = raster(P, { dx: 0.2, dy: -0.15, mlc: f.mlc || 0 });
    const R = rng(f.seed * 7 + 3);
    const cu = 1.0 + R() * 0.3, k = cu / maxOf(pred);
    for (let i = 0; i < pred.length; i++) {
      const z = Math.sqrt(-2 * Math.log(R() || 1e-9)) * Math.cos(2 * Math.PI * R());
      pred[i] *= k;
      meas[i] = meas[i] * k * 1.003 + z * 0.004 * cu;
    }
    return { id: f.id, jaw: P.jaw, pred, meas };
  }
  // search offsets within 2 x DTA on a 0.25 mm step, sorted by distance, as [dx, dy, (r/DTA)^2] (dx, dy in pixels)
  const SUB = 4;
  function offsets(dta) {
    const r = Math.ceil(2 * dta * SUB), L = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const d2 = (dx * dx + dy * dy) / (SUB * SUB * dta * dta);
      if (d2 <= 4) L.push([dx / SUB, dy / SUB, d2]);
    }
    return L.sort((p, q) => p[2] - q[2]);
  }
  // global gamma of the measured image against the predicted one (reference interpolated to 0.25 mm); points under thr x max(predicted) are left out (0)
  function gamma(meas, pred, ddPct, dta, thr) {
    const pmax = maxOf(pred), dD = ddPct / 100 * pmax, inv = 1 / (dD * dD), off = offsets(dta);
    const cut = (thr == null ? 0.1 : thr) * pmax;
    const g = new Float32Array(N * N);
    let cnt = 0, pass = 0, sum = 0, gmax = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x, m = meas[i];
      if (m < cut) continue;
      let best = Infinity;
      for (let j = 0; j < off.length; j++) {
        const o = off[j];
        if (o[2] >= best) break;
        const fx = x + o[0], fy = y + o[1];                 // reference read between pixels (bilinear)
        if (fx < 0 || fy < 0 || fx > N - 1 || fy > N - 1) continue;
        const x0 = Math.min(N - 2, Math.floor(fx)), y0 = Math.min(N - 2, Math.floor(fy)), ax = fx - x0, ay = fy - y0, q = y0 * N + x0;
        const ref = (pred[q] * (1 - ax) + pred[q + 1] * ax) * (1 - ay) + (pred[q + N] * (1 - ax) + pred[q + N + 1] * ax) * ay;
        const d = m - ref, v = o[2] + d * d * inv;
        if (v < best) best = v;
      }
      const gv = Math.sqrt(best);
      g[i] = gv; cnt++; sum += gv;
      if (gv <= 1) pass++;
      if (gv > gmax) gmax = gv;
    }
    return { g, pass: pass / cnt, max: gmax, avg: sum / cnt, roi: cnt };
  }
  // dose difference in % of max(predicted), same threshold
  function doseDiff(meas, pred, thr) {
    const pmax = maxOf(pred), cut = (thr == null ? 0.1 : thr) * pmax;
    const d = new Float32Array(N * N);
    let cnt = 0, mx = 0, sum = 0;
    for (let i = 0; i < d.length; i++) {
      if (meas[i] < cut) continue;
      const v = (meas[i] - pred[i]) / pmax * 100;
      d[i] = v; cnt++; sum += Math.abs(v);
      if (Math.abs(v) > mx) mx = Math.abs(v);
    }
    return { d, max: mx, avg: sum / cnt };
  }
  function analyze(f) {
    const F = makeField(f);
    F.g3 = gamma(F.meas, F.pred, 3, 3);
    F.g2 = gamma(F.meas, F.pred, 2, 2);
    F.dd = doseDiff(F.meas, F.pred);
    return F;
  }
  // DICOM Export rows of a plan, as populateExpItems makes them (one predicted + one measured image per field)
  function exportRows() {
    const rows = [];
    FIELDS.forEach((f) => {
      rows.push({ field: f.id, beam: f.id, type: 'Predicted' });
      const img = f.id + '_M1';
      rows.push({ field: f.id, beam: img, type: 'Measured_1 (' + img + ')' });
    });
    return rows;
  }
  // PerformExport's file name: RI_{patient}_{plan}_{beam}_{type}.dcm
  const fileName = (r) => 'RI_' + PAT.id + '_' + PLAN + '_' + r.beam + '_' + r.type + '.dcm';

  /* ---------------- pictures of a field page (SaveImageRefined / SaveProfileImage / SaveHistogramImage) ---------------- */
  const LIME = 'rgb(50,205,50)', ORANGE_G = 'rgb(240,140,20)';
  function drawMap(cv, F, type) {
    const S = 3, XS = N / 2, OFF = N / 4, LEG = 60, w = XS * S, h = XS * S;
    cv.width = w + LEG; cv.height = h;
    const g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, h);
    const A = type === 'gamma' ? F.g3.g : F.dd.d;
    for (let y = 0; y < XS; y++) for (let x = 0; x < XS; x++) {
      const v = A[(y + OFF) * N + x + OFF];
      g.fillStyle = type === 'gamma' ? (v <= 1 ? LIME : ORANGE_G) : (v > 1 ? 'rgb(220,0,0)' : v < -1 ? 'rgb(0,0,220)' : LIME);
      g.fillRect(x * S, (XS - 1 - y) * S, S, S);
    }
    g.strokeStyle = 'red'; g.lineWidth = 1.5; g.setLineDash([6, 3]);
    g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
    g.setLineDash([]);
    const J = F.jaw;                                // field outline (the frame's graphic annotation)
    g.strokeRect(w / 2 + J.x1 * S, h / 2 - J.y2 * S, (J.x2 - J.x1) * S, (J.y2 - J.y1) * S);
    const ly0 = 20, ly1 = h - 30, lx = w + 10, lw = 15;
    const gr = g.createLinearGradient(0, ly0, 0, ly1);
    if (type === 'gamma') { gr.addColorStop(0, ORANGE_G); gr.addColorStop(1, LIME); }
    else { gr.addColorStop(0, 'red'); gr.addColorStop(0.5, LIME); gr.addColorStop(1, 'blue'); }
    g.fillStyle = gr; g.fillRect(lx, ly0, lw, ly1 - ly0);
    g.strokeStyle = '#000'; g.lineWidth = 1; g.strokeRect(lx + 0.5, ly0 + 0.5, lw, ly1 - ly0);
    g.fillStyle = '#000'; g.font = 'bold 11px "Segoe UI", sans-serif'; g.textBaseline = 'top';
    const labs = type === 'gamma' ? [['1.10', 0], ['1.00', 0.1], ['0.00', 1]] : [['+Max', 0], ['0.00', 0.5], ['-Max', 1]];
    labs.forEach(([t, f]) => g.fillText(t, lx + lw + 2, (f === 1 ? ly1 - 10 : ly0 + (ly1 - ly0) * f - 5)));
    g.fillStyle = 'red'; g.font = 'bold 13px Arial, sans-serif';
    g.fillText('y', w / 2 + 5, 5); g.fillText('x', w - 15, h / 2 + 5);
  }
  function drawProfile(cv, F) {
    cv.width = 600; cv.height = 320;
    const g = cv.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 600, 320);
    const A = { l: 65, t: 45, w: 510, h: 230 }, c = N / 2;
    const prof = (D) => [Array.from({ length: N }, (_, i) => D[c * N + i]), Array.from({ length: N }, (_, j) => D[j * N + c])];
    const pP = prof(F.meas), rP = prof(F.pred);
    let maxV = Math.max(...pP[0], ...pP[1], ...rP[0], ...rP[1]);
    if (maxV <= 0) maxV = 1;
    g.textBaseline = 'top';
    for (let i = 0; i <= 5; i++) {
      const y = A.t + A.h - i * A.h / 5;
      g.strokeStyle = 'rgb(60,60,60)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(A.l, y); g.lineTo(A.l + A.w, y); g.stroke();
      g.fillStyle = '#fff'; g.font = 'bold 15px Arial, sans-serif';
      g.fillText((i * maxV / 5).toFixed(1), 2, y - 10);
    }
    const line = (pts, col, lw) => {
      g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
      pts.forEach((v, i) => { const x = A.l + i / pts.length * A.w, y = A.t + A.h - v / maxV * A.h; if (i) g.lineTo(x, y); else g.moveTo(x, y); });
      g.stroke();
    };
    line(rP[0], 'blue', 1); line(rP[1], LIME, 1);
    line(pP[0], 'red', 1.5); line(pP[1], 'orange', 1.5);
    g.fillStyle = '#fff'; g.font = 'bold 15px Arial, sans-serif'; g.fillText('Profiles along Collimator Axes', 65, 10);
    g.font = '13px Arial, sans-serif'; g.fillText('Dose [CU]', 5, 20);
    g.fillStyle = '#d3d3d3'; g.font = '15px Arial, sans-serif'; g.fillText('X: Red/Blue, Y: Orange/Green', 65, 285);
  }
  function drawHist(cv, F) {
    cv.width = 600; cv.height = 320;
    const g = cv.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 600, 320);
    const hist = new Array(50).fill(0), bin = 0.04, G = F.g3.g;
    for (let i = 0; i < G.length; i++) { const b = Math.floor(G[i] / bin); if (b >= 0 && b < 50) hist[b]++; }
    const A = { l: 60, t: 40, w: 500, h: 240 };
    let maxH = Math.log10(Math.max(...hist) + 1);
    if (maxH === 0) maxH = 1;
    for (let i = 0; i < 50; i++) {
      const x = A.l + i / 50 * A.w, hh = Math.log10(hist[i] + 1) / maxH * A.h;
      g.fillStyle = i * bin <= 1.0 ? LIME : 'orange';
      g.fillRect(x, A.t + A.h - hh, A.w / 50, hh);
    }
    g.strokeStyle = 'gray'; g.lineWidth = 1; g.strokeRect(A.l + 0.5, A.t + 0.5, A.w, A.h);
    g.textBaseline = 'top'; g.fillStyle = '#fff';
    g.font = 'bold 15px Arial, sans-serif'; g.fillText('Histogram Gamma Evaluation', 60, 10);
    g.font = '15px Arial, sans-serif';
    g.fillText('0.0', A.l, A.t + A.h + 5); g.fillText('1.0', A.l + A.w / 2 - 15, A.t + A.h + 5); g.fillText('2.0', A.l + A.w - 30, A.t + A.h + 5);
    g.fillText('Count (Log)', 5, A.t + A.h / 2); g.fillText('Gamma', A.l + A.w / 2 - 25, A.t + A.h + 25);
  }
  // grey picture of a dose image for the stand-in workspace
  function drawGray(cv, D, colour) {
    cv.width = N; cv.height = N;
    const g = cv.getContext('2d'), im = g.createImageData(N, N), m = maxOf(D);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const v = Math.max(0, Math.min(1, D[y * N + x] / m)), o = ((N - 1 - y) * N + x) * 4;
      if (colour) { im.data[o] = 255 * Math.min(1, v * 1.8); im.data[o + 1] = 255 * Math.max(0, Math.min(1, v * 1.8 - 0.6)); im.data[o + 2] = 255 * Math.max(0, v * 2 - 1.4); }
      else { im.data[o] = im.data[o + 1] = im.data[o + 2] = 255 * v; }
      im.data[o + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  }

  /* ---------------- window ---------------- */
  const h = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const pct1 = (v) => (v * 100).toFixed(1) + ' %';
  const stamp = () => {
    const d = new Date(), p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  };

  function mount(body) {
    let destroyed = false;
    const fields = FIELDS.map(analyze);
    const app = h('div', 'pq-app');

    /* --- stand-in Eclipse workspace --- */
    const ws = h('div', 'pq-ws');
    const wsTitle = h('div', 'pq-ws-title', 'Portal Dosimetry — ' + PAT.name + ' (' + PAT.id + ')  ·  ' + COURSE + ' \\ ' + PLAN);
    const wsMenu = h('div', 'pq-ws-menu');
    const menus = {};
    ['File', 'Edit', 'View', 'Insert', 'Tools', 'Window', 'Help'].forEach((m) => { menus[m] = h('span', null, m); wsMenu.appendChild(menus[m]); });
    const wsDrop = h('div', 'pq-ws-drop');
    const dropItems = {};
    ['Options...', 'Scripts...', 'Calibration...'].forEach((t) => { dropItems[t] = h('div', null, t); wsDrop.appendChild(dropItems[t]); });
    const wsTree = h('div', 'pq-ws-tree');
    wsTree.appendChild(h('b', null, PLAN));
    fields.forEach((F, i) => wsTree.appendChild(h('div', i === 0 ? 'on' : null, F.id)));
    const wsMain = h('div', 'pq-ws-main');
    const big = h('canvas', 'pq-ws-big'); drawGray(big, fields[0].meas, true);
    wsMain.append(h('div', 'pq-ws-lab', 'Portal Dose Image · ' + fields[0].id), big);
    const wsSide = h('div', 'pq-ws-side');
    const side1 = h('canvas'); drawGray(side1, fields[0].pred, true);
    const side2 = h('canvas'); drawGray(side2, fields[0].meas, false);
    wsSide.append(h('div', 'pq-ws-lab', 'Predicted'), side1, h('div', 'pq-ws-lab', 'Measured (raw)'), side2);
    ws.append(wsTitle, wsMenu, wsTree, wsMain, wsSide, wsDrop, h('div', 'pq-ws-note', '배경: 단순화한 그림 (실제 Eclipse 화면 아님)'));

    // Tools > Scripts dialog (stand-in)
    const sDlg = h('div', 'pq-sdlg');
    const sBar = h('div', 'pq-tbar'); sBar.append(h('span', null, 'Scripts'), h('i', 'x', '✕'));
    const sList = h('div', 'pq-slist');
    sList.appendChild(h('div', 'hd', 'Name'));
    const scriptRows = {};
    ['ExportPortalDoseScript_v6.dll', 'QAReportScript_v14.dll', 'QAReportScript_v15.dll'].forEach((n) => { scriptRows[n] = h('div', 'row', n); sList.appendChild(scriptRows[n]); });
    const sBtns = h('div', 'pq-sbtns');
    const bRun = h('span', 'pq-btn', 'Run'), bClose = h('span', 'pq-btn', 'Close');
    sBtns.append(bRun, bClose);
    sDlg.append(sBar, sList, sBtns);

    /* --- the script window (Execute) --- */
    const win = h('div', 'pq-win');
    const tbar = h('div', 'pq-tbar main');
    tbar.append(h('span', null, 'Portal Dosimetry Unified Tool made by JG Kim (v50)'), h('i', null, '─'), h('i', null, '☐'), h('i', 'x', '✕'));
    const head = h('div', 'pq-head');
    head.append(h('div', 't', 'Portal Dosimetry Unified Tool made by JG Kim'), h('div', 's', 'Patient: ' + PAT.name + ' (' + PAT.id + ')'));
    const tabs = h('div', 'pq-tabs');
    const tabQA = h('span', 'pq-tab on', 'QA Report'), tabEx = h('span', 'pq-tab', 'DICOM Export');
    tabs.append(tabQA, tabEx);
    const pageQA = h('div', 'pq-page qa on'), pageEx = h('div', 'pq-page ex');
    win.append(tbar, head, tabs, pageQA, pageEx);

    const chk = (on) => { const c = h('span', 'pq-chk' + (on ? ' on' : '')); return c; };
    const setChk = (c, on) => c.classList.toggle('on', !!on);

    // QA Report tab
    const card = h('div', 'pq-card');
    const qTable = h('table', 'pq-grid');
    qTable.innerHTML = '<colgroup><col style="width:60px"><col style="width:180px"><col style="width:100px"><col></colgroup>'
      + '<thead><tr><th>Detail</th><th>Field ID</th><th>Pass (%)</th><th></th></tr></thead>';
    const qBody = h('tbody');
    const qRows = fields.map((F) => {
      const tr = h('tr'), c = chk(true), td0 = h('td', 'c');
      td0.appendChild(c);
      tr.append(td0, h('td', null, F.id), h('td', null, (F.g3.pass * 100).toFixed(2) + '%'), h('td'));
      qBody.appendChild(tr);
      return { tr, c, on: true };
    });
    qTable.appendChild(qBody); card.appendChild(qTable);
    const foot = h('div', 'pq-foot');
    const row = (lab, val) => {
      const r = h('div', 'pq-frow'), box = h('span', 'pq-tb', val), b = h('span', 'pq-btn dots', '...');
      r.append(h('span', 'lab', lab), box, b);
      return r;
    };
    const logoRow = row('Logo: ', ''), pathRow = row('Save To: ', SAVE_TO);
    const bGen = h('div', 'pq-gen', 'GENERATE PDF REPORT');
    foot.append(logoRow, pathRow, bGen);
    pageQA.append(card, foot);

    // DICOM Export tab
    const accent = (t) => h('div', 'pq-step', t);
    const s1 = h('div', 'pq-s1');
    const cmbPlan = h('div', 'pq-combo', COURSE + ' \\ ' + PLAN);
    s1.append(accent('Step 1. Select a Target Plan'), cmbPlan);
    const s2h = h('div', 'pq-s2h');
    const bSelAll = h('span', 'pq-btn', 'Select All'), bDesel = h('span', 'pq-btn', 'Deselect All');
    const selBtns = h('span', 'r'); selBtns.append(bSelAll, bDesel);
    s2h.append(accent('Step 2. View & Select Images for Export'), selBtns);
    const exList = h('div', 'pq-exlist');
    const exTable = h('table', 'pq-grid');
    exTable.innerHTML = '<colgroup><col style="width:50px"><col style="width:180px"><col style="width:120px"><col style="width:200px"><col></colgroup>'
      + '<thead><tr><th>Select</th><th>Beam ID</th><th>Type</th><th>Status</th><th></th></tr></thead>';
    const exBody = h('tbody');
    const rows = exportRows().map((r) => Object.assign(r, { on: true, status: 'Ready' }));
    const groups = {};
    rows.forEach((r) => {
      if (!groups[r.field]) {
        const gtr = h('tr', 'grp'), td = h('td'), gc = chk(true);
        td.colSpan = 5;
        const gl = h('span', 'gh'); gl.append(gc, h('b', null, 'Field: ' + r.field));
        td.appendChild(gl); gtr.appendChild(td); exBody.appendChild(gtr);
        groups[r.field] = { c: gc, rows: [] };
      }
      const tr = h('tr'), c = chk(true), td0 = h('td', 'c'), st = h('td', null, 'Ready');
      td0.appendChild(c);
      tr.append(td0, h('td', null, r.beam), h('td', null, r.type), st, h('td'));
      exBody.appendChild(tr);
      Object.assign(r, { tr, c, st });
      groups[r.field].rows.push(r);
    });
    exTable.appendChild(exBody); exList.appendChild(exTable);
    const thumb = h('div', 'pq-thumb');
    const s3h = h('div', 'pq-s3h');
    const rbCU = h('span', 'pq-radio on', 'CU'), rbOr = h('span', 'pq-radio', 'Original');
    const cmbMach = h('div', 'pq-combo ed', MACHINE);
    const mp = h('span', 'r'); mp.append(h('b', null, 'Pixel Values:'), rbCU, rbOr, h('b', null, 'Machine Name:'), cmbMach);
    s3h.append(accent('Step 3. Export Destinations'), mp);
    const add = h('div', 'pq-add');
    add.append(h('span', null, 'Name:'), h('span', 'pq-tb n', 'NewProfile'), h('span', null, 'Path:'), h('span', 'pq-tb p', 'C:\\temp'), h('span', 'pq-btn dots', '...'), h('span', 'pq-btn', 'Save Profile'));
    const locs = h('div', 'pq-locs');
    const exportBtns = DESTS.map(([n, p]) => {
      const r = h('div', 'pq-loc'), be = h('span', 'pq-btn exp', 'Export Here');
      r.append(h('b', null, n), h('span', 'pq-tb ro', p), h('span', 'pq-btn', 'Del'), be);
      locs.appendChild(r);
      return be;
    });
    pageEx.append(s1, s2h, exList, thumb, s3h, add, locs);

    /* --- message box, busy spinner, PDF viewer, explorer --- */
    const msg = h('div', 'pq-msg');
    const msgTxt = h('div', 't');
    const msgOk = h('span', 'pq-btn ok', 'OK');
    const mb = h('div', 'b'); mb.appendChild(msgOk);
    msg.append(h('div', 'pq-tbar'), msgTxt, mb);
    const busy = h('div', 'pq-busy');

    const pdf = h('div', 'pq-pdf');
    const pdfHead = h('div', 'pq-pdf-head');
    const pdfX = h('span', 'x', '×');
    pdfHead.append(h('span', null, 'QA_Report_' + PAT.id + '_' + PLAN + '.pdf'), pdfX);
    const pdfBody = h('div', 'pq-pdf-body');
    pdf.append(pdfHead, pdfBody);

    const exp = h('div', 'pq-exp');
    const expBar = h('div', 'pq-tbar'); const expX = h('i', 'x', '✕');
    expBar.append(h('span', null, 'PDIP_Export'), expX);
    const expAddr = h('div', 'pq-exp-addr', '📁  ' + DESTS[0][1]);
    const expList = h('div', 'pq-exp-list');
    expList.appendChild(h('div', 'hd', 'Name'));
    rows.forEach((r) => expList.appendChild(h('div', null, fileName(r))));
    exp.append(expBar, expAddr, expList);

    app.append(ws, sDlg, win, busy, pdf, exp, msg);
    body.appendChild(app);
    const O = DM.demoOverlay(app, { W, H, title: '자동 시연 · ESAPI Portal Dosimetry QA', steps: STEPS });
    const { at, say, wait, moveTo, click, scrollTo, centerTop, begin, markSteps, later } = O;

    /* --- report (GenerateHtmlAndPrintPdf) --- */
    const pages = [];
    function buildReport() {
      pdfBody.innerHTML = ''; pages.length = 0;
      const sheet = () => { const s = h('div', 'pq-rp'); pdfBody.appendChild(s); pages.push(s); return s; };
      const p1 = sheet();
      const hd = h('div', 'rp-header');
      const info = h('div', 'rp-info');
      info.innerHTML = '<div><b>Patient:</b> ' + PAT.name + ' (' + PAT.id + ')</div><div><b>Plan:</b> ' + PLAN + '</div><div><b>Date:</b> ' + stamp() + '</div>';
      hd.append(h('h1', null, 'Portal Dosimetry'), info);
      p1.appendChild(hd);
      const summary = (title, crit, key) => {
        p1.appendChild(h('div', 'rp-sec', title));
        const t = h('table');
        t.innerHTML = '<thead><tr><th>Field ID</th><th>Criterion</th><th>Pass Rate</th><th>Max Gamma</th><th>Avg Gamma</th><th>Max Dose Diff</th></tr></thead>';
        const tb = h('tbody');
        fields.forEach((F) => {
          const G = F[key], tr = h('tr');
          tr.innerHTML = '<td>' + F.id + '</td><td>' + crit + '</td><td class="v">' + (G.pass * 100).toFixed(1) + ' %</td><td class="v">'
            + G.max.toFixed(2) + '</td><td class="v">' + G.avg.toFixed(2) + '</td><td class="v">' + F.dd.max.toFixed(2) + ' %</td>';
          tb.appendChild(tr);
        });
        t.appendChild(tb); p1.appendChild(t);
        return t;
      };
      const t33 = summary('QA Analysis Summary (3.0% / 3.0mm)', '3.0% / 3.0mm', 'g3');
      const t22 = summary('QA Analysis Summary (2.0% / 2.0mm)', '2.0% / 2.0mm', 'g2');
      const detail = {};
      fields.forEach((F, i) => {
        if (!qRows[i].on) return;
        const s = sheet();
        s.appendChild(h('div', 'rp-sec', 'Field Analysis Detail: ' + F.id));
        const cardEl = h('div', 'rp-card');
        const pic = (label, draw) => { const b = h('div', 'rp-img'); const cv = h('canvas'); draw(cv, F); b.append(h('div', 'l', label), cv); return b; };
        const r1 = h('div', 'rp-grid'), r2 = h('div', 'rp-grid');
        const gImg = pic('Gamma Evaluation: ' + F.id, (cv) => drawMap(cv, F, 'gamma'));
        const dImg = pic('Dose Difference: ' + F.id, (cv) => drawMap(cv, F, 'dd'));
        const pImg = pic('Profiles along Collimator Axes', drawProfile), hImg = pic('Histogram Gamma Evaluation', drawHist);
        r1.append(gImg, dImg); r2.append(pImg, hImg);
        const res = h('div', 'rp-res');
        const tab = (title, list) => {
          const d = h('div'), t = h('table');
          t.innerHTML = '<thead><tr><th colspan="2">' + title + '</th></tr></thead><tbody>'
            + list.map(([n, v]) => '<tr><td class="l">' + n + '</td><td class="v">' + v + '</td></tr>').join('') + '</tbody>';
          d.appendChild(t); return d;
        };
        const gt = tab('Gamma Analysis Results', [['Area Gamma &lt; 1.0', pct1(F.g3.pass)], ['Maximum Gamma', F.g3.max.toFixed(2)], ['Average Gamma', F.g3.avg.toFixed(2)]]);
        const dt = tab('Dose Difference Results', [['Max Dose Difference', F.dd.max.toFixed(2)], ['Avg Dose Difference', F.dd.avg.toFixed(2)]]);
        res.append(gt, dt);
        cardEl.append(r1, r2, res);
        s.appendChild(cardEl);
        detail[i] = { sheet: s, gImg, dImg, pImg, hImg, gt };
      });
      return { t33, t22, detail };
    }
    let rep = buildReport();

    /* --- state --- */
    const show = (el, on) => el.classList.toggle('on', !!on);
    function setTab(k) {
      show(tabQA, k === 'qa'); show(tabEx, k === 'ex'); show(pageQA, k === 'qa'); show(pageEx, k === 'ex');
    }
    function syncGroups() { Object.values(groups).forEach((G) => setChk(G.c, G.rows.every((r) => r.on))); }
    function setRow(r, on) { r.on = on; setChk(r.c, on); }
    function setAll(on) { rows.forEach((r) => setRow(r, on)); syncGroups(); }
    function setGroup(f, on) { groups[f].rows.forEach((r) => setRow(r, on)); syncGroups(); }
    function setStatus(r, s) { r.status = s; r.st.textContent = s; r.tr.classList.toggle('busy', /ing/.test(s)); }
    function msgBox(text) { msgTxt.textContent = text; show(msg, true); }
    const clearHot = () => app.querySelectorAll('.hot').forEach((e) => e.classList.remove('hot'));
    function flash(el) { el.classList.add('flash'); later(() => el.classList.remove('flash'), 1400); }

    /* --- by hand (while paused) --- */
    tabQA.addEventListener('click', () => setTab('qa'));
    tabEx.addEventListener('click', () => setTab('ex'));
    qRows.forEach((q) => q.c.addEventListener('click', () => { q.on = !q.on; setChk(q.c, q.on); }));
    rows.forEach((r) => r.c.addEventListener('click', () => { setRow(r, !r.on); syncGroups(); }));
    Object.keys(groups).forEach((f) => groups[f].c.addEventListener('click', () => setGroup(f, !groups[f].c.classList.contains('on'))));
    bSelAll.addEventListener('click', () => setAll(true));
    bDesel.addEventListener('click', () => setAll(false));
    rbCU.addEventListener('click', () => { show(rbCU, true); show(rbOr, false); });
    rbOr.addEventListener('click', () => { show(rbCU, false); show(rbOr, true); });
    const modeLabel = () => (rbCU.classList.contains('on') ? 'CU' : 'Original');
    let handOk = null;
    msgOk.addEventListener('click', () => { show(msg, false); if (handOk) { const f = handOk; handOk = null; f(); } });
    bGen.addEventListener('click', () => {
      rep = buildReport();
      show(busy, true);
      later(() => { show(busy, false); msgBox('Success.'); handOk = () => { show(win, false); pdfBody.scrollTop = 0; show(pdf, true); }; }, 900);
    });
    pdfX.addEventListener('click', () => { show(pdf, false); show(win, true); });
    exportBtns.forEach((be, k) => be.addEventListener('click', () => {
      const sel = rows.filter((r) => r.on);
      if (!sel.length) { msgBox('Select items first.'); return; }
      sel.forEach((r, j) => {
        later(() => setStatus(r, 'Exporting (' + modeLabel() + ')...'), j * 140);
        later(() => setStatus(r, 'Exported (' + modeLabel() + ')'), j * 140 + 120);
      });
      later(() => { msgBox('Export Finished (Custom DICOM Writer).'); handOk = () => { expAddr.textContent = '📁  ' + DESTS[k][1]; show(exp, true); }; }, sel.length * 140 + 200);
    }));
    expX.addEventListener('click', () => show(exp, false));
    pdfBody.addEventListener('wheel', (e) => { e.preventDefault(); pdfBody.scrollTop += e.deltaY; }, { passive: false });

    /* --- the walkthrough --- */
    async function press(el, t, fx, fy) {
      await moveTo(at(el, fx, fy), t, 600); el.classList.add('hot'); await wait(140, t);
      await click(t);
      el.classList.remove('hot');
    }
    async function point(el, text, sub, t, ms, fx, fy) {
      await moveTo(at(el, fx == null ? 0.5 : fx, fy == null ? 0.5 : fy), t, 550);
      say(text, sub); flash(el);
      await wait(ms || 2000, t);
    }
    const bad = fields[BAD];
    const rank = (key) => fields.reduce((m, F, i) => (F[key].pass < fields[m][key].pass ? i : m), 0);

    const steps = [
      { async run(t) {                                                    // 1. Tools > Scripts > Run
        begin(0);
        await wait(300, t);
        await press(menus.Tools, t);
        show(wsDrop, true);
        await press(dropItems['Scripts...'], t);
        show(wsDrop, false); show(sDlg, true);
        await wait(300, t);
        await press(scriptRows['QAReportScript_v15.dll'], t, 0.3);
        scriptRows['QAReportScript_v15.dll'].classList.add('sel');
        say('스크립트 = .dll 파일 하나', '설치 없이 Eclipse가 불러서 실행합니다 (승인 필요)');
        await wait(1500, t);
        await press(bRun, t);
        show(sDlg, false);
        setTab('qa'); show(win, true);
        await wait(500, t);
      } },
      { async run(t) {                                                    // 2. field list
        begin(1);
        await point(qRows[0].tr, '필드 5개 · 감마 통과율 (3%/3mm)', 'Portal Dosimetry가 이미 분석한 결과를 ESAPI로 읽음', t, 2200, 0.35, 0.5);
        await point(qRows[BAD].tr, bad.id + ': ' + (bad.g3.pass * 100).toFixed(2) + '% — 가장 낮음',
          '이 시연의 가상 플랜에서 MLC 1.4 mm 어긋남을 넣은 필드', t, 2300, 0.35, 0.5);
        await point(qRows[2].c, 'Detail 체크 = 리포트에 상세 쪽 넣기', '빼고 싶은 필드는 체크를 풉니다', t, 1900);
        await point(pathRow, '로고 · 저장 위치', '다음 실행 때도 기억합니다 (settings.txt)', t, 1800, 0.3, 0.5);
      } },
      { async run(t) {                                                    // 3. GENERATE PDF REPORT
        begin(2);
        await press(bGen, t, 0.5, 0.5);
        rep = buildReport();
        show(busy, true);
        say('필드마다 그림 4장 → HTML → Edge로 PDF 인쇄', '감마 지도 · 선량차 지도 · 프로파일 · 감마 히스토그램');
        await wait(1800, t);
        show(busy, false);
        msgBox('Success.');
        await wait(500, t);
        await press(msgOk, t);
        show(msg, false); show(win, false);
        pdfBody.scrollTop = 0; show(pdf, true);
        await wait(400, t);
      } },
      { async run(t) {                                                    // 4. summary tables
        begin(3);
        await point(rep.t33, '3%/3mm: 모든 필드의 통과율 · 최대/평균 감마 · 최대 선량차', '', t, 2300, 0.5, 0.4);
        const k = rank('g2');
        await point(rep.t22.tBodies[0].rows[k], '2%/2mm로 엄격하게 보면 ' + fields[k].id + ' ' + (fields[k].g2.pass * 100).toFixed(1) + ' %',
          '같은 측정을 두 기준으로 한 장에서 비교', t, 2400, 0.4, 0.5);
      } },
      { async run(t) {                                                    // 5. field detail page (the bad field)
        begin(4);
        const D = rep.detail[BAD];
        if (!D) return;
        await scrollTo(pdfBody, D.sheet.offsetTop - 16, t, 1400);
        await point(D.gImg, '감마 지도: 초록 ≤ 1 · 주황 > 1 (기준 밖)', '빨간 점선 = 빔 중심 · 빨간 사각형 = 조사야', t, 2400, 0.4, 0.5);
        await point(D.dImg, '선량차 지도: 빨강 +1 % 넘음 · 파랑 −1 % 넘음', '한쪽 가장자리에 몰려 있으면 MLC 위치를 의심', t, 2400, 0.4, 0.5);
        await scrollTo(pdfBody, centerTop(pdfBody, D.pImg), t, 700);
        await point(D.pImg, '프로파일: 측정(빨강/주황) vs 예측(파랑/초록)', 'X · Y 축을 따라 자른 선량', t, 2100, 0.5, 0.5);
        await point(D.hImg, '감마 히스토그램 (세로축 로그)', '1.0 오른쪽(주황) 막대 = 기준 밖 점들', t, 2000, 0.5, 0.5);
        await scrollTo(pdfBody, pdfBody.scrollHeight, t, 1300);
      } },
      { async run(t) {                                                    // 6. DICOM Export: choose images
        begin(5);
        await press(pdfX, t);
        show(pdf, false);
        say('원래 스크립트는 PDF를 연 뒤 창을 닫습니다', '시연에서는 바로 다시 띄웁니다');
        await wait(1300, t);
        show(win, true); setTab('qa');
        await press(tabEx, t);
        setTab('ex');
        await point(cmbPlan, 'Step 1: 같은 코스의 플랜 중에서 고르기', '포털 영상이 있는 플랜만 목록에 나옵니다', t, 1800, 0.2, 0.5);
        await point(exList, 'Step 2: 필드별로 예측 + 측정 영상', '', t, 1600, 0.3, 0.2);
        await press(bDesel, t);
        setAll(false);
        await wait(400, t);
        await press(groups[bad.id].c, t);
        setGroup(bad.id, true);
        say('필드 칸 하나로 예측 + 측정을 함께 선택', '');
        await wait(1600, t);
        await press(bSelAll, t);
        setAll(true);
        await wait(500, t);
      } },
      { async run(t) {                                                    // 7. Export Here
        begin(6);
        await point(rbCU, 'Pixel Values: CU (보정된 선량값) 또는 Original', '', t, 1700);
        await point(locs, 'Step 3: 장비별로 저장 위치를 등록해 두고 고르기', '', t, 1700, 0.15, 0.3);
        await press(exportBtns[0], t);
        for (const r of rows) {
          setStatus(r, 'Exporting (CU)...');
          await wait(130, t);
          setStatus(r, 'Exported (CU)');
        }
        await moveTo(at(exList, 0.55, 0.5), t, 400);
        say('영상 10장 → 10개 파일', 'Status 칸이 하나씩 Exported로 바뀝니다');
        await wait(1200, t);
        msgBox('Export Finished (Custom DICOM Writer).');
        await wait(500, t);
        await press(msgOk, t);
        show(msg, false);
      } },
      { async run(t) {                                                    // 8. explorer
        begin(7);
        expAddr.textContent = '📁  ' + DESTS[0][1];
        show(exp, true);
        await wait(300, t);
        await moveTo(at(expList, 0.3, 0.88), t, 500);
        say('RI_환자ID_플랜_빔_종류.dcm', '각도 · 픽셀 크기 · 선량 보정값이 DICOM 머리말에 들어갑니다');
        await wait(2200, t);
        markSteps(7, -1);
        say(END_TEXT, 'Esc: 창 닫기');
      } },
    ];

    function setFor(i) {                            // end state of step i (-1 = just opened)
      clearHot();
      [wsDrop, sDlg, msg, busy].forEach((e) => show(e, false));
      handOk = null;
      scriptRows['QAReportScript_v15.dll'].classList.toggle('sel', i >= 0);
      show(win, i < 0 ? false : !(i >= 2 && i <= 4));
      setTab(i >= 5 ? 'ex' : 'qa');
      show(pdf, i >= 2 && i <= 4);
      pdfBody.scrollTop = i === 4 ? pdfBody.scrollHeight : 0;
      setAll(true);
      rows.forEach((r) => setStatus(r, i >= 6 ? 'Exported (CU)' : 'Ready'));
      show(exp, i >= 7);
      O.settle(i, END_TEXT);
    }

    const player = DM.Player ? new DM.Player({
      steps,
      render(k) { if (!destroyed) setFor(k); },
      onChange() {},
    }) : null;

    return {
      player,
      get ready() { return true; },
      destroy() {
        destroyed = true;
        if (player) player.destroy();
        O.destroy();
      },
    };
  }

  DM.windows.pdqa = {
    title: 'Portal Dosimetry QA (ESAPI)', width: W, height: H, theme: 'pdqa',
    mount, STEPS, FIELDS, N, rng, fieldPlan, makeField, gamma, doseDiff, analyze, offsets, exportRows, fileName,
  };
})(typeof window !== 'undefined' ? window : globalThis);
