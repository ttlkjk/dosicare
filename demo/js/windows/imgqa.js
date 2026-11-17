/* Image QA windows (every Image QA menu item) with a self-playing walkthrough.

   Real: each window is the original DosiMachine window, photographed by bake/bake_imgqa.py while it ran on the
   RIT demo images - its own LOAD / AUTO ANALYSIS buttons pressed, one grab after every step (data/imgqa.js,
   data/imgqa/*.webp). Every number on screen is what DosiMachine computed.
   Not in the original: the cursor, captions and step strip, the scan line while "analysing", and the result rows
   appearing one by one (the original fills its table at once). The pressed buttons get the blue lecture box and can
   be clicked to go one step on. */
(function (root) {
  const DM = root.DM = root.DM || {};
  DM.windows = DM.windows || {};
  const D = () => (root.DM_DATA && root.DM_DATA.imgqa) || {};

  // what each phantom checks, said while its analysis runs (lecture text, not from the original)
  const INTRO = {
    acr1: ['모듈 1: 재질별 CT 번호(HU)', '물 · 공기 · 뼈 · 아크릴 · 폴리에틸렌 ROI를 자동으로 찾아 허용 범위와 비교'],
    acr2: ['모듈 2: 저대조도 검출능', '25 mm 원판과 배경의 대조도 대 잡음비(CNR) 계산'],
    acr3: ['모듈 3: 균일도와 잡음', '가운데 · 가장자리 ROI의 HU 차이와 표준편차'],
    acr4: ['모듈 4: 고대조도 해상도', '막대 패턴이 몇 lp/cm까지 보이는지 판정'],
    ctwater: ['물 팬텀 균일도', '가운데와 가장자리 4곳의 HU 차이'],
    ctp404: ['CTP404: 재질별 HU · 선형성', '8개 재질 ROI를 찾아 공칭값과 비교하고 직선 맞춤'],
    ctp486: ['CTP486: 균일도', '가운데와 가장자리 HU 차이 · 잡음'],
    ctp515: ['CTP515: 저대조도', '보이는 원판 개수와 CNR'],
    ctp528: ['CTP528: 해상도', '막대 패턴의 MTF · 보이는 lp/cm'],
    xvi: ['Elekta XVI CBCT의 CATPHAN 세 단면', '탭마다 단면을 불러오면 바로 분석'],
    siemens: ['Siemens MV CT 다섯 가지 시험', '탭마다 단면을 불러오면 바로 분석'],
    ptwed: ['PTW 전자밀도 팬텀: 플러그 19개 HU', '플러그 판을 자동으로 맞춰 HU 표와 비교 · 영상은 합성'],
    ptwruby: ['PTW RUBY 삽입물: 앞 · 뒤 면 플러그 18개', '앞면 · 뒷면 영상을 각각 불러와 HU 표와 비교 · 영상은 합성'],
    gammex: ['Gammex 467: 전자밀도 플러그 HU', '플러그 위치를 자동으로 찾아 HU 표와 비교'],
    cirs062: ['CIRS 062: 전자밀도 플러그 HU', '플러그 위치를 자동으로 찾아 HU 표와 비교'],
    cheese: ['토모 치즈 팬텀: 재질 플러그 HU', '플러그별 평균 HU · 표준편차'],
    cheeseres: ['토모 치즈 팬텀: 해상도', '구멍 패턴이 어디까지 구분되는지'],
    cheesenu: ['토모 치즈 팬텀: 잡음 · 균일도', 'ROI별 HU 차이와 잡음'],
    ge: ['GE 팬텀 세 가지 시험', '탭마다 단면을 불러오면 바로 분석'],
    leeds: ['Leeds 치과 CBCT 팬텀 다섯 가지 시험', '탭마다 단면을 불러오면 바로 분석'],
    ptwepid: ['PTW EPID QC 팬텀', '대조도 · 해상도(MTF) · 균일도를 한 장에서'],
    qc3: ['QC-3 EPID 팬텀', '막대 패턴 MTF · 대조도 · 잡음'],
    lasvegas: ['Las Vegas 팬텀: 구멍 28개의 CNR', '구멍 격자를 자동으로 찾아 행 · 열별 판정'],
    ritepid: ['RIT EPID 팬텀', '막대 패턴과 대조도 단계'],
    primusl: ['IBA Primus L (kV)', '막대 패턴 해상도 · 대조도 단계'],
    normi4: ['PTW NORMI 4 (kV)', '해상도 · 저대조도 원판 · 계조'],
    tor18: ['Leeds TOR18-FG (kV)', '원판 18개 대조도 · 막대 해상도'],
    qckv1: ['QCkV-1 (kV)', '막대 패턴 MTF · 대조도 · 잡음'],
    iso1: ['IsoCube 시험 1: kV · MV 중심 일치', 'MV · kV 영상에서 팬텀 중심을 찾아 차이 계산'],
    iso2: ['IsoCube 시험 2: CBCT 중심', 'CBCT에서 중심 구의 위치'],
    iso3: ['IsoCube 시험 3: kV 콜리메이션', 'kV 조사야 가장자리와 팬텀 표시 비교'],
    iso4: ['IsoCube 시험 4: MV 방사선 · 광조사야 일치', 'MV 영상의 조사야 가장자리 비교'],
    iso6dof: ['IsoCube 6 DOF 카우치', 'CBCT · kV · MV 영상 세트로 회전 · 이동 오차'],
    pg1: ['PentaGuide 시험 1: DRR · MV · kV 일치', 'DRR을 기준으로 MV · kV 영상의 중심 차이'],
    pg2: ['PentaGuide 시험 2: CT vs CBCT', '두 영상에서 가운데 구의 위치 차이'],
  };

  // No PTW image exists (DosiMachine HANDOFF-ptw-ed.md): these two run on DosiMachine's own synthetic test phantom,
  // plugs at RIT's target HU, so PASS is by construction. Shown on screen in red.
  const SYNTH_TEXT = '합성 영상 · 실제 PTW 영상 없음 · 플러그를 목표 HU로 만든 가상 팬텀이라 PASS는 당연 · 동작 흐름만 보여 줌';
  const SYNTH = { ptwed: SYNTH_TEXT, ptwruby: SYNTH_TEXT };

  const h = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const rowsKey = (st) => JSON.stringify((st.trees || []).map((t) => t.rows.map((r) => r.v)));
  const nRows = (st) => (st.trees || []).reduce((n, t) => n + t.rows.length, 0);
  const area = (r) => r[2] * r[3];
  const short = (t) => t.replace(/\s*\(.*\)$/, '').replace(/^LOAD\s+/i, '').trim();

  function mount(key, body) {
    const it = D()[key];
    if (!it) { body.appendChild(h('div', null, 'Image QA 데이터가 없습니다 (bake_imgqa.py).')); return { destroy() {} }; }
    const W = it.w, H = it.h, S = it.steps;
    const src = (f) => 'data/imgqa/' + f;
    let destroyed = false;

    const app = h('div', 'iq-app');
    app.style.width = W + 'px'; app.style.height = H + 'px';
    const base = h('img', 'iq-base'); base.alt = ''; base.draggable = false;
    const layer = h('div', 'iq-layer');
    const hot = h('div', 'iq-hotbox');
    app.append(base, layer, hot);
    if (SYNTH[key]) app.appendChild(h('div', 'iq-synth', SYNTH[key]));
    body.appendChild(app);

    // walkthrough steps: a tab change is folded into the press that follows it
    const plan = [];
    for (let i = 1; i < S.length; i++) {
      const u = S[i].used || {};
      const last = plan[plan.length - 1];
      if (u.kind === 'tab') { plan.push({ idx: [i], tab: u.text }); continue; }
      if (last && last.tab && last.idx.length === 1 && S[last.idx[0]].used.kind === 'tab') last.idx.push(i);
      else plan.push({ idx: [i] });
    }
    plan.forEach((p) => {
      const u = S[p.idx[p.idx.length - 1]].used;
      const nb = (S[p.idx[0] - 1].tabs || [])[0];          // multi-test window: name the first test by its open tab
      const tabName = /\(THIS /i.test(u.text) && nb && nb.tabs.length > 1 && nb.sel != null && nb.tabs[nb.sel] ? nb.tabs[nb.sel].text : null;
      p.title = p.tab ? p.tab : /ANALY|^RUN$/i.test(u.text) ? '자동 분석' : tabName || '불러오기 ' + short(u.text);
    });
    const intro = INTRO[key] || [it.path.split(' > ').pop(), ''];
    const STEPS = plan.map((p) => ({ t: p.title, cap: p.title, sub: '' })).concat([{ t: '결과', cap: '결과', sub: '' }]);
    const O = DM.demoOverlay(app, { W, H, title: 'Image QA', steps: STEPS });
    const { at, say, wait, moveTo, click, begin } = O;

    const piece = (shot, r, cls) => {
      const d = h('div', 'iq-piece' + (cls ? ' ' + cls : ''));
      Object.assign(d.style, { left: r[0] + 'px', top: r[1] + 'px', width: r[2] + 'px', height: r[3] + 'px' });
      if (shot) { d.style.backgroundImage = 'url("' + src(shot) + '")'; d.style.backgroundPosition = (-r[0]) + 'px ' + (-r[1]) + 'px'; d.style.backgroundSize = W + 'px ' + H + 'px'; }
      layer.appendChild(d); return d;
    };
    const showShot = (i) => { layer.innerHTML = ''; base.src = src(S[i].shot); markButtons(i); };
    const fade = (d, ms) => { d.style.transition = 'opacity ' + ms + 'ms'; d.getBoundingClientRect(); d.style.opacity = '0'; };

    // blue lecture boxes on the buttons the walkthrough presses next; clicking one goes on
    const boxes = [];
    function markButtons(shownIdx) {
      boxes.forEach((b) => b.remove()); boxes.length = 0;
      const nextPlan = plan.find((p) => p.idx[0] > shownIdx);
      if (!nextPlan) return;
      nextPlan.idx.forEach((j) => {
        const r = S[j].used.r;
        const b = h('div', 'iq-btnbox dm-clickable');
        Object.assign(b.style, { left: r[0] + 'px', top: r[1] + 'px', width: r[2] + 'px', height: r[3] + 'px' });
        b.title = '눌러서 다음 단계';
        b.addEventListener('click', () => { if (player) player.next(); });
        app.appendChild(b); boxes.push(b);
      });
    }

    async function press(r, t) {
      await moveTo(at(app, (r[0] + r[2] / 2) / W, (r[1] + r[3] / 2) / H), t, 650);
      Object.assign(hot.style, { left: r[0] + 'px', top: r[1] + 'px', width: r[2] + 'px', height: r[3] + 'px', display: 'block' });
      await wait(150, t); await click(t);
      hot.style.display = 'none';
    }

    // analysis result arriving: scan over the image, then rows, charts and the status label appear in turn
    async function reveal(i, prevIdx, t) {
      const st = S[i], prev = S[prevIdx];
      const figs = (st.figs || []).slice().sort((a, b) => area(b.r) - area(a.r));
      const main = figs[0];
      layer.innerHTML = '';
      const old = main ? piece(prev.shot, main.r, 'iq-old') : null;
      const rowCovers = [];
      (st.trees || []).forEach((tr) => tr.rows.forEach((row) => rowCovers.push({ d: piece(null, row.r, 'iq-cover'), row })));
      const prevFigs = new Set((prev.figs || []).map((f) => f.r.join(',')));
      const chartCovers = figs.slice(1).filter((f) => !prevFigs.has(f.r.join(',')) || prev.shot !== st.shot).map((f) => piece(null, f.r, 'iq-cover'));
      const labCovers = (st.labels || []).map((l) => piece(prev.shot, l.r, 'iq-old'));
      base.src = src(st.shot);
      markButtons(i);
      if (old) {
        const r = main.r;
        const line = piece(null, [r[0], r[1], r[2], 3], 'iq-scan');
        await DM.anim.tween(1300, (k) => {
          old.style.clipPath = 'inset(' + (k * 100).toFixed(2) + '% 0 0 0)';
          line.style.top = (r[1] + r[3] * k) + 'px';
        }, t);
        old.remove(); line.remove();
      }
      const rows = (st.trees || []).flatMap((tr) => tr.rows);
      if (rowCovers.length) {
        const pass = rows.filter((r) => r.v.some((v) => /^PASS$/i.test(v))).length;
        const fail = rows.filter((r) => r.v.some((v) => /^FAIL$/i.test(v))).length;
        await moveTo(at(app, (rowCovers[0].row.r[0] + rowCovers[0].row.r[2] * 0.5) / W, (rowCovers[0].row.r[1] + 30) / H), t, 500);
        say('결과표 ' + rows.length + '줄' + (pass + fail ? ' · PASS ' + pass + (fail ? ' · FAIL ' + fail : '') : ''), '숫자는 모두 DosiMachine이 이 영상에서 실제로 계산한 값');
        const step = Math.max(60, Math.min(220, 2400 / rowCovers.length));
        for (const c of rowCovers) { fade(c.d, 200); await wait(step, t); }
      }
      chartCovers.forEach((c) => fade(c, 600));
      if (chartCovers.length) await wait(700, t);
      if (labCovers.length) {
        const l = st.labels[0];
        await moveTo(at(app, (l.r[0] + l.r[2] / 2) / W, (l.r[1] + l.r[3] / 2) / H), t, 550);
        labCovers.forEach((c) => fade(c, 300));
        const fl = piece(null, l.r, 'iq-flash');
        say(l.text, '허용 기준과 비교한 종합 판정');
        await wait(1500, t); fl.remove();
      }
    }

    const steps = plan.map((p, k) => ({
      async run(t) {
        begin(k);
        let prevIdx = p.idx[0] - 1;
        for (const i of p.idx) {
          const u = S[i].used;
          const analysing = /ANALY|^RUN$/i.test(u.text);
          if (u.kind === 'tab') say('탭: ' + u.text, '시험마다 탭이 따로 있음');
          else if (analysing) say(intro[0], intro[1]);
          else say('불러오기: ' + short(u.text), 'DICOM 영상을 읽어 화면에 표시');
          await press(u.r, t);
          const results = nRows(S[i]) > 0 && rowsKey(S[i]) !== rowsKey(S[prevIdx]);
          if (results) {
            if (!analysing && u.kind !== 'tab') { say('불러오면 바로 분석합니다', intro[0]); }
            await wait(300, t);
            await reveal(i, prevIdx, t);
          } else {
            const old = piece(S[prevIdx].shot, [0, 0, W, H], 'iq-old');
            base.src = src(S[i].shot); markButtons(i);
            fade(old, 380); await wait(1100, t); old.remove();
          }
          prevIdx = i;
        }
      },
    })).concat([{
      async run(t) {
        begin(plan.length);
        const st = S[S.length - 1];
        const tr = (st.trees || [])[0];
        if (tr) await moveTo(at(app, (tr.r[0] + tr.r[2] / 2) / W, (tr.r[1] + Math.min(tr.r[3], 160) / 2) / H), t, 500);
        say('원본 DosiMachine 화면 그대로 · ' + it.path.split(' > ').pop(), 'GENERATE PDF REPORT로 결과지까지 · Space: 다시 보기');
        await wait(2500, t);
        O.markSteps(plan.length, -1);
      },
    }]);

    const LAST = '시연 끝 · RIT 데모 영상 · DosiMachine 실제 계산값';
    function setFor(i) {
      const shotIdx = i < 0 ? 0 : i >= plan.length ? S.length - 1 : plan[i].idx[plan[i].idx.length - 1];
      showShot(shotIdx);
      hot.style.display = 'none';
      O.settle(i, LAST);
    }
    showShot(0);

    const files = Array.from(new Set(S.map((s) => s.shot)));
    let left = files.length, readyFlag = false;
    files.forEach((f) => { const im = new Image(); im.onload = im.onerror = () => { if (--left <= 0) readyFlag = true; }; im.src = src(f); });
    const player = DM.Player ? new DM.Player({ steps, render(k) { if (!destroyed) setFor(k); }, onChange() {} }) : null;
    return { player, get ready() { return readyFlag; }, destroy() { destroyed = true; if (player) player.destroy(); O.destroy(); } };
  }

  // one live window per baked item: DM.windows['iq-<id>'], opened from the Image QA menu (menu-def.js)
  Object.keys(D()).forEach((key) => {
    const it = D()[key];
    DM.windows['iq-' + key] = { title: it.path.split(' > ').pop(), width: it.w, height: it.h, theme: 'imgqa', mount: (b) => mount(key, b) };
  });
  DM.imgqaIntro = INTRO;
})(typeof window !== 'undefined' ? window : globalThis);
