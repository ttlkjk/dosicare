/* DosiMachine replica - Machine QA > 3D EPID PDD Reconstruction ("EPI Image 3D PDD Modeling", epi_3d_modeling.py).
   Layout follows the original's setup_ui: two ttk control rows, the matplotlib 3D figure, a sunken status bar.
   The walkthrough (Space / auto-run) clicks what a user clicks, in order:
     1. Select Images        -> the 20 depth images (15 - 205 mm)
     2. Load Reference PDD   -> the reference .asc; Start Depth becomes its dmax (15.0)
     3. Run 3D Reconstruction-> the isodose surface (Threshold 50 %)
     4. Export PDD (.asc)    -> the export summary the original shows
   Real (bake/bake_epipdd.py -> data/epipdd.js): every status line and message text, and the 3D view itself - the
   original window's own matplotlib figure, saved every 10 deg of azimuth, so dragging the figure turns it.
   Data: the SYNTHETIC sample EPID_3D_PDD_Sample (not measured, belongs to no machine). Neither the original
   window nor this replica says so on screen; this note is where it is recorded.
   Not in the original: the one slow turn after the reconstruction (shows that the figure can be turned), the
   file dialogs are simplified, and dragging turns azimuth only (matplotlib also tilts elevation).
   The original's Export makes the main window load the curve (auto_load_profile.tmp); the demo does the same
   after the message: the window closes and the exported curve (baked through DosiMachine's own profile loader,
   bake_beamdata.bake_file) opens in the Profile View. */
(function (root) {
  const DM = root.DM = root.DM || {};
  DM.windows = DM.windows || {};

  const W = 1707, H = 996;
  const DEFAULT_AZIM = -60;            // matplotlib's default view

  function h(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function mount(body) {
    const D = root.DM_DATA && root.DM_DATA.epipdd;
    body.classList.add('ep-root');
    if (!D) { body.appendChild(h('div', null, '3D EPID PDD 데이터가 없습니다 (bake_epipdd.py).')); return { destroy() {} }; }
    let destroyed = false;
    const toast = () => DM.shell.toast('데모에서는 동작하지 않습니다');

    /* ---------------- control rows ---------------- */
    const row1 = h('div', 'ep-row ep-row1');
    const row2 = h('div', 'ep-row ep-row2');
    const btn = (row, txt, fn) => { const b = h('div', 'ep-btn', txt); b.addEventListener('click', fn || toast); row.appendChild(b); return b; };
    const ent = (row, label, val) => { row.appendChild(h('span', 'ep-lab', label)); const e = h('div', 'ep-ent', val); e.addEventListener('click', toast); row.appendChild(e); return e; };
    const chk = (row, txt, on) => {
      const c = h('div', 'ep-chk' + (on ? '' : ' off'));
      c.append(h('i', null, '✓'), h('span', null, txt));
      c.addEventListener('click', toast);
      row.appendChild(c);
      return c;
    };

    let player = null;
    // the four walkthrough buttons press the walkthrough on; the rest are not part of it
    const go = async () => {
      if (!player || destroyed) return;
      if (player.state.playing) { player.pause(); return; }
      if (player.index >= player.steps.length - 1) await player.reset();
      player.play();
    };
    const bSelect = btn(row1, 'Select Images', go);
    const bRun = btn(row1, 'Run 3D Reconstruction', go);
    btn(row1, 'Export STL');
    const bExport = btn(row1, 'Export PDD (.asc)', go);
    btn(row1, 'Clear');
    const eStart = ent(row1, 'Start Depth (mm):', '0.0');
    ent(row1, 'Depth Interval (cm):', '1.0');
    ent(row1, 'Threshold (%):', '50.0');
    ent(row1, '3D Smoothing Sigma:', '1.5');

    chk(row2, 'Normalize to 100%', true);
    row2.appendChild(h('span', 'ep-lab', 'Energy:'));
    const energy = h('div', 'ep-combo', 'Auto'); energy.style.width = '106px'; energy.addEventListener('click', toast); row2.appendChild(energy);
    chk(row2, 'Subtract Background', true);
    chk(row2, 'Apply ISL Correction', true);
    const bRef = btn(row2, 'Load Reference PDD', go); bRef.style.marginLeft = '20px';
    btn(row2, 'Calibrate');
    btn(row2, 'Save Cal');
    const cal = h('div', 'ep-combo ro', 'None'); cal.style.width = '258px'; cal.style.marginLeft = '10px'; cal.addEventListener('click', toast); row2.appendChild(cal);

    /* ---------------- figure ---------------- */
    const fig = h('div', 'ep-fig');
    const img = h('img'); img.alt = ''; img.draggable = false;
    fig.appendChild(img);
    const status = h('div', 'ep-status', D.status.start);
    body.append(row1, row2, fig, status);

    // preload every frame so turning never flickers
    const frames = D.frames.map((f) => { const i = new Image(); i.src = f.file; return { azim: f.azim, src: f.file, im: i }; });
    const empty = new Image(); empty.src = D.empty;
    let shown = false, azim = DEFAULT_AZIM;
    const wrapAz = (a) => ((a + 180) % 360 + 360) % 360 - 180;
    function frameFor(a) {
      let best = frames[0], bd = 1e9;
      frames.forEach((f) => { const d = Math.abs(wrapAz(f.azim - a)); if (d < bd) { bd = d; best = f; } });
      return best;
    }
    function paintFig() {
      img.src = shown ? frameFor(azim).src : D.empty;
      fig.classList.toggle('can-turn', shown);
    }

    // drag = turn (matplotlib: left-drag rotates; here azimuth only, 1 px = 0.5 deg)
    let drag = null;
    fig.addEventListener('pointerdown', (e) => {
      if (!shown) return;
      drag = { x: e.clientX, az: azim, id: e.pointerId };
      fig.setPointerCapture(e.pointerId);
      fig.classList.add('turning');
    });
    fig.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const k = fig.getBoundingClientRect().width / fig.offsetWidth || 1;      // window may be scaled
      azim = wrapAz(drag.az - (e.clientX - drag.x) / k * 0.5);
      paintFig();
    });
    const endDrag = () => { drag = null; fig.classList.remove('turning'); };
    fig.addEventListener('pointerup', endDrag);
    fig.addEventListener('pointercancel', endDrag);

    /* ---------------- dialogs ---------------- */
    let modal = null;
    const wait = (ms, token) => DM.anim.wait(ms, token);
    function press(b, token) {
      b.classList.add('ep-press');
      return wait(260, token).finally(() => b.classList.remove('ep-press'));
    }
    // a dialog that the walkthrough answers by itself after `hold` ms (a click answers it sooner)
    function showDialog(build, hold, token) {
      return new Promise((resolve, reject) => {
        const veil = h('div', 'ep-veil');
        const { box, ok } = build();
        veil.appendChild(box);
        body.appendChild(veil);
        let over = false;
        const done = async (cancelled) => {
          if (over) return; over = true;
          if (!cancelled) { ok.classList.add('ep-press'); await new Promise((r) => setTimeout(r, 200)); }
          veil.remove(); modal = null;
          if (cancelled) reject(DM.anim.CANCEL); else resolve();
        };
        ok.addEventListener('click', () => done(false));
        modal = { close: () => done(true) };
        wait(hold, token).then(() => done(false), () => done(true));
      });
    }
    const place = (box, w, hh) => { box.style.left = Math.round((W - w) / 2) + 'px'; box.style.top = Math.round((H - hh) / 2 - 40) + 'px'; box.style.width = w + 'px'; box.style.height = hh + 'px'; };
    function openDlg(title, names, selAll, typeTxt, fileTxt) {
      return () => {
        const rows = Math.min(names.length, 12), shownRows = rows + (names.length > rows ? 1 : 0);
        const w = 620, hh = 44 + shownRows * 20 + 2 + 104;
        const box = h('div', 'ep-dlg'); place(box, w, hh);
        box.appendChild(h('div', 'ep-dlg-bar', title));
        const list = h('div', 'ep-files');
        names.slice(0, rows).forEach((n) => list.appendChild(h('div', selAll ? 'sel' : '', n)));
        if (names.length > rows) list.appendChild(h('div', selAll ? 'sel' : '', '… (' + names.length + ' files)'));
        list.style.height = (shownRows * 20) + 'px';
        box.appendChild(list);
        const y = hh - 98;
        box.appendChild(Object.assign(h('div', null, 'File name:'), { style: 'position:absolute;left:16px;top:' + (y + 2) + 'px;line-height:22px;' }));
        const f = h('div', 'ep-field'); f.style.cssText += 'left:112px;right:20px;top:' + y + 'px;'; f.appendChild(h('span', null, fileTxt)); box.appendChild(f);
        const t = h('div', 'ep-field ro', typeTxt); t.style.cssText += 'left:112px;right:20px;top:' + (y + 32) + 'px;'; box.appendChild(t);
        const ok = h('div', 'ep-dlg-btn pri', 'Open'); ok.style.cssText += 'right:116px;bottom:12px;';
        const cancel = h('div', 'ep-dlg-btn', 'Cancel'); cancel.style.cssText += 'right:20px;bottom:12px;';
        cancel.addEventListener('click', () => modal && modal.close());
        box.append(ok, cancel);
        return { box, ok };
      };
    }
    function saveDlg(title, name, typeTxt) {
      return () => {
        const w = 560, hh = 196;
        const box = h('div', 'ep-dlg'); place(box, w, hh);
        box.appendChild(h('div', 'ep-dlg-bar', title));
        box.appendChild(Object.assign(h('div', null, 'File name:'), { style: 'position:absolute;left:16px;top:52px;line-height:22px;' }));
        const f = h('div', 'ep-field'); f.style.cssText += 'left:112px;right:20px;top:50px;'; f.appendChild(h('span', null, name)); box.appendChild(f);
        box.appendChild(Object.assign(h('div', null, 'Save as type:'), { style: 'position:absolute;left:16px;top:88px;line-height:22px;' }));
        const t = h('div', 'ep-field ro', typeTxt); t.style.cssText += 'left:112px;right:20px;top:86px;'; box.appendChild(t);
        const ok = h('div', 'ep-dlg-btn pri', 'Save'); ok.style.cssText += 'right:116px;bottom:20px;';
        const cancel = h('div', 'ep-dlg-btn', 'Cancel'); cancel.style.cssText += 'right:20px;bottom:20px;';
        cancel.addEventListener('click', () => modal && modal.close());
        box.append(ok, cancel);
        return { box, ok };
      };
    }
    function infoDlg(title, text) {
      return () => {
        const lines = text.split('\n').length;
        const w = Math.min(760, Math.max(380, 110 + Math.max(...text.split('\n').map((l) => l.length)) * 6.3));
        const hh = 46 + lines * 18 + 74;
        const box = h('div', 'ep-dlg'); place(box, w, hh);
        box.appendChild(h('div', 'ep-dlg-bar', title));
        box.appendChild(h('div', 'ep-icon', 'i'));
        box.appendChild(h('div', 'ep-msg', text));
        const ok = h('div', 'ep-dlg-btn pri', 'OK'); ok.style.cssText += 'right:20px;bottom:14px;';
        box.appendChild(ok);
        return { box, ok };
      };
    }

    // The original's export drops auto_load_profile.tmp; the main window picks it up and opens the curve in the
    // Profile View (load_external_profile). Here: close this window and open the baked curve the same way.
    function showInMain() {
      const pf = D.profile_file, BD = root.DM_DATA && root.DM_DATA.beamdata;
      if (!pf || !BD || !DM.profileview) return;
      if (!BD.files.some((f) => f.name === pf.name)) BD.files.push(pf);   // now in the folder, as on the PC
      if (DM.win) DM.win.close();
      DM.profileview.open(pf.name);
    }

    /* ---------------- walkthrough ---------------- */
    const msg = (list, title) => (list.find((m) => m[1] === title) || [null, title, ''])[2];
    const steps = [
      { name: 'select', async run(token) {
        await press(bSelect, token);
        await showDialog(openDlg('Select EPI Images', D.files, true, 'Image files (*.dcm *.png *.tif *.tiff *.jpg)',
          D.files.map((n) => '"' + n + '"').join(' ')), 1500, token);
        status.textContent = D.status.select;
        await wait(700, token);
      } },
      { name: 'ref', async run(token) {
        await press(bRef, token);
        await showDialog(openDlg('Select Reference PDD File', [D.ref_name], true, 'ASC Files (*.asc)', D.ref_name), 1100, token);
        eStart.textContent = D.start_depth; eStart.classList.add('ep-flash');
        status.textContent = D.status.ref;
        await showDialog(infoDlg('Success', msg(D.ref_msg, 'Success')), 2600, token);
        eStart.classList.remove('ep-flash');
        await wait(300, token);
      } },
      { name: 'run', async run(token) {
        await press(bRun, token);
        for (const [t, ms] of [['Loading images...', 650], ['Applying smoothing...', 450], ['Extracting isosurface...', 700]]) {
          status.textContent = t;
          await wait(ms, token);
        }
        shown = true; azim = DEFAULT_AZIM; paintFig();
        status.textContent = D.status.run;
        await wait(900, token);
        // one slow turn, back to the default view
        await DM.anim.tween(4200, (t) => { azim = wrapAz(DEFAULT_AZIM + 360 * DM.anim.ease(t)); paintFig(); }, token);
        azim = DEFAULT_AZIM; paintFig();
        await wait(500, token);
      } },
      { name: 'export', async run(token) {
        await press(bExport, token);
        await showDialog(saveDlg('Export PDD as IBA ASC', D.export_name, 'IBA ASCII files (*.asc)'), 1300, token);
        await showDialog(infoDlg('Export Complete', msg(D.export_msgs, 'Export Complete')), 4200, token);
        await wait(400, token);
        showInMain();
      } },
    ];
    function setFor(k) {
      if (modal) modal.close();
      eStart.classList.remove('ep-flash');
      eStart.textContent = k >= 1 ? D.start_depth : '0.0';
      shown = k >= 2;
      if (!drag) azim = DEFAULT_AZIM;
      status.textContent = k >= 2 ? D.status.run : k === 1 ? D.status.ref : k === 0 ? D.status.select : D.status.start;
      paintFig();
    }
    player = new DM.Player({ steps, render(k) { if (!destroyed) setFor(k); } });
    setFor(-1);

    return {
      player: { toggle: go, next: () => player.next(), prev: () => player.prev(), get state() { return Object.assign({ count: steps.length }, player.state); }, },   // Space = the walkthrough
      get ready() { return empty.complete && frames.every((f) => f.im.complete); },
      destroy() {
        destroyed = true;
        if (modal) modal.close();
        player.destroy();
      },
    };
  }

  DM.windows.epipdd = { title: 'EPI Image 3D PDD Modeling', width: W, height: H, theme: 'epipdd', mount };
})(typeof window !== 'undefined' ? window : globalThis);
