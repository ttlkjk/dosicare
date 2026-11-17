/* Lecture-only "Why DosiMachine?" intro popup - not part of the original program.
   Opened from the toolbar's Why button or the badge on the welcome screen.
   Infographic: a glowing QA HUB sphere with the 8 reasons as cards around it (style from the user's "Linac QA Hub" image,
   redrawn in HTML/SVG). States: overview (-1) -> cards 1..8 -> summary (8). → / Space next, ← back, card click jumps, Esc closes.
   Card order is the user's (2026-11-15). The 3D volume patient QA card (7) and the summary open the log dose reconstruction window (100 % first, then 93.5 %) and the CBCT window.
   Wording follows the DosiMachine catalog v2 and the user's 8 points; numbers are the catalog's / the baked log run's. */
(function (root) {
  const DM = root.DM = root.DM || {};

  const ICON = {
    layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="8.5 15 11 17.5 15.5 12.5"/>',
    ai: '<path d="M10 3l1.8 4.9L16.5 9.7l-4.7 1.8L10 16.4l-1.8-4.9L3.5 9.7l4.7-1.8z"/><path d="M18 14l.9 2.3 2.3.9-2.3.9L18 20.4l-.9-2.3-2.3-.9 2.3-.9z"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    db: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
    code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/><line x1="14" y1="4" x2="10" y2="20"/>',
    cube: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  };
  const svgIcon = (k, size) => '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + ICON[k] + '</svg>';

  // card centres on the 720 x 560 hub stage, clockwise from top-left
  const POS = [[245, 62], [475, 62], [612, 205], [612, 355], [475, 498], [245, 498], [108, 355], [108, 205]];
  const ITEMS = [
    { t: '측정 데이터 통합', en: 'Data Integration', c: '#0E9F9A', icon: 'layers',
      h: '병원 곳곳의 측정 장비 데이터를<br>한 프로그램에서 비교 · 분석',
      p: '병원에는 측정 장비도, 쌓인 측정 파일도 많습니다. DosiMachine은 장비가 저장한 파일을 <b>형식 그대로</b> 읽어 한 화면에서 비교하고 분석합니다.',
      // extensions: the original's Open-dialog filter (main.py:3639, see js/opendialog.js) + .db / .bin from card 3 (user, 2026-11-17)
      // A list (extension, name, one-line description) instead of chips (user, 2026-11-17). Order and names follow the table
      // the user approved, plus Varian MPC (.xim: BeamProfileCheck.xim in screens/mpc_beam.png, read from the MPCChecks folder)
      // and DICOM split in two (Plan View loads CT, RT Plan, RT Dose and structures). Descriptions say only what the demo shows.
      chips: [],
      formats: [
        ['.dcm', 'DICOM 영상', 'EPID · CT 영상'],
        ['.dcm', 'RT Plan · Dose', 'Eclipse 플랜·선량·구조'],
        ['.tif·.tiff', 'TIFF 영상', '영상 파일'],
        ['.asc', 'IBA 프로파일', 'Blue Phantom 측정'],
        ['.opab', 'IBA myQA', 'myQA Accept 측정'],
        ['.mcc', 'PTW', '프로파일 측정 파일'],
        ['.csv·.asv', '프로파일', '프로파일 값 파일'],
        ['.db', 'MyQA·BeamCheck', '장비 DB 기록'],
        ['.bin', 'Trajectory Log', '치료 중 장비 동작'],
        ['.xim', 'Varian MPC', 'MPC 영상 · 결과 폴더'],
      ],
      take: '값을 손으로 옮겨 적는 단계가 줄어 → 옮겨 적는 실수도 줄어듭니다.' },
    { t: '정확한 Machine QA', en: 'EPID Machine QA', c: '#1E3A8A', icon: 'target', extra: 'epid',
      h: 'EPID에 최적화된,<br>기본에 충실한 Machine QA',
      p: 'Machine QA 영상 측정을 모두 <b>EPID</b>로 합니다. 필름을 붙이고 · 현상하고 · 스캔할 필요가 없습니다. 판정은 TG&#8209;142 허용치로, 못 잰 값은 <b>NOT MEASURED</b>로 따로 표시합니다.',
      chips: ['Winston-Lutz', 'Picket Fence', 'Starshot', 'Field Analysis', '출력 · Wedge Factor', '3D EPID PDD', 'Gating QA (호흡동조)'],
      take: '필름 없이 EPID로 · 못 잰 값은 합격이 아닙니다.' },
    { t: 'Eclipse · DB 자동 연결', en: 'Eclipse & DB Link', c: '#2563EB', icon: 'db',
      h: '이클립스와 각종 데이터베이스에<br>자동으로 연결',
      p: 'Eclipse의 플랜과 선량을 불러오고, 측정 장비의 데이터베이스에서 기록을 바로 읽습니다. 로그 폴더는 새 파일이 생기면 알아서 읽어 들입니다.',
      chips: ['Eclipse 플랜 · RTDOSE', 'MyQA (.db)', 'BeamCheck (.db)', 'Trajectory Log 폴더 감시'],
      take: '파일을 찾아서 옮기는 시간을 줄입니다.' },
    { t: 'Eclipse 스크립팅', en: 'ESAPI Scripting', c: '#0F766E', icon: 'code',
      h: 'Eclipse 스크립팅(ESAPI)으로<br>편리함을 극대화',
      p: 'ESAPI는 Eclipse가 열어 둔 <b>프로그래밍 창구</b>입니다. Eclipse 안에서 스크립트 한 번으로 QA 리포트와 재계산을 실행합니다. 데모의 ESAPI 메뉴에서 실제 예를 볼 수 있습니다.',
      chips: ['Portal Dosimetry QA Report', 'DICOM Export', '로그 → Eclipse 재계산 플러그인'],
      take: '여러 화면을 오가던 반복 작업을 버튼 하나로.' },
    { t: 'AI 데이터 분석', en: 'AI Analytics', c: '#7C3AED', icon: 'ai',
      h: '방대한 측정 데이터를<br>AI로 전문적으로 분석',
      p: '쌓인 리포트 폴더를 AI에게 물어봅니다. "지난 반년 출력 추세는?" 같은 질문에 <b>리포트를 근거로</b> 답합니다. 추세와 관리도(SPC)로 허용치 안의 변화도 미리 봅니다.',
      chips: ['Gemini', 'Claude', 'OpenAI 계열', 'Ollama (PC 안에서 실행)', 'QA Trend & SPC'],
      take: 'AI 답은 참고용입니다. 판정은 원본 리포트와 대조해 내립니다. 클라우드 엔진을 쓰면 리포트 내용이 그 회사로 전송됩니다.' },
    { t: '감사 문서 자동화', en: 'Digital Audit Docs', c: '#2E8B3E', icon: 'doc',
      h: '품질 감사 문서를<br>디지털 문서로 자동 정리',
      p: 'QA 창마다 PDF 리포트를 남기고, 여러 장을 <b>한 권</b>으로 합칩니다. 리포트 값을 병원 Excel · Word <b>점검표 칸</b>에 넣어 줍니다.',
      chips: ['QA 창별 PDF', 'Total Report · 한 권으로', 'Period Report · 절차서 채우기', 'DosiReport · 점검표 칸 채우기'],
      take: 'Excel 점검표에는 칸마다 출처 PDF 링크가 남아, 감사 때 "이 값이 어디서 왔나"를 바로 보여 줍니다.' },
    { t: '3D 볼륨 Patient QA', en: '3D Volume Patient QA', c: '#C9A227', icon: 'cube', star: true,
      h: '오차를 0으로 맞추고,<br>3D 볼륨 변화에 따른 선량 변화를 정확히',
      p: '치료 셋업, 계산 알고리즘 같은 다른 오차를 <b>0으로 맞춥니다</b>(같은 엔진 · 같은 경로로 계산). 그러면 남는 차이는 3D 볼륨 변화에 따른 선량 변화뿐입니다.',
      chips: [], take: '', extra: 'patient' },
    { t: '편리한 UI · 맞춤 설정', en: 'UI & Customization', c: '#E07B00', icon: 'sliders',
      h: '쓰기 편하고,<br>병원에 맞게 바꿀 수 있는 소프트웨어',
      p: '장비별 허용치를 한 번 정하면 모든 QA 창의 기본값이 됩니다. 병원마다 다른 문서 양식을 <b>PDF 출력 양식에 그대로</b> 반영합니다.',
      chips: ['장비별 허용치 (TG-142)', '병원 문서 양식 반영', '한국어 · 영어 함께 표기', '인터넷 없이 동작 (클라우드 AI 제외)'],
      take: '병원이 프로그램에 맞추는 대신, 프로그램이 병원에 맞춥니다.' },
  ];
  // counts = enabled items of each menu in menu-def.js (Image QA: 35 since every item got its window, 2026-11-17)
  const STATS = [[13, 'Machine QA 기능'], [35, 'Image QA 기능'], [5, 'Device QA 도구'], [6, 'AI 엔진 선택']];
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  let ov = null;

  function build() {
    const back = h('div', 'why-back');
    const card = h('div', 'why-card');
    back.appendChild(card);

    // header
    const head = h('div', 'why-head');
    head.innerHTML =
      '<img class="why-logo" src="assets/dosimachine2.png" alt="DosiMachine">' +
      '<div class="why-ttl"><div class="why-eyebrow">✦ WHY DOSIMACHINE?</div>' +
      '<div class="why-title">흩어진 QA를 하나의 <em>허브</em>로</div>' +
      '<div class="why-sub">Integrated Dosimetry QA Platform</div></div>';
    const dots = h('div', 'why-dots');
    for (let i = -1; i <= 8; i++) dots.appendChild(h('i'));
    const x = h('button', 'why-x', '×'); x.title = '닫기 (Esc)';
    head.append(dots, x);
    card.appendChild(head);

    // hub stage
    const main = h('div', 'why-main');
    const { hub, arrows } = hubArt('why');

    // cards
    const cards = ITEMS.map((it, i) => {
      const c = h('button', 'why-node' + (it.star ? ' star' : ''));
      c.style.left = (POS[i][0] - CW / 2) + 'px'; c.style.top = (POS[i][1] - CH / 2) + 'px';
      c.style.setProperty('--c', it.c);
      c.innerHTML = '<span class="why-n">' + (i + 1) + '</span><span class="why-ic">' + svgIcon(it.icon, 26) + '</span>' +
        '<span class="why-tx"><b>' + it.t + '</b><small>' + it.en + '</small></span>';
      c.addEventListener('click', () => go(i));
      hub.appendChild(c);
      return c;
    });
    main.appendChild(hub);

    const detail = h('div', 'why-detail');
    main.appendChild(detail);
    card.appendChild(main);

    const foot = h('div', 'why-foot', '<span><kbd>→</kbd> <kbd>Space</kbd> 다음 · <kbd>←</kbd> 이전 · 카드 클릭 · <kbd>Esc</kbd> 닫기</span>' +
      '<span class="why-note">DosiMachine은 장비 QA를 돕는 도구입니다 · 합격 · 불합격의 최종 판단은 의학물리사가 합니다</span>');
    card.appendChild(foot);

    x.addEventListener('click', close);
    back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
    return { back, card, cards, arrows, detail, dots, idx: -1 };
  }

  /* The moving hub picture (glow, sphere, 3 orbits with travelling dots, 8 curved arrows) on a 720 x 560 stage, without the cards.
     Used by the popup and by the welcome screen (shell.js, user 2026-11-17). pfx keeps the SVG ids unique when both exist. */
  const CX = 360, CY = 280, CW = 210, CH = 78;
  function hubArt(pfx) {
    const hub = h('div', 'why-hub');
    const NS = 'http://www.w3.org/2000/svg';
    const arrows = document.createElementNS(NS, 'svg');
    arrows.setAttribute('class', 'why-arrows'); arrows.setAttribute('viewBox', '0 0 720 560');
    let defs = '<defs>';
    ITEMS.forEach((it, i) => { defs += '<marker id="' + pfx + '-ah' + i + '" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="' + it.c + '"/></marker>'; });
    defs += '</defs>';
    const RS = 104;
    let paths = '';
    ITEMS.forEach((it, i) => {
      const [px, py] = POS[i];
      const top = py < 150, bot = py > 420;
      const ex = top || bot ? px : (px < CX ? px + CW / 2 + 4 : px - CW / 2 - 4);
      const ey = top ? py + CH / 2 + 4 : bot ? py - CH / 2 - 4 : py;
      const dx = ex - CX, dy = ey - CY, L = Math.hypot(dx, dy);
      const sx = CX + dx / L * RS, sy = CY + dy / L * RS;
      const mx = (sx + ex) / 2, my = (sy + ey) / 2;
      const k = 0.22 * Math.hypot(ex - sx, ey - sy);
      const qx = mx - (ey - sy) / Math.hypot(ex - sx, ey - sy) * k, qy = my + (ex - sx) / Math.hypot(ex - sx, ey - sy) * k;
      paths += '<path class="why-ar" data-i="' + i + '" d="M' + sx.toFixed(1) + ' ' + sy.toFixed(1) + 'Q' + qx.toFixed(1) + ' ' + qy.toFixed(1) + ' ' + ex.toFixed(1) + ' ' + ey.toFixed(1) + '" pathLength="100" stroke="' + it.c + '" marker-end="url(#' + pfx + '-ah' + i + ')"/>';
    });
    arrows.innerHTML = defs + paths;
    hub.appendChild(arrows);

    // sphere + orbits
    const glow = h('div', 'why-glow'); hub.appendChild(glow);
    const sphere = h('div', 'why-sphere', '<div class="why-sp-name">DosiMachine</div><div class="why-sp-hub">QA HUB</div>');
    hub.appendChild(sphere);
    const orb = document.createElementNS(NS, 'svg');
    orb.setAttribute('class', 'why-orbits'); orb.setAttribute('viewBox', '0 0 720 560');
    const RX = 168, RY = 44;
    const ell = 'M' + (CX - RX) + ' ' + CY + 'a' + RX + ' ' + RY + ' 0 1 0 ' + (2 * RX) + ' 0a' + RX + ' ' + RY + ' 0 1 0 ' + (-2 * RX) + ' 0';
    let o = '';
    [[-22, 7], [22, 9], [90, 11]].forEach(([a, dur], j) => {
      o += '<g transform="rotate(' + a + ' ' + CX + ' ' + CY + ')"><path id="' + pfx + '-orb' + j + '" d="' + ell + '" class="why-orb"/>' +
        '<circle r="4.5" class="why-orb-dot"><animateMotion dur="' + dur + 's" repeatCount="indefinite"' + (j === 1 ? ' keyPoints="1;0" keyTimes="0;1" calcMode="linear"' : '') + '><mpath href="#' + pfx + '-orb' + j + '"/></animateMotion></circle></g>';
    });
    orb.innerHTML = o;
    hub.appendChild(orb);
    return { hub, arrows };
  }

  function bars() {
    return '<div class="why-pq">' +
      '<div class="why-eq">' +
        '<div class="why-eq-b z"><small>치료 셋업 오차</small><b>0</b></div><span>+</span>' +
        '<div class="why-eq-b z"><small>계산 알고리즘 오차</small><b>0</b></div><span>⇒</span>' +
        '<div class="why-eq-b r"><small>남는 차이</small><b>3D 볼륨 변화 → 선량 변화</b></div>' +
      '</div>' +
      '<div class="why-bars"><div class="why-bars-cap">로그 선량 재구성 · 실측 1건 (두경부 VMAT) · 감마 1 %/1 mm</div>' +
        '<div class="why-bar"><span class="l">① 같은 엔진 · 같은 경로 기준</span><span class="t"><i class="g" style="--w:100%"></i></span><b>100 %</b></div>' +
        '<div class="why-bar"><span class="l">② 임상 RTDOSE 기준</span><span class="t"><i class="a" style="--w:93.5%"></i></span><b>93.5 %</b></div>' +
      '</div>' +
      '<div class="why-cta"><button data-live="logrecon">▶ 로그 선량 재구성 시연 <small>100 % 먼저 → 93.5 %</small></button>' +
        '<button data-live="cbct" class="sec">▶ CBCT 조직변화 선량 <small>예시 값</small></button></div>' +
    '</div>';
  }

  function epidVsFilm() {
    return '<div class="why-vs">' +
      '<div class="why-vs-b film"><div class="hd">FILM <i>✕</i></div>' +
        '<div class="st"><s>붙이기</s><em>→</em><s>조사</s><em>→</em><s>현상 · 스캔</s><em>→</em><s>분석</s></div>' +
        '<small>소모품 · 현상 · 스캔에 드는 시간</small></div>' +
      '<div class="why-vs-to">⇒</div>' +
      '<div class="why-vs-b epid"><div class="hd">EPID <i>✓</i></div>' +
        '<div class="st"><b>조사</b><em>→</em><b>바로 분석</b></div>' +
        '<small>디지털 영상 그대로 · 결과는 PDF로</small></div>' +
    '</div>';
  }

  function renderDetail(i) {
    const d = ov.detail;
    let html;
    if (i < 0) {
      html = '<div class="why-d-top"><span class="why-tag">PRODUCT OVERVIEW</span></div>' +
        '<h2>스마트한 통합 <em>QA 플랫폼</em></h2>' +
        '<p>치료 장비의 QA 영상과 병원 측정 장비의 파일을 <b>한 프로그램</b>에서 읽어 분석합니다. 결과는 PDF 리포트와 추세 그래프, 병원 점검표로 이어집니다.</p>' +
        '<div class="why-stats">' + STATS.map(([n, l]) => '<div><b data-n="' + n + '">0</b><small>' + l + '</small></div>').join('') + '</div>' +        '<div class="why-flow"><span>데이터 불러오기</span><i>→</i><span>분석 · 판정</span><i>→</i><span>리포트 · 추세 · 점검표</span></div>' +
        '<div class="why-hint">→ 키를 누르거나 카드를 눌러 하나씩 보기</div>';
    } else if (i >= ITEMS.length) {
      html = '<div class="why-d-top"><span class="why-tag">SUMMARY</span></div>' +
        '<h2>한눈에 보는 <em>DosiMachine</em></h2>' +
        '<ol class="why-sum">' + ITEMS.map((it, k) => '<li style="--c:' + it.c + '"><i>' + (k + 1) + '</i><b>' + it.t + '</b></li>').join('') + '</ol>' +
        '<div class="why-flow"><span>데이터 불러오기</span><i>→</i><span>분석 · 판정</span><i>→</i><span>리포트 · 추세 · 점검표</span></div>' +
        '<div class="why-take" style="--c:#2563EB;margin-top:0">✦ 흩어진 데이터를 한곳에 모으고 → 정확하게 분석하고 → 문서로 자동 정리합니다.</div>' +
        '<div class="why-cta big"><button data-live="logrecon">▶ 시연 시작: 로그 선량 재구성 <small>100 % 통과부터</small></button></div>';
    } else {
      const it = ITEMS[i];
      html = '<div class="why-d-top" style="--c:' + it.c + '"><span class="why-bign">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="why-dic">' + svgIcon(it.icon, 30) + '</span><span class="why-en">' + it.en.toUpperCase() + '</span></div>' +
        '<h2 style="--c:' + it.c + '">' + it.h + '</h2>' +
        '<p>' + it.p + '</p>' +
        (it.chips.length ? '<div class="why-chips" style="--c:' + it.c + '">' + it.chips.map((s) => '<span>' + s + '</span>').join('') + '</div>' : '') +
        (it.formats ? '<div class="why-fmts" style="--c:' + it.c + '">' + it.formats.map(([x, n, d]) =>
          '<div><b>' + (x || '—') + '</b><span><em>' + n + '</em><small>' + d + '</small></span></div>').join('') + '</div>' : '') +
        (it.extra === 'epid' ? epidVsFilm() : '') +
        (it.take ? '<div class="why-take" style="--c:' + it.c + '">✦ ' + it.take + '</div>' : '') +
        (it.extra === 'patient' ? bars() : '');
    }
    d.classList.remove('in'); void d.offsetWidth;
    d.innerHTML = html;
    d.classList.add('in');
    d.querySelectorAll('[data-live]').forEach((b) => b.addEventListener('click', () => {
      const key = b.dataset.live;
      close();
      if (!(DM.win && DM.win.openLive && DM.win.openLive(key, null)) && DM.shell) DM.shell.toast();
    }));
    d.querySelectorAll('.why-stats b').forEach((b) => {
      const n = +b.dataset.n, t0 = performance.now();
      const step = (t) => { const f = Math.min(1, (t - t0) / 900); b.textContent = Math.round(n * (1 - Math.pow(1 - f, 3))); if (f < 1 && ov) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
  }

  function go(i) {
    if (!ov) return;
    i = Math.max(-1, Math.min(ITEMS.length, i));
    ov.idx = i;
    ov.card.classList.toggle('all', i >= ITEMS.length);
    ov.card.classList.toggle('ov', i < 0);
    ov.cards.forEach((c, k) => { c.classList.toggle('seen', k <= i); c.classList.toggle('now', k === i); });
    ov.arrows.querySelectorAll('.why-ar').forEach((p) => p.classList.toggle('on', +p.dataset.i <= i));
    [...ov.dots.children].forEach((d, k) => { d.classList.toggle('on', k - 1 <= i); d.classList.toggle('now', k - 1 === i); });
    renderDetail(i);
  }

  function fit() {
    if (!ov) return;
    const s = Math.min(1.3, (innerWidth - 40) / 1240, (innerHeight - 40) / 760);
    ov.card.style.transform = 'translate(-50%, -50%) scale(' + s + ')';
  }

  function onKey(e) {
    if (!ov) return;
    const k = e.key, c = e.code;
    if (k === 'f' || k === 'F' || c === 'KeyF') return;          // fullscreen stays with the main window
    e.stopImmediatePropagation();
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (k === 'Escape') { e.preventDefault(); close(); }
    else if (k === 'ArrowRight' || k === ' ' || c === 'Space' || k === 'PageDown') { e.preventDefault(); go(ov.idx + 1); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); go(ov.idx - 1); }
    else if (k === 'Home') { e.preventDefault(); go(-1); }
    else if (k === 'End') { e.preventDefault(); go(ITEMS.length); }
  }

  function open() {
    if (ov) return;
    if (DM.win && DM.win.close && DM.win.current) DM.win.close();
    ov = build();
    document.body.appendChild(ov.back);
    fit();
    requestAnimationFrame(() => ov && ov.back.classList.add('show'));
    go(-1);
    root.addEventListener('keydown', onKey, true);
    root.addEventListener('resize', fit);
  }
  function close() {
    if (!ov) return;
    const b = ov.back;
    ov = null;
    root.removeEventListener('keydown', onKey, true);
    root.removeEventListener('resize', fit);
    b.classList.remove('show');
    setTimeout(() => b.remove(), 250);
  }

  DM.why = { open, close, ITEMS, hubArt };
  if (DM.shell && DM.shell.onToolbar) DM.shell.onToolbar((name) => { if (name === 'why') { open(); return true; } return false; });
})(typeof window !== 'undefined' ? window : globalThis);
