/* DosiMachine replica - Machine QA > EPID Output Constancy / Wedge Factor (epid_output_constancy_window.py).
   Layout follows the original window maximised (the old capture screens/epid_output.png, 1707 x 996 client;
   positions below are client px = capture y - 23). Tk scaling 1.333: Segoe UI 12 pt = 16 px, 9 = 12, 8 = 10.67.
   The walkthrough (Space / auto-run) clicks what a user clicks:
     1. OPEN FIELD IMAGES > Add   -> the open-field image
     2. ANALYZE                   -> no baseline yet: N/A, STATUS: NO BASELINE, the warning, the image with its ROI
     3. SET AS BASELINE           -> the original's confirm and info boxes
     4. ANALYZE                   -> judged against that baseline: +0.00 %, PASS
   Real (bake/bake_epidout.py -> data/epidout.js, data/epidout_fig.webp): every row, banner, warning and message,
   and the figure itself, from the original window run on the Halcyon 6FFF image of the old capture (its UID file
   name shown as RI_field_sample.dcm, as elsewhere in the demo). No wedge image: the sample data has none this
   window can read. Not in the original: the simplified file dialog. SAVE TO TREND / EXPORT PDF are not part of
   the demo. The file dialog and message boxes reuse the .ep-dlg styles of css/epipdd.css. */
(function (root) {
  const DM = root.DM = root.DM || {};
  DM.windows = DM.windows || {};

  const W = 1707, H = 996;
  const NAVY = '#1A5276', BG = '#EBF5FB';
  const FONT = '"Segoe UI", sans-serif';
  // Treeview columns: capture x boundaries 349 ... 1695
  const COLS = [['Type', 107], ['Energy', 111], ['Wedge', 101], ['File', 281], ['ROI mean (CU)', 145], ['MU', 110],
    ['CU/MU | EPID WF', 140], ['Baseline', 130], ['Dev %', 110], ['Status', 111]];
  const TAG = { PASS: '#059669', WARN: '#B7950B', FAIL: '#E74C3C' };

  function h(tag, css, text) {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }
  const abs = (x, y, w, hh, css) => 'position:absolute;left:' + x + 'px;top:' + y + 'px;' + (w != null ? 'width:' + w + 'px;' : '') +
    (hh != null ? 'height:' + hh + 'px;' : '') + 'box-sizing:border-box;' + (css || '');

  function mount(body) {
    const D = root.DM_DATA && root.DM_DATA.epidout;
    body.style.background = BG;
    body.style.fontFamily = FONT;
    if (!D) { body.appendChild(h('div', null, 'EPID Output 데이터가 없습니다 (bake_epidout.py).')); return { destroy() {} }; }
    let destroyed = false;
    const toast = () => DM.shell.toast('데모에서는 동작하지 않습니다');
    const add = (e) => { body.appendChild(e); return e; };

    let player = null;
    const go = async () => {
      if (!player || destroyed) return;
      if (player.state.playing) { player.pause(); return; }
      if (player.index >= player.steps.length - 1) await player.reset();
      player.play();
    };

    /* ---------------- header, top row ---------------- */
    add(h('div', abs(0, 0, W, 36, 'background:' + NAVY + ';')));
    add(h('div', abs(18, 0, null, 36, 'font:700 16px ' + FONT + ';line-height:36px;color:#F8FAFC;white-space:nowrap;'), 'EPID OUTPUT CONSTANCY / WEDGE FACTOR'));
    add(h('div', abs(380, 0, null, 36, 'font:12px ' + FONT + ';line-height:36px;color:#AED6F1;white-space:nowrap;'), 'TG-142 monthly: central-axis CU/MU vs baseline'));
    const lab = (t, x) => add(h('div', abs(x, 40, null, 25, 'font:700 12px ' + FONT + ';line-height:25px;color:' + NAVY + ';white-space:nowrap;'), t));
    const combo = (x, w, v) => {
      const c = add(h('div', abs(x, 42, w, 21, 'background:#fff;border:1px solid #7A7A7A;font:12px ' + FONT + ';line-height:19px;padding-left:3px;cursor:default;'), v));
      const b = h('div', 'position:absolute;right:0;top:0;width:16px;height:19px;background:#E1E1E1;border-left:1px solid #ADADAD;');
      b.appendChild(h('div', 'position:absolute;left:4px;top:8px;border-left:4px solid transparent;border-right:4px solid transparent;border-top:4px solid #000;'));
      c.appendChild(b); c.addEventListener('click', toast);
      return c;
    };
    const entry = (x, w, v) => { const e = add(h('div', abs(x, 42, w, 21, 'background:#fff;border:1px solid #7A7A7A;font:12px ' + FONT + ';line-height:19px;text-align:center;cursor:text;'), v)); e.addEventListener('click', toast); return e; };
    lab('Machine:', 23); combo(79, 82, D.machine);
    lab('Trend store equipment:', 173); combo(311, 82, D.machine);
    lab('ROI (mm @iso):', 405); entry(497, 41, Number(D.roi).toFixed(1));
    lab('Date:', 550); entry(586, 70, D.date);
    lab('Energy if not in header:', 669); combo(805, 62, '');

    /* ---------------- left: file cards, buttons, warnings ---------------- */
    function card(y, title) {
      const c = add(h('div', abs(10, y, 330, 274, 'background:#fff;border:1px solid #BDC3C7;')));
      c.appendChild(h('div', abs(0, 0, 328, 24, 'background:#D6EAF8;color:' + NAVY + ';font:700 12px ' + FONT + ';line-height:24px;text-align:center;'), title));
      const list = h('div', abs(5, 27, 318, 218, 'font:10.67px ' + FONT + ';line-height:14px;color:#000;overflow:hidden;white-space:nowrap;'));
      c.appendChild(list);
      const bs = {};
      [['Add', 6, 28], ['Remove', 36, 46], ['Clear', 84, 33]].forEach(([t, x, w]) => {
        const b = h('div', abs(x, 250, w, 20, 'background:#F4F6F7;border:1px solid #000;font:10.67px ' + FONT + ';line-height:18px;text-align:center;cursor:pointer;user-select:none;'), t);
        b.addEventListener('click', t === 'Add' ? go : toast);
        c.appendChild(b); bs[t] = b;
      });
      return { list, add: bs.Add };
    }
    const openCard = card(70, 'OPEN FIELD IMAGES (one per energy)');
    card(350, 'WEDGE IMAGES');
    const btn = (t, y, hh, bg, size, x, w, fn) => {
      const b = add(h('div', abs(x == null ? 10 : x, y, w || 330, hh, 'background:' + bg + ';color:#fff;font:700 ' + size + 'px ' + FONT + ';display:flex;align-items:center;justify-content:center;cursor:pointer;user-select:none;white-space:nowrap;'), t));
      b.dataset.bg = bg;
      b.addEventListener('click', fn || toast);
      return b;
    };
    const bAnalyze = btn('ANALYZE', 634, 31, NAVY, 13.33, null, null, go);
    const bBase = btn('SET AS BASELINE', 668, 23, '#5D6D7E', 10.67, null, null, go);
    btn('SAVE TO TREND', 694, 25, '#117A65', 10.67, 11, 162);
    btn('EXPORT PDF', 694, 25, '#E74C3C', 10.67, 175, 164);
    add(h('div', abs(12, 724, null, 22, 'font:700 12px ' + FONT + ';line-height:22px;color:' + NAVY + ';'), 'WARNINGS'));
    const warn = add(h('div', abs(10, 747, 330, 240, 'background:#fff;border:1px solid #000;padding:2px;font:10.67px ' + FONT + ';line-height:14px;color:#B03A2E;white-space:pre-wrap;overflow-wrap:anywhere;overflow:hidden;')));

    /* ---------------- right: table, banner, figure ---------------- */
    const tree = add(h('div', abs(348, 70, 1349, 226, 'background:#fff;border:1px solid #828790;overflow:hidden;')));
    let x0 = 0;
    COLS.forEach(([t, w]) => {
      tree.appendChild(h('div', abs(x0, 0, w, 25, 'background:#fff;border-right:1px solid #E5E5E5;border-bottom:1px solid #E5E5E5;font:700 12px ' + FONT + ';line-height:24px;text-align:center;color:#000;white-space:nowrap;'), t));
      x0 += w;
    });
    const rowsBox = h('div', abs(0, 25, 1347, 200, ''));
    tree.appendChild(rowsBox);
    const banner = add(h('div', abs(348, 301, 1349, 31, 'font:700 14.67px ' + FONT + ';line-height:31px;text-align:center;')));
    const fig = add(h('img', abs(348, 336, 1349, 652, 'display:block;opacity:0;transition:opacity .35s;user-select:none;')));
    fig.alt = ''; fig.draggable = false;
    const figImg = new Image(); figImg.src = D.fig;

    function paintRows(snap) {
      rowsBox.textContent = '';
      (snap ? snap.rows : []).forEach((vals, i) => {
        const r = h('div', abs(1, i * 22, 1345, 22, 'background:#2E5F8E;color:#fff;'));    // the first row is selected after ANALYZE
        let x = 0;
        vals.forEach((v, k) => {
          const w = COLS[k][1] - (k === 0 ? 1 : 0);
          r.appendChild(h('div', abs(x, 0, w, 22, 'font:12px ' + FONT + ';line-height:22px;white-space:nowrap;overflow:hidden;' +
            (k === 3 ? 'text-align:left;padding-left:4px;' : 'text-align:center;')), v));
          x += w;
        });
        r.title = snap.tags[i];
        rowsBox.appendChild(r);
      });
    }
    function setBanner(text, bg, fg) { banner.textContent = text; banner.style.background = bg; banner.style.color = fg; }

    /* ---------------- dialogs (styles: css/epipdd.css .ep-dlg) ---------------- */
    let modal = null;
    const wait = (ms, token) => DM.anim.wait(ms, token);
    function press(b, token) {
      const base = b.dataset.bg;
      b.style.background = base ? '#2980B9' : '#CCE4F7';
      return wait(240, token).finally(() => { b.style.background = base || '#F4F6F7'; });
    }
    function dialog(build, hold, token) {
      return new Promise((resolve, reject) => {
        const veil = h('div', 'position:absolute;inset:0;z-index:30;');
        const { box, ok } = build();
        veil.appendChild(box);
        body.appendChild(veil);
        let over = false;
        const done = async (cancelled) => {
          if (over) return; over = true;
          if (!cancelled) { ok.classList.add('ep-press'); await new Promise((r) => setTimeout(r, 180)); }
          veil.remove(); modal = null;
          if (cancelled) reject(DM.anim.CANCEL); else resolve();
        };
        ok.addEventListener('click', () => done(false));
        modal = { close: () => done(true) };
        wait(hold, token).then(() => done(false), () => done(true));
      });
    }
    function boxAt(w, hh, title) {
      const box = document.createElement('div');
      box.className = 'ep-dlg';
      box.style.cssText = 'left:' + Math.round((W - w) / 2) + 'px;top:' + Math.round((H - hh) / 2 - 60) + 'px;width:' + w + 'px;height:' + hh + 'px;';
      const bar = document.createElement('div'); bar.className = 'ep-dlg-bar'; bar.textContent = title;
      box.appendChild(bar);
      return box;
    }
    const dlgBtn = (box, t, right, bottom, pri) => {
      const b = document.createElement('div'); b.className = 'ep-dlg-btn' + (pri ? ' pri' : ''); b.textContent = t;
      b.style.right = right + 'px'; b.style.bottom = bottom + 'px'; box.appendChild(b); return b;
    };
    const openDlg = () => {
      const box = boxAt(560, 190, 'OPEN FIELD IMAGES (one per energy)');
      const list = document.createElement('div'); list.className = 'ep-files'; list.style.height = '20px';
      const row = document.createElement('div'); row.className = 'sel'; row.textContent = D.file; list.appendChild(row);
      box.appendChild(list);
      box.appendChild(h('div', 'position:absolute;left:16px;top:94px;line-height:22px;', 'File name:'));
      const f = document.createElement('div'); f.className = 'ep-field'; f.style.cssText += 'left:112px;right:20px;top:92px;';
      const s = document.createElement('span'); s.textContent = D.file; f.appendChild(s); box.appendChild(f);
      const t = document.createElement('div'); t.className = 'ep-field ro'; t.style.cssText += 'left:112px;right:20px;top:124px;'; t.textContent = 'DICOM RT Image (*.dcm)'; box.appendChild(t);
      const ok = dlgBtn(box, 'Open', 116, 8, true); dlgBtn(box, 'Cancel', 20, 8);
      return { box, ok };
    };
    const msgDlg = (title, text, icon, yesNo) => () => {
      const lines = text.split('\n');
      const w = Math.min(640, Math.max(380, 120 + Math.max(...lines.map((l) => l.length)) * 6.4));
      const box = boxAt(w, 46 + lines.length * 18 + 76, title);
      const ic = document.createElement('div'); ic.className = 'ep-icon'; ic.textContent = icon;
      if (icon === '?') ic.style.fontFamily = FONT;
      box.appendChild(ic);
      const m = document.createElement('div'); m.className = 'ep-msg'; m.textContent = text; box.appendChild(m);
      const ok = dlgBtn(box, yesNo ? 'Yes' : 'OK', yesNo ? 116 : 20, 14, true);
      if (yesNo) dlgBtn(box, 'No', 20, 14);
      return { box, ok };
    };

    /* ---------------- walkthrough ---------------- */
    function analyzedView(snap) {
      paintRows(snap);
      setBanner(snap.status, snap.status_bg, snap.status_fg);
      warn.textContent = snap.warnings;
      fig.src = D.fig; fig.style.opacity = '1';
    }
    const steps = [
      { name: 'add', async run(token) {
        await press(openCard.add, token);
        await dialog(openDlg, 1300, token);
        openCard.list.textContent = D.file;
        await wait(500, token);
      } },
      { name: 'analyze', async run(token) {
        await press(bAnalyze, token);
        setBanner('STATUS: ANALYZING', '#D6EAF8', NAVY);
        await wait(700, token);
        analyzedView(D.first);
        await wait(2600, token);
      } },
      { name: 'baseline', async run(token) {
        await press(bBase, token);
        await dialog(msgDlg(D.ask[0], D.ask[1], '?', true), 2600, token);
        const m = D.baseline_msg[0];
        await dialog(msgDlg(m[1], m[2], 'i', false), 2400, token);
        await wait(300, token);
      } },
      { name: 'reanalyze', async run(token) {
        await press(bAnalyze, token);
        setBanner('STATUS: ANALYZING', '#D6EAF8', NAVY);
        paintRows(null); warn.textContent = '';
        await wait(700, token);
        analyzedView(D.second);
        await wait(1500, token);
      } },
    ];
    function setFor(k) {
      if (modal) modal.close();
      openCard.list.textContent = k >= 0 ? D.file : '';
      if (k >= 3) analyzedView(D.second);
      else if (k >= 1) analyzedView(D.first);
      else { paintRows(null); setBanner('STATUS: READY', '#D6EAF8', NAVY); warn.textContent = ''; fig.style.opacity = '0'; }
    }
    player = new DM.Player({ steps, render(k) { if (!destroyed) setFor(k); } });
    setFor(-1);

    return {
      player: { toggle: go, next: () => player.next(), prev: () => player.prev() },
      get ready() { return figImg.complete; },
      destroy() { destroyed = true; if (modal) modal.close(); player.destroy(); },
    };
  }

  DM.windows.epidout = { title: 'EPID Output Constancy / Wedge Factor (TG-142)', width: W, height: H, theme: 'epidout', mount };
})(typeof window !== 'undefined' ? window : globalThis);
