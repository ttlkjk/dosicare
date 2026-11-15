/* Plan Check report window (Plan View > bottom Plan Check tab > Open Report Window) with a self-playing walkthrough.
   Built from the original window's captures (DosiCare/screens/pc_*.png), not a re-implementation:
   bake/bake_plancheck.py stitches the seven captures of the scrolling page into one tall image and keeps the
   window chrome (left sidebar, green bar, section list) of the first one. The demo scrolls that page.

   On open the window plays by itself (winman autoRun): a fake cursor reads the summary, then clicks each entry of
   the original's section list (the page scrolls there as in the original), opens a structure's 3D view, the
   collision 3D view and shows the PDF page Export PDF makes. Space pauses, arrows step, like the other live windows.
   While paused the section list, the structure name, 3D view and Export PDF can be clicked by hand.
   Not in the original: the cursor, the captions and the step card (demo overlay). The save dialog of Export PDF
   is skipped; the PDF page shown is the one the original made for this plan. */
(function (root) {
  const DM = root.DM = root.DM || {};
  DM.windows = DM.windows || {};

  const W = 1707, H = 996;
  // section list (right) and sidebar buttons, in window px (capture px - 23 px OS title bar)
  const NAV = {
    constraints: [1512, 99, 'Constraints'], dvh: [1512, 130, 'DVH'], eclipse: [1512, 161, 'Eclipse DVH'],
    structures: [1512, 192, 'Structure Checks'], plan: [1512, 223, 'Plan Checks'], policy: [1512, 254, 'Site Policy'],
    collision: [1512, 285, 'Collision Check'],
  };
  const NAV_W = 112, NAV_H = 22;
  const BTN_EXPORT = [10, 677, 240, 37];
  const CHIPS = [1540, 12, 160, 26];
  // places on the stitched page (page px): [x, y, w, h]
  const SPOT = {
    ptvResult: [1095, 74, 50, 120],          // Result column of the four PTV rows
    tumorbed: [1095, 210, 50, 42],           // ⚠ Tumorbed (structure not in the plan)
    dvhMark: [797, 560, 16, 16],             // V95% marker on the PTV curve
    eclipse: [30, 1100, 1140, 230],          // Eclipse cross-check table
    ptvLink: [32, 1722, 84, 18],             // PTV_EVAL_EZ1 (opens its 3D view)
    planHot: [480, 2096, 160, 20],           // Plan Hotspot: 2119 cGy (106.0 % of Rx)
    policy: [120, 2340, 960, 420],           // Site Policy table
    collision: [30, 3222, 970, 66],          // collision rows
    view3d: [494, 3296, 44, 18],             // 3D view button
  };
  const STEPS = [
    { t: '한눈에 보기', cap: '① 창을 열면 점검이 이미 끝나 있습니다', sub: '위: 제약 판정 개수 · 오른쪽: 구역별 결과 아이콘' },
    { t: '선량 제약 판정', cap: '② 제약마다 목표값 · 한계값 두 단계로 판정', sub: 'FAST-Forward 유방 템플릿을 샘플 플랜에 적용' },
    { t: 'DVH 위 제약 지점', cap: '③ [DVH]: 제약 지점이 곡선 위에 찍힙니다', sub: '결과 색: 초록 합격 · 파랑 Variation · 빨강 불합격' },
    { t: 'Eclipse DVH 교차 확인', cap: '④ [Eclipse DVH]: Eclipse가 내보낸 DVH와 비교', sub: '플랜의 좋고 나쁨이 아니라, 계산이 Eclipse와 맞는지 확인' },
    { t: '구조물 점검 → 3D', cap: '⑤ [Structure Checks]: 구조물마다 점검', sub: '작은 조각 · 구멍 · 빠진 슬라이스 · BODY 밖 윤곽' },
    { t: '계획 점검', cap: '⑥ [Plan Checks]: 빔 · 처방 · 플랜 설정', sub: '기대값과 플랜 값을 한 줄씩 비교' },
    { t: '기관 기준 편집', cap: '⑦ [Site Policy]: 우리 기관 기준을 표에서 바로 고칩니다', sub: '23가지 규칙 · 저장하면 다음 점검부터 적용' },
    { t: '충돌 예측 (개발 중)', cap: '⑧ [Collision Check]: 필드별 최소 여유 거리', sub: '개발 중 · 헤드를 원기둥으로 단순화한 추정입니다' },
    { t: 'PDF 리포트', cap: '⑨ [Export PDF...] 한 번으로 A4 리포트', sub: '시연에서는 저장 창을 건너뛰고, 만들어진 1쪽을 보여 줍니다' },
  ];
  // page scroll at the end of each step (the section its click lands on)
  const STEP_SECTION = ['constraints', 'constraints', 'dvh', 'eclipse', 'structures', 'plan', 'policy', 'collision', 'collision'];

  const h = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const box = (cls, r) => {
    const e = h('div', cls);
    e.style.left = r[0] + 'px'; e.style.top = r[1] + 'px'; e.style.width = r[2] + 'px'; e.style.height = r[3] + 'px';
    return e;
  };
  const img = (src) => { const im = h('img'); im.src = src; im.alt = ''; im.draggable = false; return im; };

  // thumb of the page's vertical scrollbar (pure; tested in node): top and height in window px
  function thumbFor(D, scrollTop) {
    const track = D.scrollbar.y1 - D.scrollbar.y0;
    const len = Math.max(20, Math.round(track * D.page.h / D.doc_h));
    const max = D.doc_h - D.page.h;
    return { top: D.scrollbar.y0 + Math.round((track - len) * (max > 0 ? scrollTop / max : 0)), height: len };
  }

  function mount(body) {
    const D = root.DM_DATA && root.DM_DATA.plancheck;
    if (!D) { body.appendChild(h('div', 'pc-msg', 'Plan Check 데이터가 없습니다 (bake_plancheck.py).')); return { destroy() {} }; }
    let destroyed = false;

    /* ---------------- layout: captured chrome + scrolling page ---------------- */
    const app = h('div', 'pc-app');
    const frame = img('data/plancheck_frame.png'); frame.className = 'pc-frame';
    const page = box('pc-page', [D.page.x, D.page.y, D.page.w, D.page.h]);
    const doc = h('div', 'pc-doc');
    const docImg = img('data/plancheck_doc.png');
    doc.appendChild(docImg);
    page.appendChild(doc);
    const spots = {};
    Object.keys(SPOT).forEach((k) => { spots[k] = box('pc-spot', SPOT[k]); doc.appendChild(spots[k]); });
    const thumb = h('div', 'pc-thumb');
    thumb.style.left = (D.scrollbar.x + 1) + 'px'; thumb.style.width = (D.scrollbar.w - 2) + 'px';
    const nav = {};
    Object.keys(NAV).forEach((k) => { const [x, y] = NAV[k]; nav[k] = box('pc-hot', [x, y, NAV_W, NAV_H]); });
    const bExport = box('pc-hot', BTN_EXPORT);
    const chips = box('pc-hot', CHIPS);
    app.append(frame, page, thumb, chips, bExport, ...Object.values(nav));

    // popups: the two 3D windows (captures with their own title bar) and the PDF page
    const POP_W = 1400, POP_K = POP_W / 1707;
    function popup(src) {
      const over = h('div', 'pc-over');
      const win = h('div', 'pc-popwin');
      win.style.width = POP_W + 'px';
      const im = img(src); im.style.width = POP_W + 'px';
      const x = box('pc-popx', [Math.round(1662 * POP_K), 0, Math.round(45 * POP_K), Math.round(22 * POP_K)]);
      win.append(im, x);
      over.appendChild(win);
      app.appendChild(over);
      return { over, x, im };
    }
    const pop3d = popup('data/plancheck_s3d.png');
    const popC3d = popup('data/plancheck_c3d.png');
    const pdfOver = h('div', 'pc-over');
    const pdf = h('div', 'pc-pdf');
    const pdfHead = h('div', 'pc-pdf-head');
    const pdfX = h('span', 'pc-pdf-x', '×');
    pdfHead.append(h('span', null, 'Plan Check PDF 리포트 · 1쪽'), pdfX);
    const pdfBody = h('div', 'pc-pdf-body');
    const pdfImg = img('data/plancheck_report.png');
    pdfBody.appendChild(pdfImg);
    pdf.append(pdfHead, pdfBody);
    pdfOver.appendChild(pdf);
    app.appendChild(pdfOver);
    const pops = [pop3d.over, popC3d.over, pdfOver];

    body.appendChild(app);
    const O = DM.demoOverlay(app, { W, H, title: '자동 시연 · Plan Check 리포트 창', steps: STEPS });
    const { at, say, wait, moveTo, click, scrollTo, markSteps, begin, later } = O;

    const paintThumb = () => { const t = thumbFor(D, page.scrollTop); thumb.style.top = t.top + 'px'; thumb.style.height = t.height + 'px'; };
    page.addEventListener('scroll', paintThumb);
    page.addEventListener('wheel', (e) => { e.preventDefault(); page.scrollTop += e.deltaY; }, { passive: false });
    const clearHot = () => app.querySelectorAll('.hot').forEach((e) => e.classList.remove('hot'));
    const closePops = () => pops.forEach((p) => p.classList.remove('on'));
    function flash(el) { el.classList.add('flash'); later(() => el.classList.remove('flash'), 1400); }

    // by hand (while paused): section list, structure name, 3D view, Export PDF, popup close
    const smooth = (top) => scrollTo(page, top, null, 600).catch(() => {});
    Object.keys(nav).forEach((k) => nav[k].addEventListener('click', () => smooth(D.sections[k])));
    spots.ptvLink.addEventListener('click', () => pop3d.over.classList.add('on'));
    spots.view3d.addEventListener('click', () => popC3d.over.classList.add('on'));
    bExport.addEventListener('click', () => { pdfBody.scrollTop = 0; pdfOver.classList.add('on'); });
    [pop3d.x, popC3d.x, pdfX].forEach((x) => x.addEventListener('click', closePops));
    pops.forEach((p) => p.addEventListener('click', (e) => { if (e.target === p) closePops(); }));

    /* ---------------- the walkthrough ---------------- */
    async function press(el, t, fx, fy) {
      await moveTo(at(el, fx, fy), t, 650); el.classList.add('hot'); await wait(150, t);
      await click(t);
      el.classList.remove('hot');
    }
    async function goSection(key, t) {
      await press(nav[key], t, 0.3);
      await scrollTo(page, D.sections[key], t, 600);
      await wait(150, t);
    }
    async function point(spot, text, sub, t, ms, fx, fy) {
      await moveTo(at(spots[spot], fx == null ? 0.5 : fx, fy == null ? 0.5 : fy), t, 550);
      say(text, sub); flash(spots[spot]);
      await wait(ms || 2000, t);
    }
    async function showPop(p, t) {
      p.over.classList.add('on');
      await wait(250, t);
    }
    async function closePop(p, t) {
      await press(p.x, t);
      p.over.classList.remove('on');
      await wait(200, t);
    }

    const steps = [
      { async run(t) {                                                    // 1. summary chips + section icons
        begin(0);
        await wait(300, t);
        await moveTo(at(chips, 0.5, 0.9), t, 600); flash(chips);
        say('제약 10개: ✓ 합격 5 · △ 0 · ✗ 0 · – 판정 불가 5', '판정 불가 5개 = 이 플랜에 없는 구조물(Heart, Tumorbed)');
        await wait(2200, t);
        await moveTo(at(nav.structures, 0.05, 0.5), t, 450);
        say('구역마다 가장 나쁜 결과가 아이콘으로', 'Constraints는 ⚠ (플랜에 없는 구조물) · 나머지 구역은 ✓');
        await wait(1900, t);
      } },
      { async run(t) {                                                    // 2. constraints table
        begin(1);
        await point('ptvResult', '② PTV 4개 제약: 모두 ✓', '예: V95% > 95-90% → 99.5 % (목표 95 % 만족)', t, 2100, 0.5, 0.3);
        await point('tumorbed', '⚠ 플랜에 없는 구조물 → N/A', '자동 합격이 아닙니다 · 별칭(Aliases)으로 이름을 연결할 수 있습니다', t, 2200);
      } },
      { async run(t) {                                                    // 3. DVH
        begin(2);
        await goSection('dvh', t);
        await point('dvhMark', '③ V95% 제약 지점 (초록 = 합격)', '그래프를 클릭하면 가장 가까운 곡선의 선량 · 부피를 읽어 줍니다', t, 2100);
      } },
      { async run(t) {                                                    // 4. Eclipse DVH
        begin(3);
        await goSection('eclipse', t);
        await point('eclipse', '④ 구조물마다 부피 · Dmax · Dmean · D95 · D2 비교', '허용: 부피 2 % · Dmean/D95/D2 1 % · Dmax 2 % · 곡선 2 %p', t, 2300, 0.55, 0.45);
      } },
      { async run(t) {                                                    // 5. structure checks -> 3D
        begin(4);
        await goSection('structures', t);
        say('구조물 이름을 누르면 3D로 볼 수 있습니다', '');
        await wait(900, t);
        await press(spots.ptvLink, t, 0.6);
        await showPop(pop3d, t);
        await moveTo(at(pop3d.im, 0.37, 0.31), t, 500);
        say('PTV_EVAL_EZ1 3D 보기', '빨간 점 = 최대 선량 위치(105.9 %) · 초록 별 = 아이소센터');
        await wait(2300, t);
        await closePop(pop3d, t);
      } },
      { async run(t) {                                                    // 6. plan checks
        begin(5);
        await goSection('plan', t);
        await point('planHot', '⑥ 핫스팟 2119 cGy = 처방의 106.0 % → ✓', '격자 크기 · 불균질 보정 · CT 슬라이스 두께도 함께 확인', t, 2100);
      } },
      { async run(t) {                                                    // 7. site policy
        begin(6);
        await goSection('policy', t);
        await point('policy', '⑦ 규칙 · 기준값 · 사용 여부(Enabled)', '칸을 더블클릭해 고치고, 쓰지 않는 규칙은 끕니다', t, 2100, 0.4, 0.3);
      } },
      { async run(t) {                                                    // 8. collision -> 3D
        begin(7);
        await goSection('collision', t);
        await point('collision', '⑧ 필드마다 가장 가까워지는 거리와 그때의 갠트리 각도', '경고 거리는 왼쪽 Collision clearance (기본 3 cm)', t, 2100, 0.35, 0.5);
        await press(spots.view3d, t);
        await showPop(popC3d, t);
        await moveTo(at(popC3d.im, 0.6, 0.45), t, 500);
        say('헤드 · 몸 · 카우치 여유 거리 3D', '장비 모양은 보기용 그림 · 최종 확인은 실제 드라이런');
        await wait(2300, t);
        await closePop(popC3d, t);
      } },
      { async run(t) {                                                    // 9. Export PDF
        begin(8);
        await press(bExport, t);
        pdfBody.scrollTop = 0; pdfOver.classList.add('on');
        await wait(300, t);
        await moveTo(at(pdfBody, 0.62, 0.3), t, 500);
        say('Plan Check PDF 리포트 1쪽', '제약 판정 · 구조물 점검 · 계획 점검이 A4에 정리됩니다');
        await wait(1500, t);
        await scrollTo(pdfBody, pdfBody.scrollHeight, t, 1600);
        await wait(500, t);
        markSteps(8, -1);
        say('시연 끝 · 실제 장비 · 플랜으로 하는 검증은 진행 중입니다', 'Esc: 창 닫기');
      } },
    ];

    function setFor(i) {                            // end state of step i (-1 = just opened)
      clearHot(); closePops();
      page.scrollTop = D.sections[STEP_SECTION[Math.max(0, i)]];
      if (i >= 8) { pdfOver.classList.add('on'); pdfBody.scrollTop = pdfBody.scrollHeight; }
      paintThumb();
      O.settle(i, '시연 끝 · 실제 장비 · 플랜으로 하는 검증은 진행 중입니다');
    }
    paintThumb();

    // ready once every capture has loaded (or failed)
    let readyFlag = false;
    const imgs = [frame, docImg, pop3d.im, popC3d.im, pdfImg];
    let left = imgs.length;
    const done = () => { left -= 1; if (left <= 0) { readyFlag = true; paintThumb(); } };
    imgs.forEach((im) => { if (im.complete) done(); else { im.addEventListener('load', done); im.addEventListener('error', done); } });

    const player = DM.Player ? new DM.Player({
      steps,
      render(k) { if (!destroyed) setFor(k); },
      onChange() {},
    }) : null;

    return {
      player,
      get ready() { return readyFlag; },
      destroy() {
        destroyed = true;
        if (player) player.destroy();
        O.destroy();
      },
    };
  }

  DM.windows.plancheck = {
    title: 'Plan Check', width: W, height: H, theme: 'plancheck',
    mount, thumbFor, STEPS, STEP_SECTION, SPOT, NAV,
  };
})(typeof window !== 'undefined' ? window : globalThis);
