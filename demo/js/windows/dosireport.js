/* DosiReport replica (Reports > DosiReport) with a self-playing walkthrough.
   Replica of dosireport/frontend (index.html, script.js, style.css): dark control sidebar, spreadsheet preview.
   All data is baked by bake/bake_dosireport.py from the real DosiReport backend: the sample 점검표.xlsx sheets, the
   report folder list and the links /api/reports/extract proposes for the monthly period report.

   On open the demo plays by itself (winman autoRun): a fake cursor clicks, in the original's order,
   월간 점검표 tab -> AI_작업 folder -> the report (link map appears) -> ↗ PDF view -> 미리보기에 적용,
   then points at each filled cell. Space pauses, arrows step, like the other live windows.
   Not in the original: the cursor, the captions and the step card (demo overlay). Save is never pressed.
   The report-folder path shown is a placeholder (the real one holds the PC user name). */
(function (root) {
  const DM = root.DM = root.DM || {};
  DM.windows = DM.windows || {};

  const W = 1707, H = 996;
  const FOLDER_PATH = 'C:/DosiCare/Report';
  const AI_MODEL = 'gemini-2.5-flash';            // app_config.json ai_model; the original banner names it
  const PDF_W = 1060;                              // shown width of a PDF page in the popup
  const STEPS = [
    { t: '월간 점검표 시트 열기', cap: '① 월간 점검표 시트를 엽니다', sub: '링크는 지금 열린 시트를 기준으로 만들어집니다' },
    { t: '보고서 폴더 열기', cap: '② 보고서 폴더를 엽니다', sub: 'DosiMachine 분석 리포트가 폴더별로 모여 있습니다' },
    { t: '보고서 선택 → 링크 맵', cap: '③ 월간 리포트를 고릅니다', sub: '리포트 값과 점검표 칸이 자동으로 짝지어집니다' },
    { t: 'PDF 보기', cap: '④ ↗ 버튼으로 원본 PDF를 확인합니다', sub: '어느 리포트의 어떤 값인지 눈으로 대조' },
    { t: '미리보기에 적용', cap: '⑤ [미리보기에 적용]을 누릅니다', sub: '값이 월간 점검표 칸에 들어갑니다' },
    { t: '월간 점검표에서 확인', cap: '⑥ 노란 칸 = 리포트에서 들어온 값', sub: '' },
  ];

  const h = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const colLetter = (c) => { let s = ''; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };

  // values the preview shows for one sheet: baked cells, plus the link values once applied (pure; tested in node)
  function cellValues(D, sheetName, applied) {
    const out = {};
    const sh = D.sheets.find((s) => s.name === sheetName);
    sh.rows.forEach((r) => r.cells.forEach((c) => { out[colLetter(c.c) + r.r] = c.v == null ? '' : c.v; }));
    const fresh = {};
    if (applied && sheetName === D.target_sheet) {
      D.links.forEach((l) => { out[l.cell_coordinate] = l.value_to_write; fresh[l.cell_coordinate] = true; });
    }
    return { values: out, fresh };
  }

  function mount(body) {
    const D = root.DM_DATA && root.DM_DATA.dosireport;
    if (!D) { body.appendChild(h('div', 'dr-grid-msg', 'DosiReport 데이터가 없습니다 (bake_dosireport.py).')); return { destroy() {} }; }
    let destroyed = false;

    const st = { tab: 0, open: false, selected: false, applied: false };

    /* ---------------- layout (index.html) ---------------- */
    const app = h('div', 'dr-app');
    const side = h('aside', 'dr-side');
    const head = h('div', 'dr-side-head');
    const logo = h('img'); logo.src = 'assets/dosireport_logo.png'; logo.alt = 'DosiReport'; logo.draggable = false;
    head.append(logo, h('span', 'dr-subtitle', 'QA Checklist Automator'));

    const secSet = h('section', 'dr-sec');
    secSet.append(h('h2', 'dr-title col', '1. 설정'));
    const g1 = h('div', 'dr-group');
    g1.append(h('label', 'dr-label', '대상 파일 (엑셀/워드)'), h('div', 'dr-ctl sel', D.excel));
    const g2 = h('div', 'dr-group');
    const row2 = h('div', 'dr-row');
    row2.append(h('div', 'dr-ctl', FOLDER_PATH), h('button', 'dr-btn', '불러오기'));
    g2.append(h('label', 'dr-label', '리포트 폴더 경로'), row2);
    secSet.append(g1, g2);

    const secRep = h('section', 'dr-sec grow');
    secRep.append(h('h2', 'dr-title col', '2. 보고서 선택'));
    const reports = h('div', 'dr-reports');
    secRep.appendChild(reports);
    let folderEl = null, itemEl = null, viewBtn = null;
    D.folders.forEach((name) => {
      const g = h('div', 'dr-folder collapsed');
      const fh = h('div', 'dr-folder-head', '📁 ' + name);
      g.appendChild(fh);
      if (name === D.folder) {
        folderEl = g;
        const files = h('div', 'dr-files');
        D.files.forEach((f) => {
          const it = h('div', 'dr-item');
          it.append(h('span', null, f), h('span', 'dr-badge', f.split('.').pop().toUpperCase()));
          const vb = h('button', 'dr-view', '↗'); vb.tabIndex = -1;
          it.appendChild(vb);
          if (f === D.report) { itemEl = it; viewBtn = vb; }
          files.appendChild(it);
        });
        g.appendChild(files);
      }
      reports.appendChild(g);
    });

    const secExt = h('section', 'dr-sec extract');
    const t3 = h('h2', 'dr-title', '3. 추출 데이터 및 셀 링크');
    t3.style.marginBottom = '8px';
    t3.appendChild(h('button', 'dr-btn small', '+ 수동 매핑 추가'));
    const ext = h('div', 'dr-extract');
    const actions = h('div', 'dr-actions');
    const two = h('div', 'two');
    const bAi = h('button', 'dr-btn', '🤖 AI 정밀 분석'); bAi.style.background = 'linear-gradient(135deg, #1e3a8a, #2563eb)';
    const bMem = h('button', 'dr-btn', '💾 매핑 규칙 기억'); bMem.style.background = 'linear-gradient(135deg, #065f46, #059669)';
    two.append(bAi, bMem);
    const bApply = h('button', 'dr-btn primary disabled', '미리보기에 적용 (Apply)');
    bApply.style.fontWeight = 'bold';
    actions.append(two, bApply);
    secExt.append(t3, ext, actions);

    const foot = h('div', 'dr-foot');
    const bUndo = h('button', 'dr-btn', '↶ 되돌리기'); bUndo.style.flexShrink = '0';
    const bSave = h('button', 'dr-btn success', '최종 수정 사항 저장 (Save)'); bSave.style.flexGrow = '1';
    foot.append(bUndo, bSave);
    side.append(head, secSet, secRep, secExt, foot);

    const main = h('main', 'dr-main');
    const mh = h('header', 'dr-head');
    const info = h('div', 'dr-info');
    const status = h('span', 'dr-status', '저장 완료');
    info.append(h('h2', null, D.excel), status);
    const tabs = h('nav', 'dr-tabs');
    const tabEls = D.sheet_names.map((n) => { const t = h('div', 'dr-tab', n); tabs.appendChild(t); return t; });
    mh.append(info, tabs);
    const vp = h('div', 'dr-viewport');
    const gridbox = h('div', 'dr-gridbox');
    vp.appendChild(gridbox);
    main.append(mh, vp);

    // PDF quick preview popup
    const over = h('div', 'dr-pdf-over');
    const pop = h('div', 'dr-pdf');
    const ph = h('div', 'dr-pdf-head');
    const pdfX = h('span', 'dr-pdf-x', '×');
    ph.append(h('span', 'dr-pdf-title', D.report), pdfX);
    const pbody = h('div', 'dr-pdf-body');
    const pdfImgs = D.pdf.map((p) => {
      const im = h('img'); im.src = p.file; im.alt = ''; im.draggable = false;
      im.style.width = PDF_W + 'px'; im.style.height = Math.round(p.h * PDF_W / p.w) + 'px';
      pbody.appendChild(im); return im;
    });
    pop.append(ph, pbody);
    over.appendChild(pop);

    app.append(side, main, over);
    body.appendChild(app);
    const O = DM.demoOverlay(app, { W, H, title: '자동 시연 · DosiReport 작업 순서', steps: STEPS });
    const { at, say, wait, moveTo, click, scrollTo, centerTop, markSteps, begin, later } = O;

    /* ---------------- grid (renderGrid) ---------------- */
    function renderGrid() {
      const name = D.sheet_names[st.tab];
      const sh = D.sheets.find((s) => s.name === name);
      gridbox.innerHTML = '';
      if (!sh) { gridbox.appendChild(h('div', 'dr-grid-msg', '시트를 선택하면 미리보기가 표시됩니다.')); return; }
      const { values, fresh } = cellValues(D, name, st.applied);
      const covered = {}, span = {};
      sh.merges.forEach(([r1, c1, r2, c2]) => {
        span[r1 + ',' + c1] = [r2 - r1 + 1, c2 - c1 + 1];
        for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) if (r !== r1 || c !== c1) covered[r + ',' + c] = true;
      });
      const table = h('table', 'dr-grid');
      const tb = h('tbody');
      const hr = h('tr');
      hr.appendChild(h('td', 'hdr'));
      for (let c = 1; c <= sh.max_col; c++) {
        const th = h('td', 'hdr', colLetter(c));
        th.style.minWidth = ((sh.col_widths[c] || 8) * 8) + 'px';
        hr.appendChild(th);
      }
      tb.appendChild(hr);
      sh.rows.forEach((r) => {
        const tr = h('tr');
        if (r.h) tr.style.height = r.h + 'px';
        tr.appendChild(h('td', 'hdr', String(r.r)));
        r.cells.forEach((c) => {
          if (covered[r.r + ',' + c.c]) return;
          const coord = colLetter(c.c) + r.r;
          const td = h('td', fresh[coord] ? 'new' : null, String(values[coord]));
          td.dataset.coord = coord;
          if (c.b) td.style.fontWeight = 'bold';
          td.style.fontSize = ((c.s || 11) + 1) + 'px';
          if (c.fg) td.style.color = c.fg;
          if (c.bg) td.style.backgroundColor = c.bg;
          if (c.a) td.style.textAlign = c.a;
          const sp = span[r.r + ',' + c.c];
          if (sp) { td.rowSpan = sp[0]; td.colSpan = sp[1]; }
          tr.appendChild(td);
        });
        tb.appendChild(tr);
      });
      table.appendChild(tb);
      gridbox.appendChild(table);
    }

    /* ---------------- link map (renderLinksList) ---------------- */
    const cardEls = {};
    function renderLinks(animate) {
      ext.innerHTML = '';
      Object.keys(cardEls).forEach((k) => delete cardEls[k]);
      if (!st.selected) { ext.appendChild(h('p', 'dr-empty', '보고서를 선택하면 링크 맵이 생성됩니다.')); return []; }
      if (D.ai_summary) {
        const b = h('div', 'dr-banner');
        b.append(h('b', null, '✨ AI 정밀 분석 총평 (' + AI_MODEL + ')'), h('div', null, D.ai_summary));
        ext.appendChild(b);
      }
      const cards = D.links.map((l) => {
        const card = h('div', 'dr-card' + (animate ? ' enter' : ''));
        const hd = h('div', 'dr-card-head');
        hd.append(h('span', 'dr-lbadge', l.origin === 'period_pdf' ? '기간 리포트' : 'QA 파싱'), h('span', 'lbl', l.excel_label),
          h('span', 'dr-del', '🗑️'), h('span', 'dr-chk', '✓'));
        const mp = h('div', 'dr-map');
        mp.append(h('span', 'dr-in cell', l.cell_coordinate), h('span', 'dr-pick', '🎯'),
          h('span', 'dr-in', l.value_to_write == null ? '' : l.value_to_write), h('span', 'dr-pf', l.pass_fail || '-'));
        card.append(hd, mp);
        if (l.reason) card.appendChild(h('div', 'dr-reason', '💡 ' + l.reason));
        ext.appendChild(card);
        cardEls[l.cell_coordinate] = card;
        return card;
      });
      return cards;
    }

    function paint() {
      tabEls.forEach((t, i) => { t.classList.toggle('active', i === st.tab); t.classList.remove('hot'); });
      folderEl.classList.toggle('collapsed', !st.open);
      folderEl.classList.remove('hot');
      itemEl.classList.toggle('active', st.selected);
      itemEl.classList.remove('hot'); viewBtn.classList.remove('hot');
      renderLinks(false);
      bApply.classList.toggle('disabled', !st.selected); bApply.classList.remove('hot'); bSave.classList.remove('hot');
      status.textContent = st.applied ? '저장 대기중' : '저장 완료';
      status.classList.toggle('unsaved', st.applied);
      renderGrid();
    }

    /* ---------------- demo overlay (js/demo-overlay.js) ---------------- */
    const td = (coord) => gridbox.querySelector('td[data-coord="' + coord + '"]');
    function flash(el) { el.classList.add('flash'); later(() => el.classList.remove('flash'), 1500); }

    /* ---------------- the walkthrough ---------------- */
    const steps = [
      { async run(t) {                                                    // 1. 월간 점검표 tab
        begin(0);
        const tab = tabEls[D.sheet_names.indexOf(D.target_sheet)];
        await moveTo(at(tab), t); tab.classList.add('hot'); await wait(200, t);
        await click(t);
        st.tab = D.sheet_names.indexOf(D.target_sheet);
        tabEls.forEach((e, i) => { e.classList.toggle('active', i === st.tab); e.classList.remove('hot'); });
        gridbox.innerHTML = ''; gridbox.appendChild(h('div', 'dr-grid-msg', '시트 데이터를 로딩 중...'));
        await wait(450, t);
        renderGrid(); gridbox.scrollTop = 0;
        await wait(900, t);
      } },
      { async run(t) {                                                    // 2. AI_작업 folder
        begin(1);
        const fh = folderEl.firstChild;
        await scrollTo(secRep, 0, t, 300);
        await moveTo(at(fh, 0.3), t); folderEl.classList.add('hot'); await wait(200, t);
        await click(t);
        st.open = true; folderEl.classList.remove('collapsed'); folderEl.classList.remove('hot');
        await wait(700, t);
      } },
      { async run(t) {                                                    // 3. pick the report -> link map
        begin(2);
        await scrollTo(secRep, centerTop(secRep, itemEl), t, 500);
        await moveTo(at(itemEl, 0.4), t); itemEl.classList.add('hot'); await wait(250, t);
        await click(t);
        st.selected = true; itemEl.classList.remove('hot'); itemEl.classList.add('active');
        ext.innerHTML = ''; ext.appendChild(h('p', 'dr-empty', '링크를 분석 중...'));
        await wait(1000, t);
        const cards = renderLinks(true);
        for (const c of cards) { await wait(170, t); c.classList.remove('enter'); }
        bApply.classList.remove('disabled');
        say('③ 링크 맵 ' + D.links.length + '칸이 만들어졌습니다', '칸 좌표 · 값 · 출처 리포트가 카드로 보입니다');
        await moveTo(at(ext, 0.55, 0.35), t, 700);
        await wait(1800, t);
      } },
      { async run(t) {                                                    // 4. ↗ PDF view
        begin(3);
        await moveTo(at(viewBtn), t); viewBtn.classList.add('hot'); await wait(250, t);
        await click(t);
        viewBtn.classList.remove('hot');
        pbody.scrollTop = 0; over.classList.add('on');
        await wait(700, t);
        say('④ 원본 리포트(PDF)', '표의 칸·값이 왼쪽 링크 맵과 같습니다');
        await moveTo(at(pbody, 0.5, 0.45), t, 700);
        await wait(1600, t);
        const p1 = pdfImgs[0];                       // page 1 holds the table; page 2 is nearly empty
        await scrollTo(pbody, p1.offsetTop - pbody.offsetTop + p1.offsetHeight - pbody.clientHeight + 24, t, 1800);
        await wait(900, t);
        await moveTo(at(pdfX), t); pdfX.classList.add('hot'); await wait(250, t);
        await click(t);
        over.classList.remove('on'); pdfX.classList.remove('hot');
        await wait(500, t);
      } },
      { async run(t) {                                                    // 5. 미리보기에 적용
        begin(4);
        await moveTo(at(bApply), t); bApply.classList.add('hot'); await wait(250, t);
        await click(t);
        bApply.classList.remove('hot');
        st.applied = true;
        status.textContent = '저장 대기중'; status.classList.add('unsaved');
        renderGrid();
        const first = td(D.links[0].cell_coordinate);    // the original scrolls to the first applied cell and flashes it
        await scrollTo(gridbox, centerTop(gridbox, first), t, 900);
        flash(first);
        await wait(1400, t);
      } },
      { async run(t) {                                                    // 6. point at every filled cell
        begin(5);
        const groups = [];
        D.links.forEach((l) => {
          const g = groups.find((x) => Math.abs(x.row - l.row) <= 3);
          if (g) g.links.push(l); else groups.push({ row: l.row, links: [l] });
        });
        for (const g of groups) {
          const cells = g.links.map((l) => td(l.cell_coordinate));
          await scrollTo(gridbox, centerTop(gridbox, cells[0]), t, 900);
          for (const l of g.links) {
            const cell = td(l.cell_coordinate);
            await moveTo(at(cell, 0.7, 0.6), t, 550);
            say('⑥ ' + l.cell_coordinate + ' = ' + l.value_to_write, l.excel_label);
            flash(cell);
            const card = cardEls[l.cell_coordinate];
            if (card) { card.classList.add('glow'); ext.scrollTop = Math.max(0, centerTop(ext, card)); }
            await wait(1100, t);
            if (card) card.classList.remove('glow');
          }
        }
        await moveTo(at(bSave), t, 900); bSave.classList.add('hot');
        say('검토가 끝나면 사람이 [저장]을 누릅니다', '저장해야 엑셀 파일에 기록됩니다 · 시연에서는 누르지 않습니다');
        markSteps(5, -1);
        await wait(600, t);
      } },
    ];

    function setFor(i) {                            // end state of step i (-1 = just opened)
      over.classList.remove('on'); pdfX.classList.remove('hot');
      st.tab = i >= 0 ? D.sheet_names.indexOf(D.target_sheet) : 0;
      st.open = i >= 1; st.selected = i >= 2; st.applied = i >= 4;
      paint();
      secRep.scrollTop = i >= 2 ? centerTop(secRep, itemEl) : 0;
      gridbox.scrollTop = 0;
      const focus = i >= 5 ? D.links[D.links.length - 1] : (i >= 4 ? D.links[0] : null);
      if (focus) { const c = td(focus.cell_coordinate); if (c) gridbox.scrollTop = centerTop(gridbox, c); }
      O.settle(i, '시연 끝 · 노란 칸이 리포트에서 들어온 값입니다');
    }

    paint();

    // ready once the logo and the PDF pages have loaded (or failed)
    let readyFlag = false;
    const imgs = [logo].concat(pdfImgs);
    let left = imgs.length;
    const done = () => { left -= 1; if (left <= 0) readyFlag = true; };
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

  DM.windows.dosireport = {
    title: 'DosiReport - QA Checklist Automator', width: W, height: H, theme: 'dosireport',
    mount, cellValues, STEPS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
