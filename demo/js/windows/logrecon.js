/* Eclipse 로그 선량 재구성 window (Plan View > Calculation Models > 로그 선량 재구성..., Tools > Eclipse 로그 선량 재구성)
   with a self-playing walkthrough. Replica of DosiMachine log_recon_window.py (_build_ui): boxes 1 (plan / Eclipse IDs),
   2 (trajectory log), the beam <-> log table, the segment list, the run row (path B first, the import path greyed),
   the progress log and box 3 (comparison with the plan dose).

   Data: real, from the TBox run of 2026-09-19 (head & neck VMAT, 2 arcs; bake/bake_eclipse.py -> data/logrecon.js):
   log QA per beam, the plugin's result.json (bridge, model, beam-sum check, Eclipse MU -> log MU factors), and the
   3D gamma / dose difference recomputed with DosiMachine's dose_compare from the real dose grids:
   actual vs the clinical RTDOSE (older engine: 93.5 % at 1 %/1 mm) and vs the expected reconstruction (same engine,
   same path: 100 %), shown in that order (100 % first, then the clinical comparison). The DVH rows are the ones that run wrote (compare.json, vs clinical).
   Not real / not in the original: the patient id, plan name and folder (anonymised), the Eclipse panel (a drawing,
   eclipse-ui.js), the Plan View popup (DosiMachine shows these in the main Plan View), cursor, captions, step card. */
(function (root) {
  const DM = root.DM = root.DM || {};
  DM.windows = DM.windows || {};

  const W = 1600, H = 920;
  const PID = 'HN-DEMO-01', COURSE = 'C1', PLAN = 'HN_VMAT', TARGET = 'HN_VMAT_LOG';
  const JOB_DIR = '\\\\server\\EM_Eclipse\\Output\\20260919_183743_HN_VMAT';
  const STEPS = [
    { t: '플랜 · Eclipse ID', cap: '① Plan View에 열린 플랜을 그대로 가져옵니다', sub: '환자 · 코스 · 플랜 ID = Eclipse에서 찾을 이름 (시연용 익명)' },
    { t: '로그 스캔 / 해독', cap: '② Trajectory log를 읽어 빔과 짝을 짓습니다', sub: '로그 한 파일에 아크 2개 → 자동 분리 · 이름으로 매칭' },
    { t: 'Eclipse에서 계산 (스크립트)', cap: '③ 지시서(job)를 쓰고, Eclipse 안에서 우리 플러그인이 계산', sub: '로그의 MLC · Jaw로 새 플랜을 만들어 Eclipse AAA로 계산' },
    { t: '빔별 선량 반입', cap: '④ Eclipse가 계산한 3D 선량을 받아옵니다', sub: '빔마다 로그 MU로 맞춤 (선량은 MU에 비례)' },
    { t: '3D 감마 (같은 엔진): 100 %', cap: '⑤ 같은 엔진 · 같은 경로 선량과 비교: 100 %', sub: '로그대로 조사한 선량 = 계획 선량' },
    { t: '기준을 임상 선량으로: 93.5 %', cap: '⑥ 같은 선량을 임상 RTDOSE와 비교: 93.5 %', sub: '차이의 원인은 장비가 아니라 엔진 버전 차이' },
    { t: '정리', cap: '⑦ 로그 → Eclipse 재계산 → 3D 비교', sub: '' },
  ];
  const LAST = '시연 끝 · 실측 1건 (두경부 VMAT, Eclipse TBox 2026-09-19) · Esc: 닫기';

  const f1 = (v) => (+v).toFixed(1), f2 = (v) => (+v).toFixed(2);
  const sgn = (v, d) => (v >= 0 ? '+' : '') + (+v).toFixed(d);

  function mount(body) {
    const D = root.DM_DATA && root.DM_DATA.logrecon;
    const { h, eclipsePanel, viewer } = DM.eclui;
    if (!D) { body.appendChild(h('div', null, '로그 재구성 데이터가 없습니다 (bake_eclipse.py).')); return { destroy() {} }; }
    let destroyed = false;
    const app = h('div', 'ec-app');
    const ent = (txt, w) => { const e = h('div', 'ec-ent', txt); if (w) e.style.width = w + 'px'; return e; };
    const btn = (txt, cls) => h('span', 'ec-btn' + (cls ? ' ' + cls : ''), txt);
    const box = (title) => { const f = h('fieldset', 'ec-box'); f.appendChild(h('legend', null, ' ' + title + ' ')); return f; };

    /* ---------------- top: boxes 1 and 2 ---------------- */
    const top = h('div', 'ec-row');
    const b1 = box('1. 플랜 / Eclipse ID'); b1.style.flex = '1';
    const g1 = h('div', 'ec-grid');
    const bPick = btn('Eclipse에서 선택...');
    g1.append(h('span', 'ec-lab', 'Patient ID'), ent(PID, 230), bPick, h('span', 'ec-lab', 'Course ID'), ent(COURSE, 230), h('span'),
      h('span', 'ec-lab', 'Plan ID'), ent(PLAN, 230), h('span'));
    const rp = h('div', 'ec-small', 'RTPLAN: (Plan View) ' + PLAN + '  ·  빔 2개 · VMAT · 12 fx × 2 Gy');
    rp.style.marginTop = '6px';
    b1.append(g1, rp);
    const b2 = box('2. Trajectory log'); b2.style.flex = '1.35';
    const r21 = h('div', 'ec-row'); r21.style.alignItems = 'center';
    const bScan = btn('로그 스캔 / 해독', 'acc');
    r21.append(h('span', 'ec-lab', '로그 폴더'), ent('\\\\TrueBeam\\TDS\\Trajectory log\\' + PLAN, 380), btn('...'), bScan);
    const r22 = h('div', 'ec-row'); r22.style.alignItems = 'center'; r22.style.marginTop = '6px';
    const cSession = h('span', 'ec-combo', ''); cSession.style.width = '300px';
    const radA = h('span', 'ec-rad on'); radA.append(h('i'), document.createTextNode('actual(실측)'));
    const radE = h('span', 'ec-rad'); radE.append(h('i'), document.createTextNode('expected(자가검증)'));
    r22.append(h('span', 'ec-lab', '세션(날짜)'), cSession, h('span', 'ec-lab', '소스'), radA, radE);
    const r23 = h('div', 'ec-row'); r23.style.alignItems = 'center'; r23.style.marginTop = '6px';
    const chkSave = h('span', 'ec-chk on'); chkSave.append(h('i'), document.createTextNode('Eclipse에 저장 (SaveModifications)'));
    const chkJob = h('span', 'ec-chk on'); chkJob.append(h('i'), document.createTextNode('job 파일만 쓰기 (Eclipse 플러그인으로 실행)'));
    const cModel = h('span', 'ec-combo', 'AAA_15606'); cModel.style.width = '110px';
    const cGrid = h('span', 'ec-combo', '2.5'); cGrid.style.width = '54px';
    r23.append(h('span', 'ec-lab', '모델'), cModel, h('span', 'ec-lab', '격자[mm]'), cGrid, chkSave, chkJob);
    b2.append(r21, r22, r23);
    top.append(b1, b2);

    /* ---------------- middle: beams table + segment list ---------------- */
    const mid = h('div', 'ec-row'); mid.style.height = '196px';
    const bl = box('플랜 빔 <-> 로그 대응'); bl.style.flex = '1.6'; bl.style.display = 'flex'; bl.style.flexDirection = 'column';
    const tv = h('div', 'ec-tv');
    const tb = h('table');
    const cols = [['Beam', 100], ['Technique', 80], ['Plan MU', 70, 'c'], ['CPs', 45, 'c'], ['Gantry', 100, 'c'], ['Log segment', 220], ['Log MU', 70, 'c'], ['Holds', 50, 'c'], ['Note', 260]];
    const cg = h('colgroup'); cols.forEach((c) => { const x = h('col'); x.style.width = c[1] + 'px'; cg.appendChild(x); });
    const thr = h('tr'); cols.forEach((c) => thr.appendChild(h('th', c[2] || null, c[0])));
    const thd = h('thead'); thd.appendChild(thr);
    const beamBody = h('tbody');
    tb.append(cg, thd, beamBody); tv.appendChild(tb); bl.appendChild(tv);
    const br = box('세션의 로그 세그먼트 (수동 지정: 빔 선택 후 세그먼트 더블클릭)'); br.style.flex = '1'; br.style.display = 'flex'; br.style.flexDirection = 'column';
    const segList = h('div', 'ec-list'); br.appendChild(segList);
    mid.append(bl, br);

    /* ---------------- run row ---------------- */
    const run = h('div', 'ec-row'); run.style.alignItems = 'center'; run.style.padding = '2px 0';
    const bRun = btn('재구성 플랜 계산 (Eclipse)', 'acc big');
    const bBeam = btn('빔별 선량 반입', 'ok big');
    const prog = h('div', 'ec-prog'); const progB = h('b'); prog.appendChild(progB);
    const status = h('span', null, '');
    run.append(bRun, h('span', 'ec-muted', '→'), bBeam, h('span', 'ec-muted', '대안 · 임포트 경로'), btn('RTPLAN 내보내기', 'alt'),
      h('span', 'ec-muted', '→'), btn('Eclipse 계산 지시서 만들기', 'alt'), prog, status);

    /* ---------------- bottom: progress log + comparison ---------------- */
    const bot = h('div', 'ec-row'); bot.style.flex = '1';
    const lb = box('진행 로그'); lb.style.flex = '1'; lb.style.display = 'flex'; lb.style.flexDirection = 'column';
    const logEl = h('div', 'ec-log'); lb.appendChild(logEl);
    const cb = box('3. 플랜 선량과 비교'); cb.style.flex = '1.1'; cb.style.display = 'flex'; cb.style.flexDirection = 'column'; cb.style.gap = '4px';
    const c1 = h('div', 'ec-row'); c1.style.alignItems = 'center';
    const cGamma = h('span', 'ec-combo', '3 % / 2 mm'); cGamma.style.width = '110px';
    const bGamma = btn('감마 / DVH 계산', 'acc');
    const bRecon = btn('Plan View: Recon'), bDiff = btn('Diff');
    c1.append(h('span', 'ec-lab', '감마 기준'), cGamma, bGamma, bRecon, bDiff);
    const c2 = h('div', 'ec-row'); c2.style.alignItems = 'center';
    const refLab = h('span', 'ec-lab', ''); refLab.style.flex = '1';
    const bClin = btn('임상 RTDOSE로'), bRef = btn('기준 바꾸기...');
    c2.append(refLab, bClin, bRef);
    const glab = h('div', 'ec-glab', '감마: -');
    const tv2 = h('div', 'ec-tv');
    const tb2 = h('table');
    const cols2 = [['Structure', 130], ['Metric', 60], ['Plan [Gy]', 80, 'r'], ['Recon [Gy]', 80, 'r'], ['Diff [Gy]', 75, 'r'], ['Diff [%]', 70, 'r']];
    const cg2 = h('colgroup'); cols2.forEach((c) => { const x = h('col'); x.style.width = c[1] + 'px'; cg2.appendChild(x); });
    const thr2 = h('tr'); cols2.forEach((c) => thr2.appendChild(h('th', c[2] || null, c[0])));
    const thd2 = h('thead'); thd2.appendChild(thr2);
    const dvhBody = h('tbody');
    tb2.append(cg2, thd2, dvhBody); tv2.appendChild(tb2);
    cb.append(c1, c2, glab, tv2);
    bot.append(lb, cb);

    app.append(top, mid, run, bot);
    body.appendChild(app);

    const ecl = eclipsePanel(app, [['EMBridge_eclipse15c.esapi.dll', '승인됨 · DosiMachine'], ['(다른 승인 스크립트)', ''], ['(다른 승인 스크립트)', '']]);
    const pv = viewer(app, 'Plan View');
    const O = DM.demoOverlay(app, { W, H, title: '자동 시연 · Eclipse 로그 선량 재구성', steps: STEPS });
    const { at, say, wait, moveTo, click, markSteps, begin } = O;

    /* ---------------- state helpers ---------------- */
    const log = (text, cls) => {
      const d = h('div', cls || null, text); logEl.appendChild(d);
      while (logEl.scrollHeight > logEl.clientHeight + 2 && logEl.firstChild) logEl.removeChild(logEl.firstChild);
    };
    const setProg = (p, s) => { progB.style.width = Math.max(0, Math.min(100, p)) + '%'; if (s != null) status.textContent = s; };
    const B = D.beams, CMP = D.compare, BR = D.bridge;
    const segText = (b, i) => '2026-07-20 08:26  ' + b.name.padEnd(9) + (b.gantry.split(' ')[1] || '').padEnd(4) + f2(b.mu_log).padStart(7) + ' MU  '
      + b.ncp + ' CP  holds ' + b.holds + '   (서브빔 ' + (i + 1) + ')';
    const REF_CLIN = '기준: 임상 RTDOSE (Plan View)';
    const REF_EXP = '기준: expected 재구성 (계획대로 · 같은 엔진 · 같은 경로)';

    function resetUI() {
      beamBody.innerHTML = ''; segList.innerHTML = ''; logEl.innerHTML = ''; dvhBody.innerHTML = '';
      cSession.textContent = ''; cGamma.textContent = '3 % / 2 mm'; refLab.textContent = REF_CLIN;
      glab.textContent = '감마: -'; glab.className = 'ec-glab';
      setProg(0, ''); ecl.show(false); pv.show(false);
      app.querySelectorAll('.hot').forEach((e) => e.classList.remove('hot'));
      B.forEach(() => {});
      PLAN_ROWS.forEach((r) => beamBody.appendChild(r));
    }
    // plan beams are listed as soon as the window opens (load_plan); log columns fill after the scan
    const PLAN_ROWS = B.map((b) => {
      const tr = h('tr');
      [b.name, b.tech, f1(b.mu_plan), b.ncp, b.gantry, '', '', '', ''].forEach((v, i) => tr.appendChild(h('td', cols[i][2] || null, String(v))));
      return tr;
    });
    function fillMatch(animate) {
      B.forEach((b, i) => {
        const tds = PLAN_ROWS[i].children;
        tds[5].textContent = '2026-07-20 ' + b.name + ' (서브빔 ' + (i + 1) + ')';
        tds[6].textContent = f1(b.mu_log); tds[7].textContent = b.holds;
        tds[8].textContent = 'MLC rms ' + f2(b.mlc_rms) + ' / max ' + f2(b.mlc_max) + ' mm, gantry rms ' + f2(b.gantry_rms) + '°';
        if (animate) { PLAN_ROWS[i].classList.remove('new'); void PLAN_ROWS[i].offsetWidth; PLAN_ROWS[i].classList.add('new'); }
      });
    }
    const SCAN_LOG = [
      ['[scan] 로그 파일 1개 · TrueBeam v5.0 · HD120 (120 leaf)'],
      ['[scan] ' + PLAN + '_G181-179_20260720.bin: 서브빔 2개 (CW + CCW) → 세그먼트 2개'],
      ['[scan] 세션 2026-07-20: 세그먼트 2개, 빔오프 없음 (MU remaining 0)'],
      ['[match] G181-179 ← 서브빔 1 (BeamName 일치)', 'ok'],
      ['[match] G179-181 ← 서브빔 2 (BeamName 일치)', 'ok'],
    ];
    const JOB_LOG = () => B.map((b) => ['[job] ' + b.name + ': MU ' + f1(b.mu_log) + ', CP ' + b.ncp + ', MLC actual-expected RMS ' + b.mlc_rms.toFixed(3)
      + ' mm / max ' + f2(b.mlc_max) + ' mm, gantry RMS ' + f2(b.gantry_rms) + ' deg, beam-on ' + Math.round(b.beam_on_s) + ' s, holds ' + b.holds + ', leaf-gap fixes 0'])
      .concat([['[job] ' + JOB_DIR + '\\job.json'], ['[job] 계산은 하지 않았습니다.  (경로를 클립보드에 복사했습니다)', 'ok'],
        ['[job] 1) Eclipse에서 Tools > Scripts 로 EMBridge를 실행합니다 (job이 자동으로 불러와집니다).'],
        ['[job] 3) 끝나면 "빔별 선량 반입"으로 같은 폴더를 고르면 됩니다.']]);
    const IMPORT_LOG = () => [
      ['[bridge] plan LogRecon/' + TARGET + ', saved=True, bridge ' + BR.name + ' ' + BR.version],
      ['[bridge] 모델 ' + BR.model + '   격자 ' + (BR.grid * 10) + ' mm'],
      ['[bridge] MU 요청 ' + B.map((b) => f2(b.mu_log)).join(' / ') + '  →  Eclipse가 쓴 MU ' + B.map((b) => f2(b.eclipse_mu)).join(' / '), 'warn'],
      ['[bridge] 빔별 합 검사: 최대점에서 플랜 ' + BR.check.plan_gy.toFixed(4) + ' Gy vs 빔 합 ' + BR.check.beam_sum_gy.toFixed(4) + ' Gy (+0.000 %)', 'ok'],
    ].concat(B.map((b, i) => ['[beamdose] 빔' + (i + 1) + ' ' + b.name + ': Eclipse ' + f2(b.eclipse_mu) + ' MU -> 로그 ' + f2(b.mu_log) + ' MU (x' + b.factor.toFixed(6) + ')']))
      .concat([['[import] LogRecon ' + BR.model + ' ' + TARGET + ' (actual) → Plan View Recon · Dmax ' + f2(D.dmax.actual) + ' Gy', 'ok']]);

    const gammaText = (c, refName) => '감마 1%/1mm (global, cutoff 10%): 통과율 ' + f1(c.pass) + ' %   mean ' + f2(c.mean) + '  max ' + f2(c.max) + '  (' + c.n + ' voxels)\n'
      + '선량차 (Recon - ' + refName + '): 평균 ' + sgn(c.mean_pct, 2) + ' % of max, |max| ' + f2(c.max_abs) + ' Gy, 2 % 이내 ' + f1(c.w2) + ' %, 3 % 이내 ' + f1(c.w3) + ' %';
    function fillGamma(key) {
      const c = CMP[key];
      glab.textContent = gammaText(c, key === 'clinical' ? '임상 RTDOSE' : 'expected');
      glab.className = 'ec-glab ' + (c.pass >= 95 ? 'ok' : 'err');
      dvhBody.innerHTML = '';
      const rows = key === 'clinical' ? D.dvh_clinical
        : [['(전체)', 'Dmax', D.dmax.expected, D.dmax.actual, D.dmax.actual - D.dmax.expected, (D.dmax.actual / D.dmax.expected - 1) * 100]];
      rows.forEach((r) => {
        const tr = h('tr');
        [r[0], r[1], f2(r[2]), f2(r[3]), sgn(r[4], 2), r[5] == null ? '-' : sgn(r[5], 1)].forEach((v, i) => tr.appendChild(h('td', cols2[i][2] || null, v)));
        dvhBody.appendChild(tr);
      });
      setProg(100, '비교 완료');
    }
    const I = D.img;
    function viewRecon() {
      pv.setTabs(['Recon', 'Diff', 'Gamma'], 0);
      pv.set({ tab: 0, sets: [{ img: I.recon }], legend: 'jet', legendText: '0 → ' + f2(D.dmax.actual) + ' Gy (12 fx)',
        text: 'Recon: 로그로 재구성 → Eclipse AAA 15.6이 계산한 3D 선량', sub: '축 · 관상 · 시상 단면 = 같은 3D 격자 · 실제 계산 결과' });
    }
    function viewCompare(key, tab) {
      const clin = key === 'clinical';
      pv.setTabs(['Recon', 'Diff', 'Gamma'], tab);
      if (tab === 1) pv.set({ tab, sets: [{ img: I['diff_' + key] }], legend: 'bwr', legendText: '−3 %   0   +3 % (of max)',
        text: clin ? 'Diff (Recon − 임상 RTDOSE): 고르게 붉음 = 전체가 약 +1 % 높음' : 'Diff (Recon − expected): 색이 없음 = 0.3 % 넘는 차이가 없음',
        sub: clin ? '전달 오차라면 특정 부위에 몰려야 합니다. 고르게 높다 = 계산 엔진 차이' : '평균 ' + sgn(CMP.expected.mean_pct, 3) + ' % · 최대 ' + f2(CMP.expected.max_abs) + ' Gy' });
      else pv.set({ tab, sets: [{ img: I['gamma_' + key] }], legend: 'gamma', legendText: '초록 γ ≤ 1 (통과)    빨강 γ > 1',
        text: 'Gamma 1 %/1 mm: 통과율 ' + f1(CMP[key].pass) + ' %' + (clin ? '  (기준: 임상 RTDOSE)' : '  (기준: expected · 같은 엔진)'),
        sub: clin ? '빨간 곳은 선량 경사가 급한 가장자리 · 엔진 버전 차이 +1 %가 1 % 기준을 넘김' : 'max γ ' + f2(CMP.expected.max) + ' · 장비 전달 오차가 0.1 %/0.1 mm보다 작음' });
    }

    /* ---------------- walkthrough ---------------- */
    async function press(el, t, fx, fy) {
      await moveTo(at(el, fx, fy), t, 600); el.classList.add('hot'); await wait(140, t);
      await click(t); el.classList.remove('hot');
    }
    async function logLines(lines, t, ms) { for (const l of lines) { log(l[0], l[1]); await wait(ms || 260, t); } }
    async function progTo(p0, p1, ms, label, t) { const s = Math.max(1, Math.round((p1 - p0) / 5)); for (let k = 1; k <= s; k++) { setProg(p0 + (p1 - p0) * k / s, label); await wait(ms / s, t); } }
    async function eclipseRun(t) {
      ecl.reset('job: ' + JOB_DIR + '\\job.json  (쪽지 파일로 자동 선택)'); ecl.show(true);
      await wait(300, t);
      await moveTo(at(ecl.rows[0], 0.4, 0.5), t, 600); ecl.select(0); await click(t);
      say('Eclipse: Tools > Scripts > EMBridge (DosiMachine 플러그인)', 'Eclipse에 한 번 승인해 둔 스크립트 · 앱과 다른 PC여도 됩니다');
      await wait(1300, t);
      await press(ecl.run, t);
      const P = [
        ['환자 열기 · 원본 플랜 찾기', 8, ['{"event":"progress","step":"open_patient","pct":8}', 'j'], ['OpenPatientById("' + PID + '") → ' + COURSE + ' / ' + PLAN]],
        ['새 플랜 만들기 (원본은 그대로)', 22, ['{"event":"progress","step":"copy_plan","pct":22}', 'j'], ['Course LogRecon · AddExternalPlanSetup → ' + TARGET]],
        ['빔 2개 · 조절점 178개마다 로그의 MLC · Jaw', 40, ['{"event":"progress","step":"add_beams","pct":40}', 'j'], ['AddVMATBeam ×2 · LeafPositions / JawPositions ← 로그 실측값']],
        ['Eclipse AAA로 3D 선량 계산', 62, ['{"event":"progress","step":"calculate","pct":62}', 'j']].concat(D.calc_log.map((l) => [l, 'i'])),
        ['선량 내보내기 (전체 + 빔별)', 86, ['{"event":"progress","step":"export","pct":86}', 'j'], ['dose.raw + beam1 + beam2 (float32, Gy, 2.5 mm 격자)']],
        ['저장 · 빔별 합 검사', 100, ['{"event":"progress","step":"save","pct":100}', 'j'], ['beam_dose_check: 플랜 ' + BR.check.plan_gy.toFixed(4) + ' Gy = 빔 합 ' + BR.check.beam_sum_gy.toFixed(4) + ' Gy'],
          ['{"event":"result","ok":true,"mode":"recon"}', 'ok']],
      ];
      await moveTo(at(ecl.el, 0.68, 0.45), t, 500);
      say('플러그인이 Eclipse 안에서 플랜을 만들고 계산합니다', '계산 엔진 = Eclipse의 AAA 15.6.06 그대로 (복사해 온 엔진이 아님)');
      for (const p of P) {
        ecl.step(p[0], p[1]);
        for (const l of p.slice(2)) { ecl.line(l[0], l[1]); await wait(210, t); }
        await wait(350, t);
      }
      ecl.foot('완료 · 결과 폴더: ' + JOB_DIR);
      await wait(900, t);
      await press(ecl.x, t);
      ecl.show(false);
    }

    const steps = [
      { fill() {},
        async run(t) {
          begin(0); await wait(300, t);
          await moveTo(at(g1, 0.5, 0.5), t, 600); await wait(1500, t);
          await moveTo(at(rp, 0.3, 0.5), t, 450);
          say('플랜 빔 2개가 표에 먼저 들어와 있습니다', 'VMAT 2아크 · 각 178 조절점 · 처방 12회 × 2 Gy');
          await moveTo(at(PLAN_ROWS[0], 0.25, 0.5), t, 450); await wait(1500, t);
        } },
      { fill() { cSession.textContent = '2026-07-20  (세그먼트 2 · 빔 2/2)'; B.forEach((b, i) => segList.appendChild(h('div', null, segText(b, i)))); fillMatch(false); SCAN_LOG.forEach((l) => log(l[0], l[1])); setProg(100, '스캔 완료'); },
        async run(t) {
          begin(1);
          await press(bScan, t);
          await progTo(0, 60, 700, '로그 해독 중...', t);
          await logLines(SCAN_LOG.slice(0, 3), t, 300);
          cSession.textContent = '2026-07-20  (세그먼트 2 · 빔 2/2)';
          for (let i = 0; i < B.length; i++) { segList.appendChild(h('div', null, segText(B[i], i))); await wait(250, t); }
          await progTo(60, 100, 400, '스캔 완료', t);
          await logLines(SCAN_LOG.slice(3), t, 250);
          fillMatch(true);
          await moveTo(at(PLAN_ROWS[0], 0.8, 0.5), t, 500);
          say('MLC 실측 − 계획: RMS 0.03 mm · 최대 0.08 mm', '로그 = 장비가 20 ms마다 기록한 실제 리프 · 조 · 갠트리 · MU');
          await wait(2300, t);
        } },
      { fill() { JOB_LOG().forEach((l) => log(l[0], l[1])); setProg(100, 'job 작성'); },
        async run(t) {
          begin(2);
          await press(bRun, t);
          await logLines(JOB_LOG(), t, 230);
          setProg(100, 'job 작성');
          await moveTo(at(logEl, 0.5, 0.75), t, 450);
          say('앱은 계산하지 않습니다 · 지시서(job.json)만 씁니다', '계산은 Eclipse가 · 그래서 Eclipse와 같은 값');
          await wait(1800, t);
          await eclipseRun(t);
        } },
      { fill() { IMPORT_LOG().forEach((l) => log(l[0], l[1])); viewRecon(); pv.show(true); setProg(100, '반입 완료'); },
        async run(t) {
          begin(3);
          await press(bBeam, t);
          await progTo(0, 100, 700, '빔별 선량 읽는 중...', t);
          await logLines(IMPORT_LOG(), t, 300);
          setProg(100, '반입 완료');
          await moveTo(at(logEl, 0.55, 0.62), t, 450);
          say('Eclipse는 MU를 처방에서 정해 버립니다 (200 MU)', '선량은 MU에 정비례 → 빔마다 ×(로그 MU ÷ 200)로 되돌림');
          await wait(2400, t);
          await press(bRecon, t);
          viewRecon(); pv.show(true);
          await moveTo(at(pv.el, 0.5, 0.5), t, 500);
          say('재구성 선량이 Plan View에 3D로 올라갑니다', '실제 계산 결과 · 최대 ' + f2(D.dmax.actual) + ' Gy (계획 12회 합)');
          await wait(2600, t);
          await press(pv.x, t); pv.show(false);
        } },
      { fill() { cGamma.textContent = '1 % / 1 mm'; refLab.textContent = REF_EXP; fillGamma('expected'); log('[ref] 기준 선량: expected 재구성 (같은 엔진 · 같은 경로)'); log('[compare] gamma ' + f1(CMP.expected.pass) + ' % pass, mean diff ' + sgn(CMP.expected.mean_pct, 3) + ' %', 'ok'); viewCompare('expected', 2); pv.show(true); },
        async run(t) {
          begin(4);
          pv.show(false);
          await press(bRef, t);
          refLab.textContent = REF_EXP; log('[ref] 기준 선량: expected 재구성 (같은 엔진 · 같은 경로)');
          await moveTo(at(refLab, 0.3, 0.5), t, 400);
          say('기준 = 같은 엔진 · 같은 경로로 계산한 계획 선량', '로그의 계획값(expected)으로 같은 과정을 거친 선량 → 남는 차이 = 장비가 실제로 어긋난 것');
          await wait(2600, t);
          await press(cGamma, t); cGamma.textContent = '1 % / 1 mm'; await wait(300, t);
          await press(bGamma, t);
          await progTo(0, 100, 900, 'gamma 1%/1mm ...', t);
          fillGamma('expected');
          log('[compare] gamma ' + f1(CMP.expected.pass) + ' % pass, mean diff ' + sgn(CMP.expected.mean_pct, 3) + ' %', 'ok');
          await moveTo(at(glab, 0.25, 0.3), t, 450);
          say('1 %/1 mm 100.0 % · 평균 차이 +0.009 %', '최대 차이 ' + f2(CMP.expected.max_abs) + ' Gy · 장비 전달 오차는 사실상 없음');
          await wait(2400, t);
          await press(bDiff, t); viewCompare('expected', 1); pv.show(true);
          await moveTo(at(pv.el, 0.5, 0.5), t, 450);
          say('Diff: 색이 없습니다', '0.3 %를 넘는 차이가 어디에도 없음');
          await wait(2200, t);
          await press(pv.tab(2), t); viewCompare('expected', 2);
          say('Gamma: 전부 초록 (max γ 0.07)', '로그대로 조사된 선량 = 계획 선량');
          await wait(2300, t);
        } },
      { fill() { cGamma.textContent = '1 % / 1 mm'; refLab.textContent = REF_CLIN; fillGamma('clinical'); log('[ref] 기준 선량: 임상 RTDOSE (Plan View)'); log('[compare] gamma ' + f1(CMP.clinical.pass) + ' % pass, mean diff ' + sgn(CMP.clinical.mean_pct, 2) + ' %', 'ok'); viewCompare('clinical', 1); pv.show(true); },
        async run(t) {
          begin(5);
          await press(pv.x, t); pv.show(false);
          await press(bClin, t);
          refLab.textContent = REF_CLIN; log('[ref] 기준 선량: 임상 RTDOSE (Plan View)');
          await moveTo(at(refLab, 0.3, 0.5), t, 400);
          say('이번엔 기준을 임상 RTDOSE로', 'Plan View에 열린 선량 · 다른 버전의 엔진으로 계산된 것');
          await wait(2300, t);
          await press(bGamma, t);
          await progTo(0, 100, 900, 'gamma 1%/1mm ...', t);
          fillGamma('clinical');
          log('[compare] gamma ' + f1(CMP.clinical.pass) + ' % pass, mean diff ' + sgn(CMP.clinical.mean_pct, 2) + ' %', 'ok');
          await moveTo(at(glab, 0.25, 0.3), t, 450);
          say('같은 로그 선량인데 1 %/1 mm 93.5 % · PTV Dmax +1 %', '로그 선량은 그대로 · 바뀐 것은 비교 기준뿐');
          await wait(2600, t);
          await press(bDiff, t);
          viewCompare('clinical', 1); pv.show(true);
          await moveTo(at(pv.el, 0.5, 0.5), t, 450);
          say('차이가 몸 전체에 고르게 +1 %', '전달 오차라면 특정 부위에 몰려야 합니다 → 엔진 버전 차이');
          await wait(2600, t);
          await press(pv.tab(2), t); viewCompare('clinical', 2);
          say('감마: 빨간 곳 = 선량 경사가 급한 가장자리', '엔진 차이 +1 %가 1 % 기준을 넘긴 것 · 장비 탓이 아님');
          await wait(2600, t);
        } },
      { fill() {},
        async run(t) {
          begin(6);
          await moveTo(at(pv.el, 0.5, 0.9), t, 450);
          say('로그 → Eclipse가 재계산 → 3D 감마 · DVH', '실측 1건(두경부 VMAT, TBox) · 교훈: 비교 기준은 반드시 같은 엔진');
          await wait(3000, t);
          markSteps(6, -1);
          say(LAST, '다음: Tools > CBCT 조직변화 선량 (오늘 몸으로 재계산)');
        } },
    ];

    function setFor(i) {
      resetUI();
      for (let k = 0; k <= i; k++) steps[k].fill();
      if (i >= 6) say(LAST, '다음: Tools > CBCT 조직변화 선량');
      else O.settle(i, LAST);
    }
    resetUI();
    // by hand while paused
    bRecon.addEventListener('click', () => { if (D) { viewRecon(); pv.show(true); } });
    ecl.x.addEventListener('click', () => ecl.show(false));

    const imgs = Object.values(I).flatMap((s) => Object.values(s)).map((v) => 'data/' + v.file);
    let left = imgs.length, readyFlag = false;
    imgs.forEach((src) => { const im = new Image(); im.onload = im.onerror = () => { if (--left <= 0) readyFlag = true; }; im.src = src; });

    const player = DM.Player ? new DM.Player({ steps, render(k) { if (!destroyed) setFor(k); }, onChange() {} }) : null;
    return {
      player,
      get ready() { return readyFlag; },
      destroy() { destroyed = true; if (player) player.destroy(); O.destroy(); },
    };
  }

  DM.windows.logrecon = { title: 'Eclipse 로그 선량 재구성 (Trajectory log -> Eclipse dose)', width: W, height: H, theme: 'logrecon', mount, STEPS };
})(typeof window !== 'undefined' ? window : globalThis);
