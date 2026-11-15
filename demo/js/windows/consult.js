/* AI Consult replica (Reports > AI Consult) with a self-playing walkthrough that makes the monthly period report.
   Replica of dosireport/frontend/consult.html: header, 문제지 (question) pane with the 원본 PDF tab, 답안지 (answer) pane.
   Data is baked by bake/bake_consult.py (report-folder summary, the period-report PDF's summary and items) and
   bake_dosireport.py (the PDF page images).

   On open it plays by itself (winman autoRun), in the original's order: first the engine is chosen (⚙️ AI 설정 opens
   DosiMachine Configuration > AI 분석 및 API 설정, Configuration.py 1669-2040 / _build_agent_panel; Save Config; then
   🔄 새로고침 shows the new engine), then (consult.html openPeriodReport / submitPeriodReport / sendAgentMessage /
   openPdfPane): 📄 기간 리포트 menu -> 📆 월간 리포트 -> date dialog
   (start date changed to the one the real report used) -> 만들기 -> agent progress -> notice + answer ->
   the PDF name in the answer opens the PDF in the left pane. Space pauses, arrows step.

   Not recorded from the real run, so put together here (and said so on screen):
   - the progress lines: the original's own texts (main.py, consult_agents/claude.py describe_tool) with the
     reports the PDF cites, in date order; the real agent's tool calls were not saved;
   - the answer: the PDF's own summary and items (written by the agent into the period-report spec).
   Speed: the real run takes minutes; here a few seconds. The folder path shown is a placeholder.
   The engine starts on ChatGPT (Codex), as in the Configuration capture (screens/config_ai.png); the version numbers in
   the agent panels are Codex rust-v0.159.2 (from that capture) and Claude Code 2.1.233 (this PC when the demo was made). */
(function (root) {
  const DM = root.DM = root.DM || {};
  DM.windows = DM.windows || {};

  const W = 1707, H = 996;
  const FOLDER_PATH = 'C:/DosiCare/Report';
  const ENGINE = 'Claude (Claude Code)', MODEL = 'sonnet';
  const OLD_ENGINE = 'ChatGPT (Codex)';            // engine before the demo picks Claude (config_ai.png)
  const PDF_W = 600;
  const STEPS = [
    { t: 'AI 엔진 고르기', cap: '⓪ 먼저 쓸 AI를 고릅니다', sub: '[⚙️ AI 설정] → DosiMachine 설정 창' },
    { t: '기간 리포트 메뉴 열기', cap: '① [기간 리포트] 메뉴를 엽니다', sub: '리포트를 모아 PDF로 만드는 메뉴' },
    { t: '월간 리포트 고르기', cap: '② 📆 월간 리포트를 고릅니다', sub: '기간을 묻는 창이 뜹니다' },
    { t: '기간 정하기 → 만들기', cap: '③ 기간을 정하고 [만들기]', sub: '' },
    { t: 'AI가 리포트 읽기', cap: '④ AI(Claude)가 리포트 폴더를 읽습니다', sub: '실제로는 몇 분 걸립니다 · 시연은 빠르게 보여 줍니다' },
    { t: '답 + PDF 생성', cap: '⑤ 월간 리포트 PDF가 만들어졌습니다', sub: '점검표에 넣을 6칸 + 넣지 못한 이유' },
    { t: '만들어진 PDF 열기', cap: '⑥ 파일 이름을 누르면 왼쪽에 PDF가 열립니다', sub: '' },
  ];

  const h = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  // the agent's progress lines, as the original prints them (pure; tested in node)
  function progressLines(C) {
    const L = [ENGINE + ' 준비하는 중...', '리포트 PDF를 글자 사본으로 맞추는 중...',
      '파일 살펴보는 중: Glob *.pdf.txt', '파일 살펴보는 중: Read 점검표_칸목록.md', '파일 살펴보는 중: Read 허용오차_기준표.md'];
    C.sources.forEach((s) => L.push('파일 살펴보는 중: Read ' + s + '.txt'));
    L.push('파일 살펴보는 중: Write ' + C.pdf_name + '.json');
    return L;
  }
  const periodPrompt = (C) => C.period.from + ' ~ ' + C.period.to + ' 기간의 월간 QA 리포트를 만들어 줘. '
    + "점검표 '" + C.sheet + "'에 넣을 값을 리포트에서 찾아 기간 리포트 설계서로 써 줘.";

  function mount(body) {
    const C = root.DM_DATA && root.DM_DATA.consult;
    const PDF = (root.DM_DATA && root.DM_DATA.dosireport && root.DM_DATA.dosireport.pdf) || [];
    if (!C) { body.appendChild(h('div', null, 'AI Consult 데이터가 없습니다 (bake_consult.py).')); return { destroy() {} }; }
    let destroyed = false;

    /* ---------------- header ---------------- */
    const app = h('div', 'ac-app');
    const top = h('header', 'ac-top');
    const tg = h('div', 'ac-tgroup');
    const tt = h('div');
    const sub = h('div', 'ac-sub', '분석 폴더: ');
    sub.appendChild(h('span', 'ac-link', FOLDER_PATH));
    tt.append(h('div', 'ac-title', 'AI Consult · 지능형 장비 QA 분석 & 컨설팅'), sub);
    tg.append(h('div', 'ac-icon', '🤖'), tt);
    const stats = h('div', 'ac-stats');
    const pRep = h('div', 'ac-pill'); pRep.innerHTML = '📁 리포트 <strong>' + C.total + '개</strong> (' + C.category_count + '개 분야)';
    const pModel = h('div', 'ac-pill');
    const bSet = h('button', 'ac-hbtn', '⚙️ AI 설정'), bRefresh = h('button', 'ac-hbtn', '🔄 새로고침');
    stats.append(h('button', 'ac-hbtn folder', '📂 분석 폴더 지정'), pRep, pModel, bSet, bRefresh);
    // renderEngineStatus: the label, then the model when the engine reports one
    const setEngine = (claude) => { pModel.innerHTML = claude ? '🧠 <strong>' + ENGINE + '</strong> · ' + MODEL : '🧠 <strong>' + OLD_ENGINE + '</strong>'; };
    top.append(tg, stats);

    /* ---------------- 문제지 pane ---------------- */
    const split = h('div', 'ac-split');
    const q = h('aside', 'ac-q');
    const tabs = h('div', 'ac-tabs');
    const tabQ = h('button', 'ac-tab active', '📝 문제지'), tabP = h('button', 'ac-tab', '📄 원본 PDF');
    tabs.append(tabQ, tabP);
    const viewQ = h('div', 'ac-view');
    const qs = h('div', 'ac-qscroll');

    const date = h('div', 'ac-date');
    const r1 = h('div', 'ac-row');
    r1.appendChild(h('span', 'ac-label', '📅 분석 대상 기간:'));
    ['전체 기간', '최근 1개월', '최근 3개월', '최근 6개월', '최근 1년'].forEach((t, i) => r1.appendChild(h('button', 'ac-dq' + (i ? '' : ' active'), t)));
    const r2 = h('div', 'ac-dinputs');
    r2.append(h('span', 'ac-dinput', '년-월-일'), h('span', null, '~'), h('span', 'ac-dinput', '년-월-일'), h('button', 'ac-dapply', '적용'), h('button', 'ac-dclear', '초기화'));
    const r2w = h('div', 'ac-row'); r2w.appendChild(r2);
    date.append(r1, r2w, h('span', 'ac-dbadge', '📅 전체 기간 분석 중'));

    const presets = h('div', 'ac-presets');
    presets.appendChild(h('span', 'ac-label', '⚡ 빠른 진단:'));
    let periodMenu = null, monthlyItem = null;
    [['🛡️ 종합·안전'], ['⚛️ 선량·빔품질'], ['🎯 기계적·등각점'], ['🚀 임상·TG-142'], ['📄 기간 리포트', true]].forEach(([label, isPeriod]) => {
      const m = h('div', 'ac-pm');
      const b = h('button', 'ac-pm-btn'); b.append(h('span', null, label), h('span', 'caret', '▾'));
      m.appendChild(b);
      if (isPeriod) {
        const panel = h('div', 'ac-pm-panel');
        panel.appendChild(h('div', 'ac-pm-head', '📄 기간 리포트 (PDF → AI 작업 폴더)'));
        ['📅 일간 리포트', '🗓️ 주간 리포트', '📆 월간 리포트', '📚 연간 리포트'].forEach((t) => {
          const it = h('button', 'ac-pm-item', t); panel.appendChild(it);
          if (t.indexOf('월간') >= 0) monthlyItem = it;
        });
        m.appendChild(panel);
        periodMenu = m;
      }
      presets.appendChild(m);
    });
    const mode = h('div', 'ac-mode');
    const mq = h('button', 'active', '⚡ 빠른 프리셋'); mode.append(mq, h('button', null, '🎯 단계별 맞춤 진단'));
    presets.appendChild(mode);

    const rl = h('div', 'ac-rl');
    const rlh = h('div', 'ac-rl-head');
    rlh.append(h('span', 'ac-label', '📚 기간 안의 리포트'), h('span', 'ac-rl-count', C.total + '개 · ' + C.category_count + '개 분야'));
    const pick = h('div', 'ac-pick');
    pick.append(h('span', 'ac-pick-count', '고른 리포트 없음 — 자동'), h('button', 'ac-dq', '보이는 것 모두 고르기'), h('button', 'ac-dclear', '모두 풀기'));
    rl.append(rlh, h('div', 'ac-rl-note', '이 목록은 참고용입니다. ChatGPT(Codex)·Claude는 이 목록과 따로 리포트 폴더 전체(더 깊은 하위 폴더 포함, 기간과 상관없이)의 글자 사본을 직접 읽을 수 있고, 기간은 질문 글로만 전달됩니다.'), pick);
    C.categories.forEach((c) => {
      const row = h('div', 'ac-cat');
      row.append(h('span', 'tri', '▶'), h('span', 'box'), h('span', null, c.name + ' (' + c.count + ')' + (c.latest ? ' · 최신 ' + c.latest : '')));
      rl.appendChild(row);
    });
    qs.append(date, presets, rl);
    viewQ.appendChild(qs);

    // 원본 PDF view
    const viewP = h('div', 'ac-view'); viewP.hidden = true;
    const ph = h('div', 'ac-pdfhead');
    const mtg = h('div', 'ac-mtg');
    const ptitle = h('div', 'ac-mtitle', '열린 PDF 없음'), psub = h('div', 'ac-msub', '답안지의 파일 이름을 누르면 여기에 원본이 열립니다.');
    const ptw = h('div'); ptw.style.minWidth = '0'; ptw.append(ptitle, psub);
    mtg.append(h('span', 'ac-micon', '📄'), ptw);
    const tools = h('div', 'ac-tools'); tools.hidden = true;
    const zoom = h('div', 'ac-zoom'); zoom.append(h('span', null, '🔍 -'), h('b', null, '화면 맞춤'), h('span', null, '🔍 +'));
    tools.append(zoom, h('span', 'ac-mact', '📁 위치 열기'), h('span', 'ac-mact', '새 창으로 ↗'), h('span', 'ac-mact', '다운로드 ⬇'));
    ph.append(mtg, tools);
    const pbody = h('div', 'ac-pdfbody');
    const ploading = h('div', 'ac-loading'); ploading.hidden = true;
    ploading.append(h('div', 'ac-dot'), h('span', null, 'PDF 문서를 불러오는 중입니다...'));
    const pscroll = h('div', 'ac-pdfscroll');
    const pdfImgs = [];
    PDF.forEach((p, i) => {
      const wrap = h('div', 'ac-page');
      wrap.appendChild(h('span', 'ac-pnum', 'Page ' + (i + 1) + ' / ' + PDF.length));
      const im = h('img'); im.src = p.file; im.alt = ''; im.draggable = false;
      im.style.width = PDF_W + 'px'; im.style.height = Math.round(p.h * PDF_W / p.w) + 'px';
      wrap.appendChild(im); pscroll.appendChild(wrap); pdfImgs.push(im);
    });
    pscroll.hidden = true;
    pbody.append(ploading, pscroll);
    viewP.append(ph, pbody);

    const brief = h('label', 'ac-brief');
    brief.append(h('span', 'box'), document.createTextNode(' ⚡ 짧게 답하기 '), h('span', 'ac-brief-note', '결론과 FAIL·경고만'));
    const bottom = h('footer', 'ac-bottom');
    const send = h('button', 'ac-send', '전송 ➔');
    bottom.append(h('div', 'ac-input', '장비 상태, 선량 이상 여부, 트렌드 등에 대해 질문하세요... (Enter 또는 전송 버튼)'), send);
    q.append(tabs, viewQ, viewP, brief, bottom);

    /* ---------------- 답안지 pane ---------------- */
    const a = h('section', 'ac-a');
    const ah = h('div', 'ac-ahead');
    ah.append(h('button', 'ac-hbtn', '◀ 문제지 접기'), h('span', 'ac-atitle', '답안지'), h('button', 'ac-hbtn', '대화 초기화'));
    const chat = h('main', 'ac-chat');
    a.append(ah, chat);
    split.append(q, h('div', 'ac-handle'), a);

    // period dialog
    const over = h('div', 'ac-modal-over');
    const modal = h('div', 'ac-modal');
    const mh = h('div', 'ac-modal-head');
    const mtg2 = h('div', 'ac-mtg');
    const mtitle = h('div');
    mtitle.append(h('div', 'ac-mtitle', '월간 리포트'), h('div', 'ac-msub', '고른 기간의 리포트로 PDF를 만들어 AI 작업 폴더에 둡니다.'));
    mtg2.append(h('span', 'ac-micon', '📄'), mtitle);
    mh.append(mtg2, h('span', 'ac-mclose', '✕'));
    const mb = h('div', 'ac-modal-body');
    const fFrom = h('span', 'field'), fTo = h('span', 'field');
    const l1 = h('div'); l1.append(document.createTextNode('시작일'), fFrom);
    const l2 = h('div'); l2.append(document.createTextNode('끝일'), fTo);
    const btns = h('div', 'ac-mbtns');
    const bMake = h('button', 'ac-mact', '만들기');
    btns.append(h('button', 'ac-mact', '취소'), bMake);
    mb.append(l1, l2, h('div', 'ac-mnote', "DosiReport에서 '" + C.sheet + "' 시트에 넣을 수 있게 만듭니다."), btns);
    modal.append(mh, mb);
    over.appendChild(modal);

    const cfg = buildConfig();
    app.append(top, split, over, cfg.win);
    body.appendChild(app);
    const O = DM.demoOverlay(app, { W, H, title: '자동 시연 · AI Consult로 월간 리포트 만들기', steps: STEPS });
    const { at, say, wait, moveTo, click, scrollTo, centerTop, markSteps, begin } = O;

    /* ---------------- Configuration > AI 분석 및 API 설정 (Configuration.py) ---------------- */
    function buildConfig() {
      const win = h('div', 'cf-win');
      const bar = h('div', 'cf-bar');
      bar.append(h('span', 'cf-bar-t', 'Configuration'), h('span', 'cf-bar-b', '—     ☐     ✕'));
      const bodyEl = h('div', 'cf-body');
      const side = h('div', 'cf-side');
      side.appendChild(h('div', 'cf-side-head', '설정 메뉴'));
      ['장비 기본 정보', 'AI 분석 및 API 설정', '리포트 폴더 설정', '일반 및 프로토콜', '선량 교정 및 에너지', '분석 프로토콜 설정',
        '허용오차 관리 (TG-142)', 'Eclipse 연동', 'CT 밀도 보정 곡선', '데모 및 비밀번호'].forEach((t, i) => side.appendChild(h('div', 'cf-menu' + (i === 1 ? ' active' : ''), t)));
      const mainEl = h('div', 'cf-main');
      const band = h('div', 'cf-band');
      band.append(h('div', 'cf-band-t', '⚙ AI 인공지능 모델 설정'), h('div', 'cf-band-s', '문서 자동 작성, 증거 자동 분석, 사실관계 요약 등에 사용할 AI 모델 및 API를 설정합니다.'));
      const grid = h('div', 'cf-grid');
      const cards = {};
      [['google', '✨ Google Gemini (무료 추천 🌟)', 'Google AI Studio 무료 API · 하루 1,500회 무료 · 초고속 고성능'],
        ['claude', '☁️ Claude API (Anthropic)', '클라우드 초고성능 모델 · 빠르고 정밀한 문장 작성'],
        ['ollama', '🖥️ 로컬 Ollama', 'PC 내 직접 구동 · 완전 오프라인 · 데이터 유출 0%'],
        ['openai', '🤖 OpenAI / 호환 API', 'ChatGPT(GPT-4o) · DeepSeek · Groq 등 커스텀 호환'],
        ['codex', 'ChatGPT (내 ChatGPT 계정 · Codex)', 'API 키 없이 ChatGPT Plus 구독으로 · PC에 Codex 프로그램을 받아 실행'],
        ['claude_cli', 'Claude (내 Claude 계정 · Claude Code)', 'API 키 없이 Claude Pro·Max 구독으로 · 설치된 Claude Code를 실행']].forEach(([id, t, sub]) => {
        const c = h('div', 'cf-card');
        const tr = h('div', 'cf-card-top');
        tr.append(h('span', 'cf-card-t', t), h('span', 'cf-badge', '선택됨'));
        c.append(tr, h('div', 'cf-card-s', sub));
        grid.appendChild(c); cards[id] = c;
      });
      const detail = h('div', 'cf-detail');
      const dTitle = h('div', 'cf-d-title'), dAbout = h('div', 'cf-d-about');
      const stateRow = h('div', 'cf-d-row'), state = h('span', 'cf-d-state');
      const btn1 = h('span', 'cf-sbtn');
      stateRow.append(state, btn1, h('span', 'cf-sbtn', '브라우저에서 로그인'), h('span', 'cf-sbtn', '로그아웃'), h('span', 'cf-sbtn', '다시 확인'));
      const modelRow = h('div', 'cf-d-row'), model = h('span', 'cf-combo');
      modelRow.append(h('span', null, '③ 모델:'), model, h('span', 'cf-d-note', "'모델을 쓸 수 없습니다' 오류가 나면 다른 모델을 골라 보세요."));
      const effortRow = h('div', 'cf-d-row');
      effortRow.append(h('span', null, '④ 생각:'), h('span', 'cf-combo', '빠르게 (생각 적게)'),
        h('span', 'cf-d-note', '실측(리포트 2장 질문 1회씩): sonnet·빠르게 약 20초 / opus·빠르게 약 27초 / opus·생각 지정 안 함 약 50초'));
      const dMsg = h('div', 'cf-d-note');
      detail.append(dTitle, dAbout, stateRow, modelRow, effortRow, dMsg);
      const tools = h('div', 'cf-tools');
      tools.append(h('span', 'cf-tbtn', '⚡ 연결 테스트'), h('span', 'cf-tbtn blue', '🔗 Get API key'), h('span', 'cf-tbtn purple', '🔗 Get Groq API Key (추천)'), h('span', 'cf-tbtn red', '🗑 키 삭제'));
      mainEl.append(band, h('div', 'cf-label', 'AI 엔진 선택 — AI Consult와 점검표 자동 연결이 같이 씁니다'), grid, detail, tools);
      bodyEl.append(side, mainEl);
      const foot = h('div', 'cf-foot');
      const save = h('span', 'cf-save', 'Save Config'), close = h('span', 'cf-close', 'Close');
      foot.append(save, close);
      const box = h('div', 'cf-msgbox');
      const mbody = h('div', 'cf-mb-body'); mbody.append(h('span', 'cf-mb-icon', 'i'), h('span', null, 'Configuration saved.'));
      const ok = h('span', 'cf-mb-ok', '확인');
      const mfoot = h('div', 'cf-mb-foot'); mfoot.appendChild(ok);
      box.append(h('div', 'cf-mb-bar', 'Success'), mbody, mfoot);
      win.append(bar, bodyEl, foot, box);

      // _agent_texts + _show_agent_status, with both agents installed and logged in
      const TEXT = {
        codex: { title: 'ChatGPT (내 ChatGPT 계정 · Codex CLI) 세부 구성', step: '받기', ver: 'rust-v0.159.2', btn: '받기', model: '자동 (Codex가 고름)', effort: false,
          about: 'API 키 없이 ChatGPT Plus 이상 구독으로 동작합니다. PC에 Codex 프로그램을 받아 실행합니다.\n'
            + '· AI Consult: ChatGPT가 리포트 폴더 전체를 글자 사본으로 읽습니다. 환자 기록 폴더도 포함되며, 읽은 내용은 OpenAI로 전송됩니다.\n'
            + '· 점검표 자동 연결: 리포트 한 장의 글자만 보냅니다. 환자 기록 리포트는 보내지 않습니다.\n'
            + '에이전트는 파일을 고치지는 못하지만, 이 PC에서 사용자 계정으로 볼 수 있는 파일은 모두 읽을 수 있습니다.' },
        claude_cli: { title: 'Claude (내 Claude 계정 · Claude Code) 세부 구성', step: '설치', ver: '2.1.233', btn: '설치 안내', model: MODEL, effort: true,
          about: 'API 키 없이 Claude Pro·Max 구독으로 동작합니다. 이 PC에 설치된 Claude Code를 실행합니다(설치는 Anthropic 공식 안내대로).\n'
            + '· AI Consult: Claude가 리포트 폴더 전체를 글자 사본으로 읽습니다. 환자 기록 폴더도 포함되며, 읽은 내용은 Anthropic으로 전송됩니다.\n'
            + '· 점검표 자동 연결: 리포트 한 장의 글자만 보냅니다. 환자 기록 리포트는 보내지 않습니다.\n'
            + '사본 폴더 밖 파일은 읽지 못하고 명령도 실행하지 못합니다. 파일은 리포트 폴더의 AI_작업에만 쓰며, 엑셀은 Claude가 쓴 설계서로 앱이 만듭니다.' },
      };
      function select(id) {
        Object.keys(cards).forEach((k) => cards[k].classList.toggle('sel', k === id));
        const T = TEXT[id];
        dTitle.textContent = T.title; dAbout.textContent = T.about;
        state.textContent = '① ' + T.step + ': 완료 (' + T.ver + ')     ② 로그인: 완료';
        btn1.textContent = T.btn; model.textContent = T.model; effortRow.hidden = !T.effort;
        dMsg.textContent = '선택과 모델은 아래 Save Config을 눌러야 저장됩니다. ' + T.step + '·로그인은 누르는 즉시 진행됩니다.';
      }
      return {
        win, cards, save, close, ok, select,
        show() { win.classList.add('on'); },
        hide() { win.classList.remove('on'); box.classList.remove('on'); },
        msg(on) { box.classList.toggle('on', on); },
      };
    }

    /* ---------------- chat pieces (appendUserMessage / appendAgentLoading / appendAiMessage) ---------------- */
    function greeting() {
      const row = h('div', 'ac-msg');
      const card = h('div', 'ac-card');
      const hd = h('div', 'ac-card-head'), ag = h('div', 'ac-av-group');
      ag.append(h('div', 'ac-av', '🤖'), h('div', 'ac-name', 'AI QA Consultant'));
      hd.appendChild(ag);
      const b = h('div', 'ac-body');
      b.innerHTML = '안녕하세요! <strong>선형가속기(Linac) AI 정도관리 컨설턴트</strong>입니다.<br><br>'
        + 'Reports 폴더 내 축적된 실측 리포트 데이터를 분석하여 <strong>출력 선량 오차, 빔 프로파일, 기계적 정밀도(EPID/WL)</strong> 상태를 실시간으로 진단해 드립니다.<br><br>'
        + '💡 <strong>리포트 파일명을 클릭하시면 왼쪽 칸에 PDF 원본이 열립니다.</strong><br><br>'
        + '왼쪽 문제지의 <strong>⚡ 빠른 진단</strong>을 누르시거나, 왼쪽 아래 입력창에 궁금하신 내용을 자연어로 자유롭게 질문해 주세요!';
      card.append(hd, b); row.appendChild(card); return row;
    }
    function userMsg() {
      const row = h('div', 'ac-msg user'); row.appendChild(h('div', 'ac-ububble', periodPrompt(C))); return row;
    }
    function loadingMsg() {
      const row = h('div', 'ac-msg');
      const c = h('div', 'ac-loadcard');
      const prog = h('span', 'agent-progress', progressLines(C)[0]);
      c.append(h('div', 'ac-dot'), prog, h('button', 'ac-stop', '⏹ 중단'));
      row.appendChild(c); return { row, prog };
    }
    function noticeMsg() {
      const row = h('div', 'ac-msg');
      const c = h('div', 'ac-loadcard');
      c.append(document.createTextNode('⚠️ '), h('span', null, '기간 리포트 PDF를 만들었습니다: …\\AI_작업\\' + C.pdf_name
        + ' (점검표 칸 ' + C.items.length + '개, 뺀 항목 0개)'));
      row.appendChild(c); return row;
    }
    const pdfBtn = (name) => {
      const b = h('span', 'ac-pdfbtn');
      b.append(h('span', null, '📄'), document.createTextNode(' ' + name + ' '), h('span', 'badge', '👁️ 미리보기'));
      return b;
    };
    let mainPdfBtn = null;
    function answerMsg() {
      const row = h('div', 'ac-msg');
      const card = h('div', 'ac-card');
      const hd = h('div', 'ac-card-head'), ag = h('div', 'ac-av-group');
      ag.append(h('div', 'ac-av', '🤖'), h('div', 'ac-name', 'AI QA Consultant'));
      hd.append(ag, h('div', 'ac-scope', '📄 ' + C.period.from + ' ~ ' + C.period.to + ' 기간 리포트 · 🧠 ' + ENGINE + ' · ' + C.made_at.slice(11)));
      const b = h('div', 'ac-body');
      b.appendChild(h('h3', null, '월간 리포트 설계서를 썼습니다'));
      const p1 = h('p');
      mainPdfBtn = pdfBtn(C.pdf_name);
      p1.append(document.createTextNode('만들어질 PDF: '), mainPdfBtn, document.createTextNode(' — AI 작업 폴더, ' + C.period.from + ' ~ ' + C.period.to));
      b.appendChild(p1);
      b.appendChild(h('h3', null, "'" + C.sheet + "'에 넣을 값 (" + C.items.length + '칸)'));
      const tb = h('table'), thr = h('tr');
      ['칸', '항목', '값', '출처 리포트', '측정일'].forEach((t) => thr.appendChild(h('th', null, t)));
      tb.appendChild(thr);
      C.items.forEach((it) => {
        const tr = h('tr');
        tr.append(h('td', null, it.cell), h('td', null, it.label), h('td', null, it.value));
        const src = h('td'); src.appendChild(pdfBtn(it.source.split('/').pop())); tr.appendChild(src);
        tr.appendChild(h('td', null, it.date));
        tb.appendChild(tr);
      });
      b.appendChild(tb);
      b.appendChild(h('h3', null, '요약'));
      C.summary.forEach((s) => b.appendChild(h('p', null, s)));
      b.appendChild(h('h3', null, '칸을 못 찾아 넣지 못한 측정'));
      const ul = h('ul');
      C.left_out.forEach((s) => ul.appendChild(h('li', null, s)));
      b.appendChild(ul);
      const ft = h('div', 'ac-card-foot');
      ft.append(h('span', null, '⏩ 이어서 계속 작성'), h('span', null, '📋 답변 복사'));
      card.append(hd, b, ft); row.appendChild(card); return row;
    }

    /* ---------------- state for a paused / stepped view ---------------- */
    function showPane(pdf) {
      tabQ.classList.toggle('active', !pdf); tabP.classList.toggle('active', pdf);
      viewQ.hidden = pdf; viewP.hidden = !pdf;
    }
    function openPdf(loaded) {
      showPane(true);
      ptitle.textContent = C.pdf_name; psub.textContent = 'Reports 폴더의 원본 PDF 측정 보고서';
      tools.hidden = false; ploading.hidden = loaded; pscroll.hidden = !loaded; pscroll.scrollTop = 0;
    }
    function resetPdf() {
      ptitle.textContent = '열린 PDF 없음'; psub.textContent = '답안지의 파일 이름을 누르면 여기에 원본이 열립니다.';
      tools.hidden = true; ploading.hidden = true; pscroll.hidden = true;
    }
    function setDialog(from) { fFrom.textContent = from; fTo.textContent = C.period.to; fFrom.classList.remove('edit'); }
    function setBusy(busy) { send.textContent = busy ? '분석 중...' : '전송 ➔'; send.classList.toggle('busy', busy); }
    function clearHot() { app.querySelectorAll('.hot').forEach((e) => e.classList.remove('hot')); }

    function setFor(i) {                            // end state of step i (-1 = just opened)
      clearHot();
      cfg.hide(); setEngine(i >= 0);
      const j = i - 1;                              // the period-report part starts at step 1
      chat.innerHTML = ''; chat.appendChild(greeting()); chat.scrollTop = 0;
      periodMenu.classList.toggle('open', j === 0);
      over.classList.toggle('on', j === 1);
      setDialog(C.period.default_from);
      setBusy(j === 2 || j === 3);
      showPane(false); resetPdf();
      if (j >= 2) chat.appendChild(userMsg());
      if (j === 2 || j === 3) { const l = loadingMsg(); if (j === 3) l.prog.textContent = progressLines(C).slice(-1)[0]; chat.appendChild(l.row); }
      if (j >= 4) { chat.appendChild(noticeMsg()); chat.appendChild(answerMsg()); }
      chat.scrollTop = chat.scrollHeight;
      if (j >= 4) chat.scrollTop = Math.max(0, chat.children[2].offsetTop - chat.offsetTop - 20);   // the notice
      if (j >= 5) { openPdf(true); }
      qs.scrollTop = 0;
      O.settle(i, '시연 끝 · 이 PDF를 DosiReport에서 고르면 월간 점검표 6칸이 채워집니다');
    }

    /* ---------------- the walkthrough ---------------- */
    const steps = [
      { async run(t) {                                                    // 0. choose the engine
        // kept short on purpose (lecture time): open settings -> Claude card -> Save -> Close -> refresh
        begin(0);
        await moveTo(at(bSet), t, 500); await click(t);
        cfg.select('codex'); cfg.show();
        await wait(300, t);
        await moveTo(at(cfg.cards.claude_cli, 0.4, 0.5), t, 600); await click(t);
        cfg.select('claude_cli');
        say('⓪ ChatGPT(Codex) → Claude (Claude Code)', '설치·로그인 완료 · 모델 sonnet');
        await wait(1300, t);
        await moveTo(at(cfg.save), t, 550); await click(t);
        cfg.msg(true);
        await wait(450, t);
        await moveTo(at(cfg.ok), t, 300); await click(t);
        cfg.msg(false);
        await moveTo(at(cfg.close), t, 300); await click(t);
        cfg.hide();
        await moveTo(at(bRefresh), t, 500); await click(t);
        setEngine(true); pModel.classList.add('hot');
        say('⓪ 엔진: Claude (Claude Code) · sonnet', '기간 리포트는 Claude 또는 ChatGPT 엔진에서만 만들 수 있습니다');
        await wait(1500, t);
        pModel.classList.remove('hot');
      } },
      { async run(t) {                                                    // 1. 📄 기간 리포트 menu
        begin(1);
        const btn = periodMenu.firstChild;
        await scrollTo(qs, Math.max(0, centerTop(qs, btn) - 80), t, 400);
        await moveTo(at(btn, 0.25), t); periodMenu.classList.add('hot'); await wait(220, t);
        await click(t);
        periodMenu.classList.remove('hot'); periodMenu.classList.add('open');
        await wait(900, t);
      } },
      { async run(t) {                                                    // 2. 📆 월간 리포트 -> date dialog
        begin(2);
        await moveTo(at(monthlyItem, 0.25), t); monthlyItem.classList.add('hot'); await wait(250, t);
        await click(t);
        monthlyItem.classList.remove('hot'); periodMenu.classList.remove('open');
        setDialog(C.period.default_from); over.classList.add('on');
        await wait(500, t);
        await moveTo(at(fFrom, 0.8), t, 600);
        say('② 기본 기간: 최근 1개월', C.period.default_from + ' ~ ' + C.period.to);
        await wait(1600, t);
      } },
      { async run(t) {                                                    // 3. change the start date, 만들기
        begin(3);
        if (!over.classList.contains('on')) { setDialog(C.period.default_from); over.classList.add('on'); }
        await moveTo(at(fFrom, 0.5), t, 500);
        await click(t);
        fFrom.classList.add('edit');
        say('③ 시작일을 ' + C.period.from + '로 바꿉니다', '실제 리포트를 만들 때 고른 기간');
        const target = C.period.from;
        fFrom.textContent = '';
        for (let k = 1; k <= target.length; k++) { fFrom.textContent = target.slice(0, k); await wait(70, t); }
        fFrom.classList.remove('edit');
        await wait(700, t);
        await moveTo(at(bMake), t); bMake.classList.add('hot'); await wait(250, t);
        await click(t);
        bMake.classList.remove('hot'); over.classList.remove('on');
        setBusy(true);
        chat.appendChild(userMsg());
        say('③ 질문 글은 앱이 자동으로 씁니다', '기간 + 점검표 시트 이름');
        await wait(700, t);
        const l = loadingMsg(); chat.appendChild(l.row);
        await scrollTo(chat, chat.scrollHeight, t, 500);
        await moveTo(at(l.row.firstChild, 0.4, 0.5), t, 700);
        await wait(1200, t);
      } },
      { async run(t) {                                                    // 4. agent progress
        begin(4);
        let prog = chat.querySelector('.agent-progress');
        if (!prog) { const l = loadingMsg(); chat.appendChild(l.row); prog = l.prog; }
        const lines = progressLines(C);
        for (let k = 1; k < lines.length; k++) { prog.textContent = lines[k]; await wait(k < 3 ? 1100 : 850, t); }
        await wait(700, t);
      } },
      { async run(t) {                                                    // 5. notice + answer
        begin(5);
        const load = chat.querySelector('.ac-loadcard');
        if (load) load.parentNode.remove();
        setBusy(false);
        const n = noticeMsg(); chat.appendChild(n);
        await wait(500, t);
        const ans = answerMsg(); chat.appendChild(ans);
        await scrollTo(chat, n.offsetTop - chat.offsetTop - 20, t, 700);
        await moveTo(at(n.firstChild, 0.55, 0.5), t, 700);
        say('⑤ 앱이 설계서를 검사해 PDF를 만들었습니다', 'AI_작업 폴더 · 점검표 칸 ' + C.items.length + '개');
        await wait(2000, t);
        const tbl = ans.querySelector('table');
        await scrollTo(chat, centerTop(chat, tbl), t, 900);
        await moveTo(at(tbl, 0.62, 0.45), t, 700);
        say('⑤ 점검표에 넣을 ' + C.items.length + '칸', '값은 리포트 글자 그대로 · 출처 리포트와 측정일');
        await wait(2400, t);
        const ul = ans.querySelector('ul');
        await scrollTo(chat, centerTop(chat, ul), t, 900);
        await moveTo(at(ul, 0.3, 0.2), t, 700);
        say('⑤ 못 넣은 측정은 이유를 적습니다', '억지로 칸을 채우지 않습니다');
        await wait(2600, t);
        await scrollTo(chat, n.offsetTop - chat.offsetTop - 20, t, 900);
        await wait(400, t);
      } },
      { async run(t) {                                                    // 6. open the PDF in the left pane
        begin(6);
        if (!mainPdfBtn || !mainPdfBtn.isConnected) return;
        await moveTo(at(mainPdfBtn, 0.4), t); mainPdfBtn.classList.add('hot'); await wait(250, t);
        await click(t);
        mainPdfBtn.classList.remove('hot');
        openPdf(false);
        await wait(700, t);
        ploading.hidden = true; pscroll.hidden = false;
        await moveTo(at(pdfImgs[0], 0.5, 0.35), t, 700);
        say('⑥ 만들어진 월간 리포트 PDF', '이 PDF를 DosiReport에서 고르면 월간 점검표에 6칸이 들어갑니다');
        await wait(2200, t);
        markSteps(6, -1);
        await wait(600, t);
      } },
    ];

    setFor(-1);

    let readyFlag = false;
    let left = pdfImgs.length;
    const done = () => { left -= 1; if (left <= 0) readyFlag = true; };
    if (!left) readyFlag = true;
    pdfImgs.forEach((im) => { if (im.complete) done(); else { im.addEventListener('load', done); im.addEventListener('error', done); } });

    const player = DM.Player ? new DM.Player({ steps, render(k) { if (!destroyed) setFor(k); }, onChange() {} }) : null;
    return {
      player,
      get ready() { return readyFlag; },
      destroy() { destroyed = true; if (player) player.destroy(); O.destroy(); },
    };
  }

  DM.windows.consult = {
    title: 'DosiMachine - AI Consult (지능형 장비 QA 분석 & 컨설팅)', width: W, height: H, theme: 'consult',
    mount, progressLines, periodPrompt, STEPS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
