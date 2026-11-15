/* The Windows "열기" (Open) file dialog that File > Open and the toolbar open button show
   (main.py:3636 open_file -> filedialog.askopenfilename). It lists the three beam-data sample files and the field
   image; choosing one opens it (beam file -> DM.profileview.open, field image -> DM.mainview.open).

   Keyboard while the dialog is open: it owns the keyboard. Up/Down move the selection, Enter opens, Esc closes;
   every other key (H, 1-4, Space, F, arrows ...) is swallowed so the window-manager shortcuts cannot fire behind it. */
(function (root) {
  const DM = root.DM = root.DM || {};
  // 'RI_field_sample.dcm' and '*.dcm' are the only DICOM-name tokens bake/check_privacy.py allows.
  const SAMPLE_NAME = 'RI_field_sample.dcm';
  const SUPPORTED = ['dcm', 'tif', 'tiff', 'csv', 'asc', 'asv', 'mcc', 'opab'];
  // main.py:3639 filetypes
  const FILTERS = [
    { label: 'All supported (*.dcm *.tif *.tiff *.csv *.asc *.asv *.mcc *.opab)', exts: SUPPORTED },
    { label: 'DICOM Files (*.dcm)', exts: ['dcm'] },
    { label: 'IBA myQA Accept (*.opab)', exts: ['opab'] },
    { label: 'Profile (*.csv *.asc *.asv *.mcc)', exts: ['csv', 'asc', 'asv', 'mcc'] },
    { label: 'All Files (*.*)', exts: null },
  ];
  const TYPE_NAME = { csv: 'Microsoft Excel 쉼표로 구분된 값 파일', opab: 'OPAB 파일', mcc: 'MCC 파일', dcm: 'DCM 파일' };
  const extOf = (n) => (n.split('.').pop() || '').toLowerCase();
  const fmtSize = (kb) => kb.toLocaleString('en-US') + ' KB';

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  function fileRows() {
    const D = root.DM_DATA && root.DM_DATA.beamdata;
    const rows = [];
    if (D) D.files.forEach((f) => rows.push({ name: f.name, kb: f.size_kb, kind: 'beam' }));
    rows.push({ name: SAMPLE_NAME, kb: (D && D.field_size_kb) || 3203, kind: 'image' });
    rows.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
    return rows;
  }

  let cur = null;       // the open dialog { close }

  function open() {
    if (cur) return;
    if (DM.shell && DM.shell.closeMenus) DM.shell.closeMenus();
    const all = fileRows();
    let filter = FILTERS[0], shown = all.slice(), sel = -1, comboOpen = false;

    const ov = el('div', 'dm-od-ov');
    const dlg = el('div', 'dm-od'); ov.appendChild(dlg);
    const bar = el('div', 'od-title'); bar.appendChild(el('span', null, '열기'));
    const x = el('button', 'od-x', '✕'); bar.appendChild(x); dlg.appendChild(bar);

    // address row
    const addr = el('div', 'od-addr');
    ['←', '→', '⌄', '↑'].forEach((g, i) => addr.appendChild(el('span', 'od-nav' + (i < 3 ? ' dim' : ''), g)));
    const crumbs = el('div', 'od-crumbs');
    crumbs.append(el('i', 'od-folder'), el('span', null, '›'), el('span', null, '샘플 데이터'), el('span', null, '›'), el('span', null, '빔데이터'), el('span', null, '›'));
    addr.appendChild(crumbs);
    addr.appendChild(el('div', 'od-search', '빔데이터 검색'));
    dlg.appendChild(addr);
    const tools = el('div', 'od-tools');
    tools.append(el('span', null, '구성 ▾'), el('span', null, '새 폴더'));
    tools.appendChild(el('span', 'od-help', '?'));
    dlg.appendChild(tools);

    // body: navigation pane + file list
    const main = el('div', 'od-main'); dlg.appendChild(main);
    const nav = el('div', 'od-navpane'); main.appendChild(nav);
    [['★', '빠른 실행', 'hd'], ['▭', '바탕 화면', 'sub'], ['↓', '다운로드', 'sub'], ['▤', '문서', 'sub'], ['▣', '사진', 'sub'],
      ['☁', 'OneDrive', 'hd'], ['▢', '내 PC', 'hd'], ['⊞', '네트워크', 'hd']].forEach(([g, t, k]) => {
      const r = el('div', 'od-nrow ' + k); r.append(el('b', null, g), el('span', null, t)); nav.appendChild(r);
    });
    const list = el('div', 'od-list'); main.appendChild(list);
    const head = el('div', 'od-head');
    [['이름', 'c1', ' ^'], ['유형', 'c2', ''], ['크기', 'c3', '']].forEach(([t, c, s]) => head.appendChild(el('div', c, t + s)));
    list.appendChild(head);
    const body = el('div', 'od-rows'); list.appendChild(body);

    // footer
    const foot = el('div', 'od-foot'); dlg.appendChild(foot);
    const r1 = el('div', 'od-frow'); foot.appendChild(r1);
    r1.appendChild(el('label', null, '파일 이름(N):'));
    const input = el('input', 'od-name'); input.type = 'text'; input.spellcheck = false; r1.appendChild(input);
    const combo = el('div', 'od-combo'); const comboText = el('span', null, filter.label); combo.append(comboText, el('b', null, '⌄'));
    r1.appendChild(combo);
    const menu = el('div', 'od-combo-menu'); menu.style.display = 'none';
    FILTERS.forEach((f) => { const o = el('div', null, f.label); o.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); setFilter(f); }); menu.appendChild(o); });
    foot.appendChild(menu);
    const r2 = el('div', 'od-frow btns'); foot.appendChild(r2);
    const bOpen = el('button', 'od-btn def', '열기(O)'), bCancel = el('button', 'od-btn', '취소');
    r2.append(bOpen, bCancel);

    function renderRows() {
      body.textContent = '';
      shown.forEach((r, i) => {
        const row = el('div', 'od-row' + (i === sel ? ' sel' : ''));
        const c1 = el('div', 'c1'); c1.append(el('i', 'od-ico ' + (extOf(r.name) === 'dcm' ? 'dicom' : extOf(r.name))), document.createTextNode(r.name));
        row.append(c1, el('div', 'c2', TYPE_NAME[extOf(r.name)] || ''), el('div', 'c3', fmtSize(r.kb)));
        row.addEventListener('mousedown', (e) => { e.preventDefault(); select(i); input.focus(); });
        row.addEventListener('dblclick', () => choose(r));
        body.appendChild(row);
      });
    }
    function select(i) {
      sel = Math.max(0, Math.min(shown.length - 1, i));
      if (!shown.length) return;
      [...body.children].forEach((n, j) => n.classList.toggle('sel', j === sel));
      input.value = shown[sel].name;
    }
    function setFilter(f) {
      filter = f; comboText.textContent = f.label; menu.style.display = 'none'; comboOpen = false;
      shown = f.exts ? all.filter((r) => f.exts.includes(extOf(r.name))) : all.slice();
      sel = -1; input.value = ''; renderRows();
    }
    function close() {
      window.removeEventListener('keydown', onKey, true);
      ov.remove(); cur = null;
    }
    function choose(r) {
      close();
      if (r.kind === 'image') { if (DM.mainview) DM.mainview.open(); }
      else if (DM.profileview) DM.profileview.open(r.name);
    }
    function accept() {
      const typed = input.value.trim().toLowerCase();
      const hit = typed ? all.find((r) => r.name.toLowerCase() === typed) : shown[sel];
      if (hit) choose(hit); else if (typed) DM.shell.toast('파일을 찾을 수 없습니다');
    }
    function onKey(e) {
      if (e.ctrlKey || e.altKey || e.metaKey) return;                // browser shortcuts stay with the browser
      const k = e.key;
      if (k === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (comboOpen) { menu.style.display = 'none'; comboOpen = false; } else close(); return; }
      if (k === 'Enter') {
        e.preventDefault(); e.stopImmediatePropagation();
        if (document.activeElement === bCancel) close(); else accept();
        return;
      }
      if (k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); e.stopImmediatePropagation(); select(sel < 0 ? 0 : sel + (k === 'ArrowDown' ? 1 : -1)); return; }
      e.stopImmediatePropagation();      // keep H, 1-4, Space, F, arrows away from the window manager; typing still works
    }

    x.addEventListener('click', close); bCancel.addEventListener('click', close);
    bOpen.addEventListener('click', accept);
    combo.addEventListener('mousedown', (e) => { e.preventDefault(); comboOpen = !comboOpen; menu.style.display = comboOpen ? 'block' : 'none'; });
    ov.addEventListener('mousedown', (e) => { if (!dlg.contains(e.target)) e.preventDefault(); });
    renderRows();
    document.body.appendChild(ov);
    window.addEventListener('keydown', onKey, true);   // window capture runs before every document listener
    input.focus();
    cur = { close };
  }

  DM.opendialog = { open, close() { if (cur) cur.close(); }, get isOpen() { return !!cur; }, FILTERS };
})(typeof window !== 'undefined' ? window : globalThis);
