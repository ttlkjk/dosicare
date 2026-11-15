/* CBCT 조직변화 선량 window (Tools > CBCT 조직변화 선량) with a self-playing walkthrough.
   Replica of DosiMachine cbct_window.py (_build_ui): 1. plan (from Plan View), 2. the deformed-CT folder SmartAdapt
   exported + 검사, the check report, the middle-slice preview, the run row (Eclipse로 보내기 -> 계산 지시서 만들기 |
   빔별 선량 반입 + 감마), the result line and the progress log.

   Real (bake/bake_eclipse.py -> data/cbct.js, public TCIA pancreas CT + SmartAdapt deformed CT, Eclipse TBox):
   the folder check (cbct_dose.inspect_folder, its own warning text), the C-STORE route (AE / port measured on TBox),
   the plugin run on the deformed CT (result.json: iso_shift_mm, model, beam-sum check, Eclipse 250 MU -> plan
   823.71 MU), and the images: plan CT, deformed CT moved back by iso_shift_mm, their overlay, the plan dose on the
   plan CT and the plugin's dose on the deformed CT, both on the plan-dose colour scale.
   EXAMPLE, not measured: the reference run on the plan CT (_RF) has never been made in Eclipse, so the gamma pass
   rate and the per-structure table are example numbers, shown with a red "예시" badge.
   Not in the original: the SmartAdapt step drawing, the Eclipse panel, the Plan View popup, cursor, captions. */
(function (root) {
  const DM = root.DM = root.DM || {};
  DM.windows = DM.windows || {};

  const W = 1600, H = 920;
  const PID = 'DEMO-PANC-01', COURSE = 'C1', PLAN = 'Plan1';
  const FOLDER = '\\\\server\\SmartAdapt_Export\\' + PID + '\\Deform_Plan';
  const EXAMPLE = {                                  // NOT measured (no _RF run yet) - shown with the 예시 badge
    gamma: 71.6,
    rows: [['ROI (표적)', '97.2', '47.90', '51.30', '+7.1', '+9.4'], ['Stomach_duo', '93.5', '12.40', '13.60', '+9.7', '+11.8'],
      ['Bowel_sm', '88.1', '8.20', '8.90', '+8.5', '+10.3'], ['LUNG_L', '64.0', '0.42', '0.45', '+7.1', '+6.2']],
  };
  const STEPS = [
    { t: 'SmartAdapt 변형 (Eclipse)', cap: '⓪ 오늘 CBCT를 계획 CT에 변형 → "오늘 몸의 CT"', sub: '변형은 Eclipse SmartAdapt가 합니다 (사람이 · ESAPI에 변형 기능 없음)' },
    { t: '변형 CT 검사', cap: '① 내보낸 변형 CT 폴더를 검사합니다', sub: '빠진 슬라이스 · 섞인 파일 · 몸이 잘린 영상을 걸러냄' },
    { t: 'Eclipse로 보내기', cap: '② 변형 CT를 DICOM으로 Eclipse에 보냅니다', sub: 'C-STORE · 환자에 자동으로 붙음 (TBox 실측)' },
    { t: '지시서 → Eclipse 계산', cap: '③ 같은 플랜을 변형 CT 위에서 Eclipse가 재계산', sub: '플랜 · 빔 · MU는 그대로, 몸만 오늘 것' },
    { t: '선량 반입 · 3D 비교', cap: '④ 계획 CT 선량 vs 오늘 몸 선량 (3D 전체)', sub: '' },
    { t: '정리 · 한계', cap: '⑤ 같은 플랜, 몸만 오늘 것', sub: '' },
  ];
  const LAST = '시연 끝 · 감마 · 표의 숫자는 예시 (기준 계산 전) · Esc: 닫기';
  const f2 = (v) => (+v).toFixed(2);

  function mount(body) {
    const D = root.DM_DATA && root.DM_DATA.cbct;
    const { h, eclipsePanel, viewer } = DM.eclui;
    if (!D) { body.appendChild(h('div', null, 'CBCT 데이터가 없습니다 (bake_eclipse.py).')); return { destroy() {} }; }
    let destroyed = false;
    const app = h('div', 'ec-app');
    const ent = (txt, w) => { const e = h('div', 'ec-ent', txt); if (w) e.style.width = w + 'px'; return e; };
    const btn = (txt, cls) => h('span', 'ec-btn' + (cls ? ' ' + cls : ''), txt);
    const box = (title) => { const f = h('fieldset', 'ec-box'); f.appendChild(h('legend', null, ' ' + title + ' ')); return f; };
    const R = D.report, BM = D.beams[0];

    /* ---------------- top ---------------- */
    const top = h('div', 'ec-row');
    const b1 = box('1. 계획 (Plan View에서)');
    const g1 = h('div', 'ec-grid'); g1.style.gridTemplateColumns = 'auto auto';
    g1.append(h('span', 'ec-lab', 'Patient ID'), ent(PID, 220), h('span', 'ec-lab', 'Course'), ent(COURSE, 220), h('span', 'ec-lab', 'Plan'), ent(PLAN, 220),
      h('span', 'ec-lab', 'RTPLAN'), ent('RP_' + PLAN + ' (Plan View)', 220));
    b1.appendChild(g1);
    const b2 = box('2. SmartAdapt가 내보낸 변형 CT'); b2.style.flex = '1';
    const r2 = h('div', 'ec-row'); r2.style.alignItems = 'center';
    const bCheck = btn('검사', 'acc'); bCheck.style.padding = '0 14px';
    const folderEnt = ent(FOLDER); folderEnt.style.flex = '1';
    r2.append(h('span', 'ec-lab', '폴더'), folderEnt, btn('...'), bCheck);
    const note = h('div', 'ec-small', '변형 CT = 계획 CT의 HU를 오늘 몸 모양으로 늘이고 줄인 영상 (SmartAdapt · Deformed image export)');
    note.style.marginTop = '10px';
    b2.append(r2, note);
    top.append(b1, b2);

    /* ---------------- middle: report + preview ---------------- */
    const mid = h('div', 'ec-row'); mid.style.height = '300px';
    const bl = box('검사 결과'); bl.style.flex = '1'; bl.style.display = 'flex'; bl.style.flexDirection = 'column';
    const rep = h('div', 'ec-log'); rep.style.border = '0'; bl.appendChild(rep);
    const brt = box('가운데 단면'); brt.style.display = 'flex'; brt.style.flexDirection = 'column'; brt.style.alignItems = 'center';
    const canvas = h('div'); Object.assign(canvas.style, { width: '250px', height: '250px', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' });
    const prevImg = h('img'); prevImg.alt = ''; prevImg.style.maxWidth = '100%'; prevImg.style.maxHeight = '100%'; prevImg.style.display = 'none';
    canvas.appendChild(prevImg);
    const sliceLab = h('div', 'ec-muted', '폴더를 고르고 검사를 누르세요'); sliceLab.style.marginTop = '4px';
    brt.append(canvas, sliceLab);
    mid.append(bl, brt);

    /* ---------------- run row + result ---------------- */
    const run = h('div', 'ec-row'); run.style.alignItems = 'center';
    const bSend = btn('Eclipse로 보내기', 'ok big'), bJob = btn('Eclipse 계산 지시서 만들기', 'acc big');
    const chkSent = h('span', 'ec-chk'); chkSent.append(h('i'), document.createTextNode('이미 보냈음'));
    const bCmp = btn('빔별 선량 반입 + 감마', 'ok big');
    const cG = h('span', 'ec-combo', '3 % / 2 mm'); cG.style.width = '110px';
    run.append(bSend, h('span', 'ec-muted', '->'), bJob, chkSent, h('span', 'ec-muted', '|'), bCmp, cG);
    const res = h('div', 'ec-row'); res.style.alignItems = 'flex-start'; res.style.minHeight = '96px';
    const resLab = h('div', 'ec-muted', '보낸 뒤 Eclipse에서 환자를 닫았다 다시 열어야 보입니다.'); resLab.style.flex = '1'; resLab.style.whiteSpace = 'pre-wrap'; resLab.style.fontSize = '13px'; resLab.style.lineHeight = '19px';
    const exTv = h('div', 'ec-tv'); exTv.style.flex = '1.2'; exTv.style.display = 'none';
    const exTb = h('table');
    const cols = [['Structure', 120], ['오늘 부피 [%]', 90, 'r'], ['계획 D95', 75, 'r'], ['오늘 D95', 75, 'r'], ['ΔD95 [%]', 75, 'r'], ['Δmean [%]', 75, 'r']];
    const cg = h('colgroup'); cols.forEach((c) => { const x = h('col'); x.style.width = c[1] + 'px'; cg.appendChild(x); });
    const thr = h('tr'); cols.forEach((c) => thr.appendChild(h('th', c[2] || null, c[0])));
    const thd = h('thead'); thd.appendChild(thr); const exBody = h('tbody');
    exTb.append(cg, thd, exBody); exTv.appendChild(exTb);
    res.append(resLab, exTv);

    const lb = box('진행 로그'); lb.style.flex = '1'; lb.style.display = 'flex'; lb.style.flexDirection = 'column';
    const logEl = h('div', 'ec-log'); logEl.style.border = '0'; lb.appendChild(logEl);
    app.append(top, mid, run, res, lb);
    body.appendChild(app);

    const ecl = eclipsePanel(app, [['EMBridge_eclipse15e.esapi.dll', '승인됨 · DosiMachine 1.0.14.0'], ['(다른 승인 스크립트)', ''], ['(다른 승인 스크립트)', '']]);
    const pv = viewer(app, 'SmartAdapt 변형 결과');
    const O = DM.demoOverlay(app, { W, H, title: '자동 시연 · CBCT 조직변화 선량', steps: STEPS });
    const { at, say, wait, moveTo, click, markSteps, begin } = O;

    const log = (text, cls) => { const d = h('div', cls || null, text); logEl.appendChild(d); while (logEl.scrollHeight > logEl.clientHeight + 2 && logEl.firstChild) logEl.removeChild(logEl.firstChild); };
    const repLine = (text, cls) => rep.appendChild(h('div', cls || null, text));
    const I = D.img;
    const SH = D.shift.map((v) => (v >= 0 ? '+' : '') + v.toFixed(3)).join(', ');

    function resetUI() {
      rep.innerHTML = ''; logEl.innerHTML = ''; exBody.innerHTML = ''; exTv.style.display = 'none'; exTv.classList.remove('ec-exbox');
      resLab.textContent = '보낸 뒤 Eclipse에서 환자를 닫았다 다시 열어야 보입니다.'; resLab.className = 'ec-muted';
      prevImg.style.display = 'none'; sliceLab.textContent = '폴더를 고르고 검사를 누르세요';
      chkSent.classList.remove('on'); bSend.classList.add('dis'); bJob.classList.add('dis');
      ecl.show(false); pv.show(false);
      app.querySelectorAll('.hot').forEach((e) => e.classList.remove('hot'));
    }
    const REPORT = () => [
      ['폴더: ' + FOLDER, 'muted'],
      ['시리즈: ' + R.series],
      ['CT ' + R.n_ct + '장 · 슬라이스 ' + R.spacing_mm.toFixed(1) + ' mm · 빠진 슬라이스 없음', 'ok'],
      ['구조 세트 1개 · 구조 ' + R.structures.length + '개: ' + R.structures.join(', ')],
      ['보내지 않는 파일: ' + R.ignored.map((x) => x[0] + ' ' + x[1] + '개').join(', '), 'warn'],
      ['문제: 없음', 'ok'],
    ].concat(R.warnings.map((w) => ['경고: ' + w, 'warn']));
    const SEND_LOG = [['[send] C-ECHO eclipse@TBox:51402 (우리 AE: Dosi) ... ok', 'ok'], ['[send] C-STORE CT ' + R.n_ct + '장 + 구조 세트 1개 ...'],
      ['[send] ' + (R.n_ct + 1) + ' / ' + (R.n_ct + 1) + ' 보냄 · 거부 0', 'ok'], ['[send] Eclipse에서 환자를 닫았다 다시 열면 보입니다 (자동 배정 · 실측)']];
    const JOB_LOG = [['[job] ' + PLAN + '_CB : 변형 CT 위 (대상) · 구조 세트 = 보낸 영상'], ['[job] ' + PLAN + '_RF : 계획 CT 위 (기준) · 같은 빔 · 같은 MU · 같은 모델'],
      ['[job] 코스 DM_CBCT · 모델 ' + D.model + ' · 2.5 mm', 'ok'], ['[job] 1) Eclipse에서 Tools > Scripts > EMBridge 를 두 번 실행합니다.']];
    const CMP_LOG = () => [
      ['[beamdose] ' + BM.name.replace('_L', '') + ': Eclipse ' + BM.eclipse_mu.toFixed(0) + ' MU -> 계획 ' + f2(BM.target_mu) + ' MU (x' + BM.factor.toFixed(4) + ')'],
      ['[cbct] iso_shift_mm (' + SH + ')만큼 되돌려 계획 CT 좌표로 올림', 'ok'],
      ['[cbct] 오늘 구조 ' + R.structures.length + '개를 같은 거리만큼 옮겨 읽었습니다'],
      ['[예시] 기준(_RF) 실행 전 · 아래 감마와 표는 예시 값입니다', 'err'],
    ];
    function fillResult() {
      resLab.innerHTML = '';
      resLab.className = '';
      const l1 = h('div'); l1.style.fontWeight = '700'; l1.style.color = '#EF4444';
      l1.appendChild(document.createTextNode('감마 3%/2mm (global, cutoff 10%): 통과율 ' + EXAMPLE.gamma.toFixed(1) + ' %'));
      l1.appendChild(h('span', 'ec-ex', '예시'));
      const l2 = h('div', 'ec-muted', '실측: 변형 CT 위 계산 · 좌표 이동 (' + SH + ') mm가 헤더 · Eclipse 정합 · 플러그인 세 경로에서 일치\n예시: 기준(계획 CT 재계산 _RF)을 아직 Eclipse에서 돌리지 않아 감마 · 표는 예시입니다');
      resLab.append(l1, l2);
      exBody.innerHTML = '';
      EXAMPLE.rows.forEach((r) => { const tr = h('tr'); r.forEach((v, i) => tr.appendChild(h('td', cols[i][2] || null, v))); exBody.appendChild(tr); });
      exTv.style.display = ''; exTv.classList.add('ec-exbox');
    }
    function viewDeform(tab) {
      pv.setTabs(['계획 CT', '변형 CT (오늘 몸)', '겹쳐 보기'], tab, (i) => viewDeform(i));
      const sets = [[{ img: I.plan_ct }], [{ img: I.def_ct }], [{ img: I.overlay }]][tab];
      const txt = ['계획 CT: 치료 계획을 세운 날의 몸', '변형 CT: 오늘 CBCT 모양 + 계획 CT의 HU (SmartAdapt)', '자주색 = 계획 CT · 초록 = 변형 CT · 겹치면 회색'][tab];
      pv.set({ title: 'SmartAdapt 변형 결과 (Eclipse에서 만든 영상)', tab, sets, legend: 'jet', legendText: '공개 데이터 (TCIA) · 테스트용',
        text: txt, sub: '변형 CT는 CBCT가 찍힌 범위까지만: ' + R.body_span_mm + ' / ' + R.image_span_mm + ' mm' });
      pv.el.querySelector('.ec-view-foot .bar').style.background = '#333';
    }
    function viewDose() {
      pv.setTabs(['계획 CT 선량', '오늘 몸 선량'], 0);
      pv.set({ title: 'Plan View: Recon (기준 계획 CT · 대상 변형 CT)', tab: -1,
        sets: [{ img: I.dose_plan, label: '계획 CT' }, { img: I.dose_cbct, label: '오늘 몸' }], legend: 'jet', legendText: '0 → ' + D.dmax.plan.toFixed(1) + ' Gy (계획 최대 기준, 같은 색 눈금)',
        text: '위: 계획 CT 위 선량 · 아래: 변형 CT 위에서 Eclipse가 새로 계산한 선량 (둘 다 실제 계산)',
        sub: '같은 플랜 · 같은 MU · 몸만 다름 → 3D 전체에서 차이를 봄 · 아래쪽이 짙은 이유 중 하나: 몸이 영상을 다 채우지 않음 (앱이 경고)' });
      pv.tab(0).classList.add('on'); pv.tab(1).classList.add('on');
    }

    async function press(el, t, fx, fy) { await moveTo(at(el, fx, fy), t, 600); el.classList.add('hot'); await wait(140, t); await click(t); el.classList.remove('hot'); }
    async function lines(arr, fn, t, ms) { for (const l of arr) { fn(l[0], l[1]); await wait(ms || 260, t); } }
    async function eclipseRun(t, label, ex) {
      ecl.reset('job: ' + label); ecl.show(true);
      await wait(250, t);
      await moveTo(at(ecl.rows[0], 0.4, 0.5), t, 500); ecl.select(0); await click(t);
      await press(ecl.run, t);
      const P = ex ? [
        ['계획 CT 위 기준 계산 (_RF)', 50, ['{"event":"progress","step":"calculate","pct":50}', 'j'], ['[예시] 이 실행은 아직 Eclipse에서 돌리지 않았습니다', 'ex']],
        ['기준 선량 내보내기', 100, ['[예시] 실행하면 같은 모델 · 같은 MU로 계획 CT 위 선량이 나옵니다', 'ex']],
      ] : [
        ['환자 열기 · 원본 플랜 찾기', 10, ['{"event":"progress","step":"open_patient","pct":10}', 'j'], ['OpenPatientById("' + PID + '") → ' + COURSE + ' / ' + PLAN]],
        ['변형 CT의 구조 세트 위에 새 플랜', 30, ['{"event":"progress","step":"copy_plan","pct":30}', 'j'], ['target structure set = 보낸 변형 CT · Course DM_CBCT → ' + PLAN + '_CB']],
        ['아이소센터 옮기기', 45, ['iso_shift_mm = (' + SH + ')', 'i'], ['= DICOM 원점 차이 = Eclipse 정합 행렬 (세 경로 일치, 실측)', 'ok']],
        ['Eclipse AAA로 3D 선량 계산', 75, ['{"event":"progress","step":"calculate","pct":75}', 'j'], ['Anisotropic Analytical Algorithm (Version 15.6.06) · 2.5 mm', 'i']],
        ['선량 내보내기 · 빔별 합 검사', 100, ['beam_dose_check diff 0 %', 'ok'], ['{"event":"result","ok":true,"mode":"recon"}', 'ok']],
      ];
      for (const p of P) { ecl.step(p[0], p[1]); for (const l of p.slice(2)) { ecl.line(l[0], l[1]); await wait(220, t); } await wait(320, t); }
      if (ex) ecl.foot('예시 · 아직 실행하지 않은 단계');
      else ecl.foot('완료 · 선량 격자가 변형 CT 좌표계 위에 있음 (원점 z = −130.5 mm)');
    }

    const steps = [
      { fill() {},
        async run(t) {
          begin(0);
          viewDeform(0); pv.show(true);
          await moveTo(at(pv.el, 0.3, 0.5), t, 500); await wait(1700, t);
          await press(pv.tab(1), t); viewDeform(1);
          say('변형 CT = 오늘 몸 모양 (CBCT) + 계획 CT의 HU', 'CBCT는 HU가 부정확해 그대로 계산하면 안 됨 → 변형으로 해결');
          await wait(2600, t);
          await press(pv.tab(2), t); viewDeform(2);
          say('겹쳐 보면 몸 모양이 얼마나 달라졌는지 보입니다', '자주색 = 계획 · 초록 = 오늘');
          await wait(2400, t);
          await press(pv.x, t); pv.show(false);
        } },
      { fill() { REPORT().forEach((l) => repLine(l[0], l[1])); prevImg.src = 'data/' + I.def_ct.ax.file; prevImg.style.display = ''; sliceLab.textContent = 'z = 가운데 (' + (R.n_ct / 2) + ' / ' + R.n_ct + ')'; bSend.classList.remove('dis'); log('[check] 문제 없음 · 경고 ' + R.warnings.length + '개', 'ok'); },
        async run(t) {
          begin(1);
          await press(bCheck, t);
          await lines(REPORT(), repLine, t, 300);
          prevImg.src = 'data/' + I.def_ct.ax.file; prevImg.style.display = ''; sliceLab.textContent = 'z = 가운데 (' + (R.n_ct / 2) + ' / ' + R.n_ct + ')';
          bSend.classList.remove('dis'); log('[check] 문제 없음 · 경고 ' + R.warnings.length + '개', 'ok');
          await moveTo(at(rep.lastChild, 0.3, 0.5), t, 500);
          say('경고: 몸이 영상을 다 채우지 않음 (309 / 399 mm)', 'CBCT 범위 밖은 비어 있음 → 빔이 지나가면 선량이 과대 · 앱이 미리 알려 줌');
          await wait(2800, t);
        } },
      { fill() { SEND_LOG.forEach((l) => log(l[0], l[1])); chkSent.classList.add('on'); bJob.classList.remove('dis'); },
        async run(t) {
          begin(2);
          await press(bSend, t);
          await lines(SEND_LOG, log, t, 420);
          chkSent.classList.add('on'); bJob.classList.remove('dis');
          await moveTo(at(logEl, 0.4, 0.6), t, 450);
          say('Eclipse가 받은 영상을 환자에 자동으로 붙입니다', '임포트 창 없음 · TBox 실측 (2026-09-19)');
          await wait(2200, t);
        } },
      { fill() { JOB_LOG.forEach((l) => log(l[0], l[1])); },
        async run(t) {
          begin(3);
          await press(bJob, t);
          await lines(JOB_LOG, log, t, 300);
          await moveTo(at(logEl, 0.4, 0.7), t, 450);
          say('지시서 두 개: 오늘 몸(_CB)과 계획 몸(_RF)', '같은 엔진 · 같은 경로로 계산해야 몸 차이만 남음');
          await wait(2200, t);
          await eclipseRun(t, PLAN + '_CB  (변형 CT 위)', false);
          await moveTo(at(ecl.el, 0.68, 0.5), t, 450);
          say('변형 CT 위 계산: 실제로 끝까지 돌았음 (TBox 2026-09-20)', '좌표 이동값이 세 경로에서 소수점까지 일치');
          await wait(2600, t);
          await eclipseRun(t, PLAN + '_RF  (계획 CT 위)', true);
          await moveTo(at(ecl.el, 0.68, 0.5), t, 450);
          say('기준(_RF) 실행은 아직 안 해 봤습니다', '그래서 다음 단계의 감마 · 표 숫자는 예시입니다');
          await wait(2600, t);
          await press(ecl.x, t); ecl.show(false);
        } },
      { fill() { CMP_LOG().forEach((l) => log(l[0], l[1])); fillResult(); viewDose(); pv.show(true); },
        async run(t) {
          begin(4);
          await press(bCmp, t);
          await lines(CMP_LOG(), log, t, 380);
          viewDose(); pv.show(true);
          await moveTo(at(pv.el, 0.5, 0.45), t, 500);
          say('위: 계획 CT 위 선량 · 아래: 오늘 몸 위에서 Eclipse가 새로 계산', '두 선량 모두 실제 계산 · 3D 격자 전체 (축 · 관상 · 시상)');
          await wait(3200, t);
          await press(pv.x, t); pv.show(false);
          fillResult();
          await moveTo(at(resLab, 0.3, 0.2), t, 450);
          say('감마 · 구조별 선량 변화 → 재계획 판단에 씀', '여기 숫자는 예시 (빨간 표시) · 기준 계산 후 실제 값으로 바뀜');
          await wait(2800, t);
          await moveTo(at(exTv, 0.5, 0.5), t, 450);
          say('오늘 구조로 D95 · 평균선량 변화를 봅니다', '오늘 부피 [%] < 100 → 영상이 구조를 다 덮지 못함 (경고 신호)');
          await wait(2600, t);
        } },
      { fill() {},
        async run(t) {
          begin(5);
          await moveTo(at(resLab, 0.5, 0.6), t, 450);
          say('같은 플랜, 몸만 오늘 것 → Eclipse가 3D 전체를 재계산', '한계: 변형 CT는 계획 CT의 HU → 가스 · 무기폐 같은 밀도 변화는 안 보임');
          await wait(3200, t);
          markSteps(5, -1);
          say(LAST, '실측: 검사 · 전송 · 변형 CT 위 계산까지 / 예시: 기준 비교 숫자');
        } },
    ];

    function setFor(i) { resetUI(); for (let k = 0; k <= i; k++) steps[k].fill(); O.settle(i, LAST); }
    resetUI();
    ecl.x.addEventListener('click', () => ecl.show(false));

    const imgs = Object.values(I).flatMap((s) => Object.values(s)).map((v) => 'data/' + v.file);
    let left = imgs.length, readyFlag = false;
    imgs.forEach((src) => { const im = new Image(); im.onload = im.onerror = () => { if (--left <= 0) readyFlag = true; }; im.src = src; });

    const player = DM.Player ? new DM.Player({ steps, render(k) { if (!destroyed) setFor(k); }, onChange() {} }) : null;
    return { player, get ready() { return readyFlag; }, destroy() { destroyed = true; if (player) player.destroy(); O.destroy(); } };
  }

  DM.windows.cbct = { title: 'CBCT 조직변화 선량', width: W, height: H, theme: 'cbct', mount, STEPS, EXAMPLE };
})(typeof window !== 'undefined' ? window : globalThis);
