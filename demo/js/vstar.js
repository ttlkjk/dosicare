/* DosiMachine replica - Winston-Lutz > VIRTUAL STARSHOT.
   The film is computed exactly as generate_synthetic_starshot (dosicare_winston_lutz_window.py) does:
   40 x 40 mm, 1024 x 1024 px, one 1 mm slit per couch-0 image with a 1 px erf edge, centred on the
   line through -res_h along (cos g, sin g); beams add and are capped at two, then scaled to uint16.
   The original builds it in one go; the beam-by-beam build here only shows how the film is made.
   Flow after the build, as in the original: Save-as dialog -> message box -> image in the main viewer. */
(function (root) {
  const DM = root.DM = root.DM || {};

  const FOV = 40.0, NPX = 1024, SLIT = 1.0;
  const EDGE = (FOV / NPX) * Math.SQRT2;          // 1 px of the real film, whatever grid we sample on
  const FILE = 'Synthetic_Analysis_Starshot_Residuals.dcm';

  /* Abramowitz-Stegun 7.1.26, |error| < 1.5e-7 */
  function erf(x) {
    const s = x < 0 ? -1 : 1; x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  const atZero = (a) => { const m = ((a % 360) + 360) % 360; return Math.min(m, 360 - m) <= 1.0; };

  /* The lines the original draws: couch at zero, valid, measured. shift = -res_h (mm). */
  function beams(images) {
    return images
      .filter((im) => atZero(im.couch) && im.valid !== false && im.res_h != null)
      .map((im) => ({ gantry: im.gantry, collimator: im.collimator, shift: -im.res_h }));
  }

  /* Dose of one beam on an n x n grid of pixel centres covering fov mm around (cx, cy). Row = +y (down). */
  function beamDose(b, n, fov, cx, cy) {
    const out = new Float32Array(n * n);
    const px = fov / n, r = (b.gantry * Math.PI) / 180, nx = Math.cos(r), ny = Math.sin(r);
    const h = SLIT / 2, reach = h + 4 * EDGE;
    for (let j = 0; j < n; j++) {
      const y = (cy || 0) - fov / 2 + (j + 0.5) * px;
      for (let i = 0; i < n; i++) {
        const x = (cx || 0) - fov / 2 + (i + 0.5) * px;
        const d = x * nx + y * ny - b.shift;
        if (d > reach || d < -reach) continue;
        out[j * n + i] = 0.5 * (erf((h - d) / EDGE) + erf((h + d) / EDGE));
      }
    }
    return out;
  }

  /* Whole film, capped at two beams, as 0..1 (= uint16 / 65535). */
  function film(bs, n, fov, cx, cy) {
    const acc = new Float32Array(n * n);
    bs.forEach((b) => { const d = beamDose(b, n, fov, cx, cy); for (let k = 0; k < acc.length; k++) acc[k] += d[k]; });
    for (let k = 0; k < acc.length; k++) acc[k] = Math.min(acc[k], 2) / 2;
    return acc;
  }

  /* 0..1 film -> canvas (MONOCHROME2: high = white) */
  function toCanvas(f, n) {
    const cv = document.createElement('canvas'); cv.width = n; cv.height = n;
    const c = cv.getContext('2d'), im = c.createImageData(n, n);
    for (let k = 0; k < f.length; k++) { const g = Math.round(f[k] * 255); im.data[4 * k] = im.data[4 * k + 1] = im.data[4 * k + 2] = g; im.data[4 * k + 3] = 255; }
    c.putImageData(im, 0, 0);
    return cv;
  }

  /* ---------------- builder overlay (inside the 1707 x 996 Winston-Lutz window) ---------------- */
  const BG = '#0F172A', PANEL = '#1E293B', LINE = '#334155', MUTED = '#94A3B8';
  const COLORS = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];

  function h(tag, css, text) {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }
  const abs = (x, y, w, hh, extra) => 'position:absolute;left:' + x + 'px;top:' + y + 'px;' + (w != null ? 'width:' + w + 'px;' : '') + (hh != null ? 'height:' + hh + 'px;' : '') + (extra || '');
  const f3 = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3);

  /* host: the window root (1707 x 996). opts: { images, onLoaded(result), onClose() }.
     Returns { destroy() }. */
  function build(host, opts) {
    const bs = beams(opts.images);
    const token = { cancelled: false };
    const wait = (ms) => DM.anim.wait(ms, token);

    const veil = h('div', abs(0, 0, 1707, 996, 'background:rgba(15,23,42,.55);z-index:20;'));
    const P = h('div', abs(343, 118, 1020, 760, 'background:' + BG + ';border:1px solid ' + LINE + ';box-shadow:0 12px 40px rgba(0,0,0,.5);font-family:"Segoe UI",sans-serif;color:#F8FAFC;'));
    veil.appendChild(P);
    host.appendChild(veil);

    const head = h('div', abs(0, 0, 1018, 48, 'background:' + PANEL + ';'));
    head.append(
      h('div', abs(20, 0, null, 48, 'font:700 17px "Segoe UI",sans-serif;line-height:48px;white-space:nowrap;'), 'VIRTUAL STARSHOT'),
      h('div', abs(196, 0, null, 48, 'font:13px "Segoe UI",sans-serif;line-height:48px;color:' + MUTED + ';white-space:nowrap;'), 'Synthetic starshot film from the Winston-Lutz residuals (Ball Setup Corrected)'));
    P.appendChild(head);

    // film
    const FN = 600, FX = 24, FY = 70;
    const filmCv = h('canvas', abs(FX, FY, FN, FN, 'background:#000;image-rendering:auto;'));
    filmCv.width = FN; filmCv.height = FN;
    const fc = filmCv.getContext('2d');
    fc.fillStyle = '#000'; fc.fillRect(0, 0, FN, FN);
    const NSV = 'http://www.w3.org/2000/svg';
    const lab = document.createElementNS(NSV, 'svg');
    lab.setAttribute('width', FN); lab.setAttribute('height', FN);
    lab.style.cssText = abs(FX, FY, FN, FN, 'pointer-events:none;');
    P.append(filmCv, lab,
      h('div', abs(FX, FY + FN + 8, FN, 18, 'font:12px "Segoe UI",sans-serif;color:' + MUTED + ';text-align:center;white-space:nowrap;'),
        '40 × 40 mm  ·  1024 × 1024 px (uint16)  ·  1 mm slit per beam  ·  overlap capped at 2 beams'));

    // hub zoom
    const ZN = 230, ZF = 4.0, ZX = 652, ZY = 70;
    P.appendChild(h('div', abs(ZX, ZY - 2, 344, 18, 'font:700 12px "Segoe UI",sans-serif;color:#FBBF24;white-space:nowrap;'), 'HUB ZOOM  (±2 mm)  ·  slit centre lines'));
    const zoomCv = h('canvas', abs(ZX, ZY + 20, ZN, ZN, 'background:#000;opacity:.45;'));
    zoomCv.width = ZN; zoomCv.height = ZN;
    const zc = zoomCv.getContext('2d');
    zc.fillStyle = '#000'; zc.fillRect(0, 0, ZN, ZN);
    const zsv = document.createElementNS(NSV, 'svg');
    zsv.setAttribute('width', ZN); zsv.setAttribute('height', ZN);
    zsv.style.cssText = abs(ZX, ZY + 20, ZN, ZN, 'pointer-events:none;');
    zsv.innerHTML = '<path d="M' + (ZN / 2 - 12) + ' ' + ZN / 2 + 'H' + (ZN / 2 + 12) + 'M' + ZN / 2 + ' ' + (ZN / 2 - 12) + 'V' + (ZN / 2 + 12) + '" stroke="#FF4040" stroke-width="1.5"/>'
      + '<text x="6" y="' + (ZN - 8) + '" fill="#94A3B8" font-size="11" font-family="Segoe UI,sans-serif">+ = isocentre (0, 0)</text>';
    P.append(zoomCv, zsv);
    const zNote = h('div', abs(ZX + ZN + 12, ZY + 24, 102, 200, 'font:12px "Segoe UI",sans-serif;line-height:17px;color:' + MUTED + ';'),
      'Each slit sits on its own residual line. The lines do not meet in one point: that spread is what Starshot then measures.');
    P.appendChild(zNote);

    // beam list
    const LX = 652, LY = 336;
    P.appendChild(h('div', abs(LX, LY, 344, 20, 'font:700 12px "Segoe UI",sans-serif;color:#F8FAFC;white-space:pre;'), 'BEAM        GANTRY       LINE SHIFT (−res_h)'));
    const rowsEl = [];
    bs.forEach((b, i) => {
      const r = h('div', abs(LX, LY + 24 + i * 23, 344, 22, 'font:13px Consolas,"Segoe UI",monospace;line-height:22px;color:#475569;white-space:pre;'));
      r.textContent = ('#' + (i + 1)).padEnd(6) + (b.gantry.toFixed(1) + '°').padStart(8) + '        ' + f3(b.shift) + ' mm';
      P.appendChild(r); rowsEl.push(r);
    });

    // progress + status
    const barBg = h('div', abs(24, 712, 972, 6, 'background:' + LINE + ';'));
    const bar = h('div', abs(0, 0, 0, 6, 'background:#10B981;'));
    barBg.appendChild(bar);
    const status = h('div', abs(24, 724, 972, 22, 'font:13px "Segoe UI",sans-serif;line-height:22px;color:#E2E8F0;white-space:nowrap;overflow:hidden;'), '');
    P.append(barBg, status);
    const setBar = (f) => { bar.style.width = Math.round(972 * Math.max(0, Math.min(1, f))) + 'px'; };

    // dose arrays for the build
    const fd = bs.map((b) => beamDose(b, FN, FOV, 0, 0));
    const zd = bs.map((b) => beamDose(b, ZN, ZF, 0, 0));
    const facc = new Float32Array(FN * FN), zacc = new Float32Array(ZN * ZN);
    const fimg = fc.createImageData(FN, FN), zimg = zc.createImageData(ZN, ZN);
    for (let k = 3; k < fimg.data.length; k += 4) fimg.data[k] = 255;
    for (let k = 3; k < zimg.data.length; k += 4) zimg.data[k] = 255;

    // along-line coordinate t, used to sweep each slit across the film
    function paint(ctx, img, acc, beam, d, n, fov, prog) {
      const px = fov / n;
      let dx = 0, dy = 0, lim = Infinity;
      if (beam) {
        const r = (beam.gantry * Math.PI) / 180;
        dx = -Math.sin(r); dy = Math.cos(r);
        const L = fov * 0.75;
        lim = -L + 2 * L * prog;
      }
      const D = img.data;
      for (let j = 0; j < n; j++) {
        const y = -fov / 2 + (j + 0.5) * px;
        for (let i = 0; i < n; i++) {
          const k = j * n + i;
          let v = acc[k];
          if (beam && d[k] > 0) {
            const x = -fov / 2 + (i + 0.5) * px;
            if (x * dx + y * dy < lim) v += d[k];
          }
          const g = Math.round(Math.min(v, 2) / 2 * 255);
          D[4 * k] = D[4 * k + 1] = D[4 * k + 2] = g;
        }
      }
      ctx.putImageData(img, 0, 0);
    }

    function addLabel(b, i) {
      const r = (b.gantry * Math.PI) / 180, s = FN / FOV;
      const L = 17.2;   // mm from the centre along the line
      const x = FN / 2 + (b.shift * Math.cos(r) - L * Math.sin(r)) * s;
      const y = FN / 2 + (b.shift * Math.sin(r) + L * Math.cos(r)) * s;
      const t = document.createElementNS(NSV, 'text');
      t.setAttribute('x', x.toFixed(1)); t.setAttribute('y', (y + 4).toFixed(1));
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '13'); t.setAttribute('font-weight', '700');
      t.setAttribute('font-family', 'Segoe UI,sans-serif'); t.setAttribute('fill', COLORS[i % COLORS.length]);
      t.setAttribute('paint-order', 'stroke'); t.setAttribute('stroke', '#000'); t.setAttribute('stroke-width', '3');
      t.textContent = 'G' + Math.round(b.gantry) + '°';
      lab.appendChild(t);
    }

    // centre line of each slit on the hub zoom (drawn over the film; not part of the saved image)
    const gLines = document.createElementNS(NSV, 'g');
    zsv.insertBefore(gLines, zsv.firstChild);
    function addCentreLine(b, i) {
      const r = (b.gantry * Math.PI) / 180, s = ZN / ZF, c = ZN / 2;
      const x0 = b.shift * Math.cos(r), y0 = b.shift * Math.sin(r), dx = -Math.sin(r), dy = Math.cos(r);
      const l = document.createElementNS(NSV, 'line');
      l.setAttribute('x1', (c + (x0 - ZF * dx) * s).toFixed(1)); l.setAttribute('y1', (c + (y0 - ZF * dy) * s).toFixed(1));
      l.setAttribute('x2', (c + (x0 + ZF * dx) * s).toFixed(1)); l.setAttribute('y2', (c + (y0 + ZF * dy) * s).toFixed(1));
      l.setAttribute('stroke', COLORS[i % COLORS.length]); l.setAttribute('stroke-width', '1.8');
      gLines.appendChild(l);
    }

    let modal = null;
    function dialog(kind) {
      return new Promise((resolve) => {
        const back = h('div', abs(0, 0, 1707, 996, 'z-index:30;'));
        const W = kind === 'save' ? 560 : 470, H = kind === 'save' ? 196 : 168;
        const d = h('div', abs(Math.round((1707 - W) / 2), Math.round((996 - H) / 2), W, H, 'background:#fff;border:1px solid #7A7A7A;box-shadow:0 8px 28px rgba(0,0,0,.45);font:12px "Segoe UI",sans-serif;color:#000;'));
        const bar_ = h('div', abs(0, 0, W - 2, 30, 'background:#fff;border-bottom:1px solid #E5E5E5;font:12px "Segoe UI",sans-serif;line-height:30px;padding-left:10px;box-sizing:border-box;'),
          kind === 'save' ? 'Export Synthetic_Analysis_Starshot as DICOM' : 'Synthetic Starshot');
        d.appendChild(bar_);
        const btn = (txt, x, y, primary) => {
          const b = h('div', abs(x, y, 88, 26, 'border:1px solid ' + (primary ? '#0067C0' : '#ADADAD') + ';background:' + (primary ? '#E5F1FB' : '#E1E1E1') + ';text-align:center;line-height:24px;cursor:pointer;box-sizing:border-box;'), txt);
          d.appendChild(b); return b;
        };
        let ok;
        if (kind === 'save') {
          d.appendChild(h('div', abs(16, 52, 90, 22, 'line-height:22px;'), 'File name:'));
          const name = h('div', abs(112, 50, W - 132, 24, 'border:1px solid #7A7A7A;line-height:22px;padding-left:5px;box-sizing:border-box;background:#fff;'));
          const sel = h('span', 'background:#0078D7;color:#fff;', FILE);
          name.appendChild(sel); d.appendChild(name);
          d.appendChild(h('div', abs(16, 88, 90, 22, 'line-height:22px;'), 'Save as type:'));
          d.appendChild(h('div', abs(112, 86, W - 132, 24, 'border:1px solid #ADADAD;line-height:22px;padding-left:5px;box-sizing:border-box;background:#F0F0F0;'), 'DICOM files (*.dcm)'));
          ok = btn('Save', W - 204, H - 46, true);
          btn('Cancel', W - 108, H - 46, false).addEventListener('click', () => done(false));
        } else {
          d.appendChild(h('div', abs(22, 46, 36, 36, 'border-radius:50%;background:#0067C0;color:#fff;font:700 22px Georgia,serif;text-align:center;line-height:36px;'), 'i'));
          d.appendChild(h('div', abs(72, 46, W - 92, 60, 'line-height:18px;white-space:pre-wrap;'), 'Synthetic Starshot DICOM generated and loaded into main viewer:\n' + FILE));
          ok = btn('OK', W - 108, H - 44, true);
        }
        ok.addEventListener('click', () => done(true));
        const onKey = (e) => {
          if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); done(true); }
          else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(kind !== 'save'); }
        };
        document.addEventListener('keydown', onKey, true);
        function done(v) {
          document.removeEventListener('keydown', onKey, true);
          back.remove(); modal = null; resolve(v);
        }
        back.appendChild(d); host.appendChild(back);
        modal = { close: () => done(false) };
      });
    }

    async function run() {
      status.textContent = 'Re-running the analysis (Ball Setup Corrected) ...';
      await wait(700);
      status.textContent = bs.length + ' beams at couch 0° — each slit is placed on its setup-corrected residual line';
      await wait(900);
      for (let i = 0; i < bs.length; i++) {
        const b = bs[i];
        rowsEl[i].style.color = '#F8FAFC';
        rowsEl[i].style.background = 'rgba(16,185,129,.18)';
        status.textContent = 'Exposing beam ' + (i + 1) + ' / ' + bs.length + ':  gantry ' + b.gantry.toFixed(1) + '°,  line shifted ' + f3(b.shift) + ' mm';
        await DM.anim.tween(520, (t) => {
          const e = DM.anim.ease(t);
          paint(fc, fimg, facc, b, fd[i], FN, FOV, e);
          paint(zc, zimg, zacc, b, zd[i], ZN, ZF, e);
          setBar((i + e) / (bs.length + 1));
        }, token);
        for (let k = 0; k < facc.length; k++) facc[k] += fd[i][k];
        for (let k = 0; k < zacc.length; k++) zacc[k] += zd[i][k];
        rowsEl[i].style.background = '';
        rowsEl[i].style.color = COLORS[i % COLORS.length];
        addLabel(b, i);
        addCentreLine(b, i);
        await wait(120);
      }
      paint(fc, fimg, facc, null, null, FN, FOV, 1);
      paint(zc, zimg, zacc, null, null, ZN, ZF, 1);
      status.textContent = 'Writing the 1024 × 1024 film:  pixel = min(dose, 2) / 2 × 65535  (uint16)';
      await wait(500);
      const full = film(bs, NPX, FOV, 0, 0);
      setBar(1);
      status.textContent = 'Film ready.  Save it as a DICOM file to open it in the main viewer.';
      await wait(300);
      if (token.cancelled) return;
      const saved = await dialog('save');
      if (token.cancelled) return;
      if (!saved) { status.textContent = 'Not saved — nothing was loaded.'; await wait(900); if (!token.cancelled && opts.onClose) opts.onClose(); return; }
      status.textContent = 'Saved ' + FILE + ':  Modality RI  ·  PixelSpacing 0.0390625 mm  ·  SAD = SID = 1000 mm  ·  ImageComments = '
        + bs.map((b) => b.gantry.toFixed(1)).join(',');
      await wait(900);
      if (token.cancelled) return;
      await dialog('info');
      if (token.cancelled) return;
      if (opts.onLoaded) opts.onLoaded({ film: full, n: NPX, fov: FOV, beams: bs, file: FILE });
    }

    run().catch((e) => { if (!(e && e.cancelled)) console.error(e); });

    return {
      destroy() { token.cancelled = true; if (modal) modal.close(); veil.remove(); },
    };
  }

  const api = { FOV, NPX, SLIT, FILE, erf, beams, beamDose, film, toCanvas, build };
  DM.vstar = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
