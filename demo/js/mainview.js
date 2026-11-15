/* Main window behaviour: File > Open loads the field sample, draws the crossline/inline profiles,
   and supports the original's "Real-time Profile" mode (profiles follow the mouse). */
(function (root) {
  const DM = root.DM = root.DM || {};
  let doneTimer = null, ui = null, img = null, loaded = false, rt = false, pos = null, geo = null;
  let doc = null;      // what the viewer shows: { png: {w, h}, grid, img, meta() } - the field sample or a Virtual Starshot

  const HEAD = 'Horizontal (Crossline)', VEAD = 'Vertical (Inline)';
  const field = () => root.DM_DATA && root.DM_DATA.field;
  const shown = () => doc || field();

  function ensure() {
    if (ui) return ui;
    const q = (s) => document.querySelector(s);
    const plots = q('.dm-plots').children;
    ui = {
      canvas: q('canvas.image'), h: plots[0], v: plots[1],
      text: q('.dm-rpage pre'), status: q('.dm-stats .lab'),
      rtBtn: q('.dm-stats .dm-btn'), active: q('.dm-plhead .av'),
    };
    return ui;
  }

  function layout() {
    const cv = ui.canvas, f = shown().png;
    const cw = cv.width, ch = cv.height;
    const s = Math.min(cw / f.w, ch / f.h);
    const w = f.w * s, h = f.h * s;
    geo = { x: (cw - w) / 2, y: (ch - h) / 2, w, h };
  }

  function paint() {
    const im = doc ? doc.img : img;
    if (!loaded || !im || (im.tagName !== 'CANVAS' && !im.complete)) return;
    const cv = ui.canvas;
    if (!cv.width || !cv.height) return;
    layout();
    const c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#EBF5FB'; c.fillRect(0, 0, cv.width, cv.height);
    c.drawImage(im, geo.x, geo.y, geo.w, geo.h);
    if (rt && pos) {
      const px = geo.x + (pos.gx + 0.5) / shown().grid.w * geo.w;
      const py = geo.y + (pos.gy + 0.5) / shown().grid.h * geo.h;
      c.save(); c.strokeStyle = 'yellow'; c.lineWidth = 1; c.setLineDash([4, 4]);
      c.beginPath();
      c.moveTo(geo.x, Math.round(py) + 0.5); c.lineTo(geo.x + geo.w, Math.round(py) + 0.5);
      c.moveTo(Math.round(px) + 0.5, geo.y); c.lineTo(Math.round(px) + 0.5, geo.y + geo.h);
      c.stroke(); c.restore();
    }
  }

  /* Demo addition (not in the original): while Real-time is ON on the field sample, each plot shows the
     80 % evaluation region and the flatness / symmetry of the profile under the cursor. */
  function overlay(a, color) {
    return (c, X, Y, ax) => {
      const F = '"Segoe UI", sans-serif';
      if (!a) {
        c.font = 'bold 12px ' + F; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#7F8C8D';
        c.fillText('No field on this line', (ax.x0 + ax.x1) / 2, (ax.y0 + ax.y1) / 2);
        return;
      }
      const xl = X(a.lo), xh = X(a.hi);
      c.fillStyle = 'rgba(46,204,113,0.08)'; c.fillRect(xl, ax.y0, xh - xl, ax.y1 - ax.y0);
      c.strokeStyle = '#27AE60'; c.lineWidth = 1; c.setLineDash([4, 3]);
      c.beginPath(); c.moveTo(xl, ax.y0); c.lineTo(xl, ax.y1); c.moveTo(xh, ax.y0); c.lineTo(xh, ax.y1); c.stroke();
      c.setLineDash([]);
      const lines = [['Flatness', a.flatness.toFixed(2) + ' %'], ['Symmetry', a.symmetry.toFixed(2) + ' %'], ['Field Width', a.width.toFixed(1) + ' mm']];
      c.font = 'bold 12px ' + F;
      const bw = 176, lh = 18, bh = lines.length * lh + 10;
      const bx = Math.max(ax.x0 + 4, Math.min(ax.x1 - bw - 4, X(a.center) - bw / 2)), by = Y(42) - bh / 2;
      c.fillStyle = 'rgba(255,255,255,0.93)'; c.fillRect(bx, by, bw, bh);
      c.strokeStyle = color; c.lineWidth = 1.2; c.strokeRect(bx + 0.5, by + 0.5, bw, bh);
      c.textBaseline = 'middle';
      lines.forEach(([k, v], i) => {
        const ty = by + 5 + lh * (i + 0.5);
        c.fillStyle = '#34495E'; c.textAlign = 'left'; c.fillText(k, bx + 10, ty);
        c.fillStyle = color; c.textAlign = 'right'; c.fillText(v, bx + bw - 10, ty);
      });
      c.font = '10px ' + F; c.fillStyle = '#27AE60'; c.textAlign = 'center'; c.textBaseline = 'top';
      c.fillText('80 %', (xl + xh) / 2, ax.y0 + 3);
    };
  }

  function plot() {
    const g = shown().grid, P = DM.profile;
    const r = P.row(g, pos.gy), c = P.col(g, pos.gx);
    const pct = (a) => a.map((v) => v / 10);       // grid 1000 -> 100 %
    const top = (a) => { const m = Math.max(...a); return m > 0 ? m * 1.1 : 1; };   // set_ylim(0, max*1.1), main.py:4107
    const live = rt && !doc;                        // analysis only for the field sample, not a Virtual Starshot
    const ana = (p) => P.analyze(p.x_mm, pct(p.v), 30);   // a line through the field reaches far above 30 %
    DM.shell.drawPlot(ui.h, { title: HEAD, x: r.x_mm, y: pct(r.v), color: 'blue', xlim: [r.x_mm[0], r.x_mm[r.x_mm.length - 1]], ylim: [0, top(pct(r.v))],
      overlay: live ? overlay(ana(r), 'blue') : null });
    DM.shell.drawPlot(ui.v, { title: VEAD, x: c.x_mm, y: pct(c.v), color: 'red', xlim: [c.x_mm[0], c.x_mm[c.x_mm.length - 1]], ylim: [0, top(pct(c.v))],
      overlay: live ? overlay(ana(c), 'red') : null });
  }

  /* ---- Demo addition: auto tour. With Real-time ON the cursor walks a fixed path over the field by itself,
     so the lecture shows the profiles and their flatness / symmetry changing without moving the mouse.
     Moving the mouse over the image takes over; 2 s after the mouse stops, the tour carries on from there. */
  // Field-relative stops (u, v), -1..1 = the 50 % edges. No stop sits on the exact centre lines: the sample's
  // marker dot there dips the profile and the flatness reads ~8 % (true for the data, but a confusing first number).
  const TOUR = [[0.15, 0.1], [0.5, 0.1], [0.5, -0.5], [-0.55, -0.5], [-0.85, 0.2], [-0.2, 0.6], [0.6, 0.85], [0.12, 0.93], [0.15, 0.1]];
  const MOVE_MS = 1500, HOLD_MS = 1100, MOUSE_MS = 2000;
  let tour = null, raf = 0, mouseUntil = 0;

  function fieldBox() {
    const g = field().grid, P = DM.profile;
    const toG = (mm, n) => mm / g.mm_per_px + (n - 1) / 2;
    const pct = (a) => a.map((v) => v / 10);
    const r = P.row(g, Math.floor(g.h / 2)), c = P.col(g, Math.floor(g.w / 2));
    const ar = P.analyze(r.x_mm, pct(r.v), 30), ac = P.analyze(c.x_mm, pct(c.v), 30);
    if (!ar || !ac) return null;
    return { cx: toG(ar.center, g.w), hx: ar.width / 2 / g.mm_per_px, cy: toG(ac.center, g.h), hy: ac.width / 2 / g.mm_per_px };
  }

  // a plain 30 fps interval, not requestAnimationFrame: rAF stops whenever the page is not being painted
  function stopTour() { clearInterval(raf); raf = 0; tour = null; }

  function startTour() {
    stopTour();
    const box = fieldBox();
    if (!box) return;
    const pt = ([u, v]) => ({ x: box.cx + u * box.hx, y: box.cy + v * box.hy });
    // first leg: from the centre cursor (setRealtime puts it there) to the first stop
    tour = { box, pt, leg: TOUR.length - 2, t0: performance.now(), from: { x: pos.gx, y: pos.gy } };
    raf = setInterval(step, 33);
  }

  function step() {
    if (!tour || !rt) { stopTour(); return; }
    const now = performance.now();
    if (now < mouseUntil) { tour.paused = true; return; }
    if (tour.paused) { tour.paused = false; tour.t0 = now; tour.from = { x: pos.gx, y: pos.gy }; }   // resume from the mouse position
    const to = tour.pt(TOUR[(tour.leg + 1) % TOUR.length]);
    const t = now - tour.t0;
    if (t >= MOVE_MS + HOLD_MS) { tour.leg = (tour.leg + 1) % (TOUR.length - 1); tour.t0 = now; tour.from = to; return; }
    const k = Math.min(1, t / MOVE_MS), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;   // ease in-out
    const g = field().grid;
    const gx = Math.max(0, Math.min(g.w - 1, Math.round(tour.from.x + (to.x - tour.from.x) * e)));
    const gy = Math.max(0, Math.min(g.h - 1, Math.round(tour.from.y + (to.y - tour.from.y) * e)));
    if (gx !== pos.gx || gy !== pos.gy) moveTo({ gx, gy });
  }

  /* New cursor cell: status text as the original (Fast Mode, then Analysis Complete after 300 ms), redraw. */
  function moveTo(p) {
    pos = p;
    const msg = 'Pos: (' + pos.gx + ', ' + pos.gy + ') | ';
    ui.status.textContent = msg + 'Fast Mode';
    clearTimeout(doneTimer);
    doneTimer = setTimeout(() => { if (rt) ui.status.textContent = msg + 'Analysis Complete'; }, 300);   // debounce, main.py:4136
    plot(); paint();
  }

  function centre() { const g = shown().grid; pos = { gx: Math.floor(g.w / 2), gy: Math.floor(g.h / 2) }; }

  function metadata() {
    if (doc) { ui.text.textContent = doc.meta(); return; }
    const i = field().info;
    const line = (k, v) => k.padEnd(15) + ': ' + v + '\n';
    // label set and order of display_metadata (main.py:9516); identifying fields are masked
    ui.text.textContent = '=== IMAGE METADATA ===\n' +
      line('Patient Name', '(masked)') + line('Patient ID', '(masked)') + line('Modality', 'RTIMAGE') +
      line('Station', '(masked)') + line('Energy', '-') + line('Gantry Angle', i.gantry.toFixed(1)) +
      line('SSD', i.sid_mm.toFixed(1)) + line('Date', '(masked)') +
      '-'.repeat(40) + '\n';
  }

  function setRealtime(on) {
    rt = on; clearTimeout(doneTimer);
    ui.rtBtn.textContent = on ? 'Real-time Profile: ON' : 'Real-time Profile: OFF';
    ui.rtBtn.classList.toggle('on', on); ui.rtBtn.classList.toggle('off', !on);
    ui.status.textContent = on ? 'Real-time Profile: ACTIVE (Move mouse over image)' : 'Real-time Profile: OFF';
    centre(); plot(); paint();
    if (on && !doc) startTour(); else stopTour();
  }

  function toggleRealtime() {
    if (!loaded) { DM.shell.toast('Please load an image first.'); return; }
    setRealtime(!rt);
  }

  function onMove(e) {
    if (!loaded || !rt || !geo) return;
    const r = ui.canvas.getBoundingClientRect();
    const x = e.clientX - r.left - geo.x, y = e.clientY - r.top - geo.y;
    if (x < 0 || y < 0 || x > geo.w || y > geo.h) return;
    const f = shown();
    mouseUntil = performance.now() + MOUSE_MS;      // the mouse takes over from the auto tour
    moveTo(DM.profile.toGrid(f.grid, f.png, (x / geo.w) * f.png.w, (y / geo.h) * f.png.h));
  }

  /* A beam-data file replaced the image: stop the real-time mode (load_external_profile turns it off). */
  function leaveImage() {
    ensure();
    stopTour();
    loaded = false; rt = false; doc = null; clearTimeout(doneTimer);
    ui.rtBtn.textContent = 'Real-time Profile: OFF';
    ui.rtBtn.classList.remove('on'); ui.rtBtn.classList.add('off');
  }

  function open() {
    if (DM.shell.showImageView) DM.shell.showImageView();   // leave Plan View / Profile View so the opened image is visible
    if (DM.profileview) DM.profileview.reset();             // the image replaces a loaded beam file
    ensure();
    const f = field();
    if (!f) { DM.shell.toast('샘플 데이터를 찾을 수 없습니다'); return; }
    doc = null;
    DM.shell.hideWelcome();
    if (!img) { img = new Image(); img.addEventListener('load', paint); img.src = 'data/' + f.png.file; }
    loaded = true; rt = false;
    setRealtime(false);
    ui.status.textContent = 'Real-time Profile: OFF';
    ui.active.textContent = 'Active View: Image View';
    metadata();
    paint();
  }

  /* Winston-Lutz > VIRTUAL STARSHOT loads its DICOM here (app.load_image). res: DM.vstar result.
     Metadata: the tags save_starshot_dicom writes; display_metadata prints N/A for the ones it leaves out. */
  function openSynthetic(res) {
    if (DM.shell.showImageView) DM.shell.showImageView();
    if (DM.profileview) DM.profileview.reset();
    ensure();
    DM.shell.hideWelcome();
    const G = 256, gf = DM.vstar.film(res.beams, G, res.fov, 0, 0);
    const data = Array.from(gf, (v) => Math.round(v * 1000));   // 1000 = 100 % (two beams), as the field grid
    const line = (k, v) => k.padEnd(15) + ': ' + v + '\n';
    doc = {
      png: { w: res.n, h: res.n },
      grid: { w: G, h: G, mm_per_px: res.fov / G, data },
      img: DM.vstar.toCanvas(res.film, res.n),
      meta: () => '=== IMAGE METADATA ===\n' +
        line('Patient Name', 'SYNTHETIC^STARSHOT') + line('Patient ID', 'DOSICARE-QA') + line('Modality', 'RI') +
        line('Station', 'N/A') + line('Energy', 'N/A') + line('Gantry Angle', 'N/A') + line('SSD', '1000.0') +
        line('Date', 'N/A') + '-'.repeat(40) + '\n' + line('File', res.file),
    };
    loaded = true; rt = false;
    setRealtime(false);
    ui.status.textContent = 'Real-time Profile: OFF';
    ui.active.textContent = 'Active View: Image View';
    metadata();
    paint();
  }

  /* Toolbar X: close the image or beam file and go back to the start screen (as on page load). */
  function close() {
    ensure();
    leaveImage();
    if (DM.profileview) DM.profileview.reset();
    const S = DM.shell.ui();
    S.setView(0);                                            // leave Plan View / Profile View
    S.activeView.textContent = 'Active View: Profile View';  // initial label (shell.build)
    ui.text.textContent = '';
    ui.status.textContent = 'Real-time Profile: OFF';
    DM.shell.drawPlot(ui.h, { title: HEAD });
    DM.shell.drawPlot(ui.v, { title: VEAD });
    DM.shell.showWelcome();
  }

  function init() {
    ensure();
    ui.canvas.addEventListener('mousemove', onMove);
    DM.shell.onRealtime(toggleRealtime);
    DM.shell.onImageResize(() => { if (loaded) paint(); else if (DM.profileview) DM.profileview.paintImage(); });
    if (DM.profileview) DM.profileview.init();
    DM.shell.onToolbar((name) => {
      if (name === 'open') { if (DM.opendialog) DM.opendialog.open(); else open(); }
      else if (name === 'profile_graph') toggleRealtime();
      else if (name === 'close') close();
      else return false;
      return true;
    });
  }

  DM.mainview = { open, openSynthetic, close, init, toggleRealtime, leaveImage };
})(typeof window !== 'undefined' ? window : globalThis);
