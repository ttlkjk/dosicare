/* DosiMachine replica - main window shell (menu bar, toolbar, tabs, panels, welcome screen, bottom plots). */
(function (root) {
  const DM = root.DM = root.DM || {};
  let menuCb = null, toolbarCbs = [], resizeCb = null, rtCb = null, filterCb = null, profShowCb = null;
  let ui = null, welcome = false, toastTimer = null, showImageViewFn = null;

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const rectOf = (n) => { const r = n.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };

  function toast(msg) {
    let t = document.querySelector('.dm-toast');
    if (!t) { t = el('div', 'dm-toast'); document.body.appendChild(t); }
    t.textContent = msg || '데모에서는 동작하지 않습니다';
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }

  /* ---------------- menu bar ---------------- */
  function buildMenubar(bar) {
    let chain = [];            // open dropdown elements, index = depth
    let openTop = null;        // open top-level element

    function closeFrom(depth) {
      while (chain.length > depth) {
        const d = chain.pop();
        if (d.parentItem) d.parentItem.classList.remove('open');
        d.remove();
      }
    }
    function closeAll() {
      closeFrom(0);
      if (openTop) { openTop.classList.remove('open'); openTop = null; }
    }
    function fire(path, item, node) {
      const anchorRect = rectOf(node);
      closeAll();
      if (menuCb) menuCb({ path, item, anchorRect });
      else toast();
    }
    // Lecture aid (not in the original): rows that open something - a live window or a capture - and submenus that
    // contain one are drawn highlighted (.can-open), so the presenter sees at a glance what can be shown.
    function isOff(p, it) { return !!(it.disabled || (!it.items && DM.win && DM.win.isGrey && DM.win.isGrey(p, it))); }
    function canOpen(p, it) {
      if (it.separator || isOff(p, it)) return false;
      return it.items ? it.items.some((c) => canOpen(DM.menuPath(p, c.label), c)) : true;
    }
    function openDropdown(items, path, depth, x, y, parentItem, sub) {
      closeFrom(depth);
      const dd = el('div', 'dm-dd');
      dd.parentItem = parentItem || null;
      if (parentItem) parentItem.classList.add('open');
      items.forEach((it) => {
        if (it.separator) { dd.appendChild(el('div', 'dm-dd-sep')); return; }
        const p = DM.menuPath(...path, it.label);
        const off = isOff(p, it);   // grey: nothing to show
        const row = el('div', 'dm-dd-item' + (off ? ' disabled' : canOpen(p, it) ? ' can-open' : ''));
        row.itemLabel = it.label;   // for reveal() below
        row.appendChild(el('span', 'lbl', it.label));
        if (it.accel) row.appendChild(el('span', 'acc', it.accel));
        if (it.items) row.appendChild(el('span', 'arr', '▶'));
        row.addEventListener('mouseenter', () => {
          closeFrom(depth + 1);
          if (it.items && !off) {
            const r = row.getBoundingClientRect();
            openDropdown(it.items, [...path, it.label], depth + 1, r.right - 2, r.top - 3, row, true);
          }
        });
        row.addEventListener('click', (e) => {
          e.stopPropagation();
          if (off || it.items) return;
          fire(p, it, row);
        });
        dd.appendChild(row);
      });
      dd.style.left = '0px'; dd.style.top = '0px'; dd.style.visibility = 'hidden';
      document.body.appendChild(dd);
      chain[depth] = dd;
      const w = dd.offsetWidth, h = dd.offsetHeight;
      let left = x, top = y;
      if (left + w > innerWidth) left = sub && parentItem ? parentItem.getBoundingClientRect().left - w + 2 : Math.max(0, innerWidth - w);
      if (top + h > innerHeight) top = Math.max(0, innerHeight - h);
      dd.style.left = left + 'px'; dd.style.top = top + 'px'; dd.style.visibility = '';
      return dd;
    }
    function openTopMenu(node, menu) {
      if (openTop === node) return;
      closeAll();
      openTop = node; node.classList.add('open');
      const r = node.getBoundingClientRect();
      openDropdown(menu.items, [menu.label], 0, r.left, r.bottom, null, false);
    }
    const tops = {};           // label -> { node, menu }
    DM.menuDef.forEach((menu) => {
      const node = el('div', 'dm-mb-item', menu.label);
      node.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        if (openTop === node) closeAll(); else openTopMenu(node, menu);
      });
      node.addEventListener('mouseenter', () => { if (openTop && openTop !== node) openTopMenu(node, menu); });
      bar.appendChild(node);
      tops[menu.label] = { node, menu };
    });
    /* Auto Tour (js/tour.js, not in the original): open the menus along `labels` and return the element of the last
       label - the top title, or its row in the dropdown. openLast also opens that label's own submenu. Nothing is
       clicked; the caller clicks the returned row. Returns null when a label is not there. */
    bar.reveal = (labels, openLast) => {
      const t = tops[labels[0]];
      if (!t) return null;
      if (labels.length === 1 && !openLast) return t.node;
      if (openTop !== t.node) openTopMenu(t.node, t.menu);
      let items = t.menu.items, node = t.node;
      for (let d = 1; d < labels.length; d++) {
        const dd = chain[d - 1];
        const it = items.find((x) => !x.separator && x.label === labels[d]);
        const row = dd && [...dd.children].find((r) => r.itemLabel === labels[d]);
        if (!it || !row) return null;
        node = row;
        const last = d === labels.length - 1;
        if (it.items && (!last || openLast)) {
          if (!(chain[d] && chain[d].parentItem === row)) {
            const r = row.getBoundingClientRect();
            openDropdown(it.items, labels.slice(0, d + 1), d, r.right - 2, r.top - 3, row, true);
          }
        } else closeFrom(d);
        items = it.items || [];
      }
      return node;
    };
    document.addEventListener('mousedown', (e) => { if (openTop && !e.target.closest('.dm-dd')) closeAll(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openTop) { closeAll(); e.stopImmediatePropagation(); } }, true);
    window.addEventListener('blur', closeAll);
    bar.closeAll = closeAll;
  }

  /* ---------------- toolbar ---------------- */
  const IC = (n) => 'assets/icon_' + n + '.png';
  const TB = [
    { k: 'icon', name: 'open', img: 'open', tip: '파일 열기', m: '0 5px 0 12px' },
    { k: 'icon', name: 'add', img: 'add', tip: '파일 추가', m: '0 5px' },
    { k: 'icon', name: 'close', img: 'close', tip: '영상 닫기', m: '0 12px 0 5px' },
    { k: 'sep', m: '0 5px' },
    { k: 'sym', name: 'profile', g: '⊕', gs: 15, c: '#AED6F1', t: 'Profile', b: true, tip: '프로파일 보기 탭 추가' },
    { k: 'sep', m: '0 10px' },
    { k: 'sym', name: 'undo', g: '↩', gs: 14, c: '#5DADE2', t: 'Undo', b: true, tip: '실행 취소' },
    { k: 'sym', name: 'redo', g: '↪', gs: 14, c: '#99A3A4', t: 'Redo', b: true, tip: '다시 실행' },
    { k: 'sep', m: '0 10px' },
    { k: 'sym', name: 'cut', g: '✂', gs: 14, t: 'Cut', tip: '선택한 프로파일 잘라내기' },
    { k: 'sym', name: 'copy', g: '⧉', gs: 14, t: 'Copy', tip: '선택한 프로파일 복사' },
    { k: 'sym', name: 'paste', g: '⎘', gs: 14, t: 'Paste', tip: '프로파일 붙여넣기' },
    { k: 'sep', m: '0 15px' },
    { k: 'icon', name: 'zoom_out', img: 'zoom_out', tip: '축소', m: '0 5px' },
    { k: 'zoom', name: 'zoom_label', tip: '현재 배율 (누르면 원래대로)', m: '0 5px' },
    { k: 'icon', name: 'zoom_in', img: 'zoom_in', tip: '확대', m: '0 5px' },
    { k: 'icon', name: 'zoom_reset', img: 'reset', tip: '배율 원래대로', m: '0 15px 0 15px' },
    { k: 'icon', name: 'ruler', img: 'ruler', tip: '자 — 두 점 사이 거리 재기', m: '0 10px' },
    { k: 'icon', name: 'protractor', img: 'protractor', tip: '각도기 — 각도 재기', m: '0 5px' },
    { k: 'icon', name: 'crop', img: 'crop', tip: '영상 잘라내기 (영역 선택)', m: '0 5px' },
    { k: 'icon', name: 'rotate', img: 'refresh', tip: '영상 회전', m: '0 5px' },
    { k: 'icon', name: 'profile_graph', img: 'profile', tip: '실시간 프로파일 켜기/끄기', m: '0 5px' },
    { k: 'icon', name: 'sym', img: 'sym', tip: '대칭 커서 켜기/끄기', m: '0 5px' },
    { k: 'icon', name: 'align', img: 'align', tip: '십자선을 빔 중심에 자동으로 맞추기', m: '0 5px' },
    { k: 'icon', name: 'reset_align', img: 'reset', tip: '십자선을 영상 가운데로 되돌리기', m: '0 5px' },
    { k: 'sep', m: '0 10px' },
    { k: 'sym', name: 'smoothing', g: '⌇', gs: 15, t: 'Smoothing', tip: '프로파일 매끄럽게 하기 (스무딩 설정)' },
    { k: 'sym', name: 'cax', g: '⌖', gs: 15, t: 'CAX', tip: '프로파일 중심(CAX)을 0에 맞추기' },
    { k: 'sym', name: 'rescale', g: '↕', gs: 15, t: 'Rescale', tip: '기준점 값을 지정한 %로 다시 맞추기' },
    { k: 'sym', name: 'grid', g: '▦', gs: 15, t: 'Grid', tip: 'Plan View 격자 켜기/끄기' },
    { k: 'gridentry', name: 'grid_spacing', tip: '격자 간격 (cm) — 입력 후 Enter' },
    { k: 'cm' },
    { k: 'sym', name: 'point', g: '✛', gs: 15, t: 'Point', tip: 'Plan View에서 한 점의 선량·CT 값 읽기' },
    { k: 'tour', name: 'tour', tip: 'Tour — 데모가 스스로 움직이며 설명합니다 (원본에는 없음)' },   // js/tour.js
    { k: 'why', name: 'why', tip: 'Why DosiMachine? — 소개 (강의용, 원본에는 없음)' },   // lecture-only, js/why.js
  ];
  const TB_WORKS = new Set(['open', 'add', 'close', 'profile_graph']);   // toolbar icons that do something (rest = toast)
  function fireTb(name) { let handled = false; toolbarCbs.forEach((f) => { if (f(name) === true) handled = true; }); if (!handled) toast(); }
  function buildToolbar(bar) {
    let tip = null, tipTimer = null;
    const showTip = (node, text) => {
      tipTimer = setTimeout(() => {
        tip = el('div', null, text);
        tip.style.cssText = 'position:fixed;background:#FFFFE1;color:#000;border:1px solid #000;font:9pt "Malgun Gothic","Segoe UI",sans-serif;padding:2px 6px;z-index:2000;pointer-events:none;white-space:nowrap';
        document.body.appendChild(tip);
        const r = node.getBoundingClientRect();
        tip.style.left = Math.min(r.left, innerWidth - tip.offsetWidth - 4) + 'px';
        tip.style.top = (r.bottom + 4) + 'px';
      }, 500);
    };
    const hideTip = () => { clearTimeout(tipTimer); if (tip) { tip.remove(); tip = null; } };
    const attach = (node, d) => {
      if (d.tip) {
        node.addEventListener('mouseenter', () => showTip(node, d.tip));
        node.addEventListener('mouseleave', hideTip);
        node.addEventListener('mousedown', hideTip);
      }
    };
    TB.forEach((d) => {
      let n;
      if (d.k === 'icon') {
        n = el('div', 'dm-tb-icon' + (TB_WORKS.has(d.name) ? ' dm-clickable' : '')); const i = el('img'); i.src = IC(d.img); i.alt = ''; n.appendChild(i);
        n.style.margin = d.m;
      } else if (d.k === 'sep') {
        n = el('div', 'dm-tb-sep'); n.style.margin = '18px ' + d.m.split(' ')[1];
      } else if (d.k === 'sym') {
        n = el('div', 'dm-tb-sym');
        const g = el('span', 'g', d.g); g.style.fontSize = d.gs + 'pt'; g.style.color = d.c || '#fff';
        if (d.b) g.style.fontWeight = '700';
        const t = el('span', 't' + (d.b ? ' b' : ''), d.t); t.style.color = d.c || '#fff';
        n.append(g, t);
      } else if (d.k === 'zoom') {
        n = el('button', 'dm-tb-zoom', '100%'); n.style.margin = d.m;
        ui.zoomLabel = n;
      } else if (d.k === 'gridentry') {
        n = el('input', 'dm-tb-grid'); n.value = '2.0';
        n.addEventListener('keydown', (e) => { if (e.key === 'Enter') toast(); e.stopPropagation(); });
        n.style.userSelect = 'text';
        attach(n, d); bar.appendChild(n); return;
      } else if (d.k === 'cm') {
        bar.appendChild(el('span', 'dm-tb-cm', 'cm')); return;
      } else if (d.k === 'why') {
        n = el('div', 'dm-tb-why'); n.append(el('span', 'g', '✦'), el('span', null, 'Why?'));
      } else if (d.k === 'tour') {
        n = el('div', 'dm-tb-tour'); n.append(el('span', 'g', '▶'), el('span', null, 'Tour'));
      }
      attach(n, d);
      n.addEventListener('click', () => fireTb(d.name));
      bar.appendChild(n);
    });
  }

  /* ---------------- plots ---------------- */
  const PLOT_FONT = '"DejaVu Sans", "Segoe UI", sans-serif';
  function niceTicks(lo, hi, target) {
    const span = hi - lo;
    const raw = span / target;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / mag;
    const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
    const out = [];
    for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    return { ticks: out, step };
  }
  const fmtTick = (v, step) => {
    let dec = 0;
    while (dec < 6 && Math.abs(step * Math.pow(10, dec) - Math.round(step * Math.pow(10, dec))) > 1e-6) dec++;
    return v.toFixed(dec).replace('-', '−');
  };
  function drawPlot(canvas, opts) {
    opts = opts || {};
    canvas._plotOpts = opts;
    const dpr = root.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W || !H) return;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    }
    const c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#EBF5FB'; c.fillRect(0, 0, W, H);
    // figure fractions: left .05 right .99 top .88 bottom .16 wspace .15 over the whole 2-axes figure
    const isRight = canvas.dataset && canvas.dataset.side === 'v';
    const fl = isRight ? 0.1056 : 0.1, fr = isRight ? 0.98 : 0.9744;
    const x0 = fl * W, x1 = fr * W, y0 = 0.12 * H, y1 = 0.84 * H;
    const hasData = Array.isArray(opts.x) && Array.isArray(opts.y) && opts.x.length > 1 && opts.x.length === opts.y.length;
    let xl, xh, yl, yh;
    if (hasData) {
      let a = Infinity, b = -Infinity, p = Infinity, q = -Infinity;
      for (let i = 0; i < opts.x.length; i++) {
        const xv = opts.x[i], yv = opts.y[i];
        if (xv < a) a = xv; if (xv > b) b = xv; if (yv < p) p = yv; if (yv > q) q = yv;
      }
      if (a === b) { a -= 1; b += 1; } if (p === q) { p -= 1; q += 1; }
      xl = a - (b - a) * 0.05; xh = b + (b - a) * 0.05; yl = p - (q - p) * 0.05; yh = q + (q - p) * 0.05;
      if (opts.xlim) { xl = opts.xlim[0]; xh = opts.xlim[1]; }
      if (opts.ylim) { yl = opts.ylim[0]; yh = opts.ylim[1]; }
    } else { xl = -0.055; xh = 0.055; yl = -0.055; yh = 0.055; }
    const xt = hasData ? niceTicks(xl, xh, 7) : { ticks: [-0.04, -0.02, 0, 0.02, 0.04], step: 0.02 };
    const yt = hasData ? niceTicks(yl, yh, 5) : { ticks: [-0.05, -0.025, 0, 0.025, 0.05], step: 0.025 };
    const X = (v) => x0 + (v - xl) / (xh - xl) * (x1 - x0);
    const Y = (v) => y1 - (v - yl) / (yh - yl) * (y1 - y0);
    c.fillStyle = '#fff'; c.fillRect(x0, y0, x1 - x0, y1 - y0);
    // grid
    c.save(); c.strokeStyle = 'rgba(176,176,176,0.5)'; c.lineWidth = 0.8; c.setLineDash([3.7, 1.6]);
    c.beginPath();
    xt.ticks.forEach((v) => { const px = Math.round(X(v)) + 0.5; c.moveTo(px, y0); c.lineTo(px, y1); });
    yt.ticks.forEach((v) => { const py = Math.round(Y(v)) + 0.5; c.moveTo(x0, py); c.lineTo(x1, py); });
    c.stroke(); c.restore();
    // data
    if (hasData) {
      c.save(); c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.clip();
      c.strokeStyle = opts.color || (isRight ? 'red' : 'blue'); c.lineWidth = opts.lineWidth || 1.5; c.lineJoin = 'round';
      c.beginPath();
      for (let i = 0; i < opts.x.length; i++) { const px = X(opts.x[i]), py = Y(opts.y[i]); if (i) c.lineTo(px, py); else c.moveTo(px, py); }
      c.stroke(); c.restore();
    }
    if (opts.overlay) { c.save(); opts.overlay(c, X, Y, { x0, x1, y0, y1 }); c.restore(); }   // demo extras (Real-time analysis)
    // spines
    c.strokeStyle = '#CCCCCC'; c.lineWidth = 1; c.strokeRect(Math.round(x0) + 0.5, Math.round(y0) + 0.5, Math.round(x1 - x0), Math.round(y1 - y0));
    // ticks + labels
    c.strokeStyle = '#000'; c.fillStyle = '#000'; c.lineWidth = 0.8;
    c.font = '11.7px ' + PLOT_FONT;
    c.textAlign = 'center'; c.textBaseline = 'top';
    xt.ticks.forEach((v) => {
      const px = Math.round(X(v)) + 0.5;
      c.beginPath(); c.moveTo(px, y1); c.lineTo(px, y1 + 4); c.stroke();
      c.fillText(fmtTick(v, xt.step), px, y1 + 6);
    });
    c.textAlign = 'right'; c.textBaseline = 'middle';
    yt.ticks.forEach((v) => {
      const py = Math.round(Y(v)) + 0.5;
      c.beginPath(); c.moveTo(x0, py); c.lineTo(x0 - 4, py); c.stroke();
      c.fillText(fmtTick(v, yt.step), x0 - 6, py);
    });
    // title
    c.font = '12.5px ' + PLOT_FONT; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.fillText(opts.title || '', (x0 + x1) / 2, y0 - 7);
  }

  /* ---------------- welcome screen ---------------- */
  const imgCache = {};
  function loadImg(src, cb) {
    if (imgCache[src]) { if (imgCache[src].complete) cb(imgCache[src]); else imgCache[src].addEventListener('load', () => cb(imgCache[src])); return; }
    const i = new Image(); imgCache[src] = i; i.addEventListener('load', () => cb(i)); i.src = src;
  }
  function paintWelcome() {
    const cv = ui.imageCanvas; const cw = cv.width, ch = cv.height;
    if (!cw || !ch) return;
    const c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, cw, ch);
    // Logo width as in the original (it laid this screen out on a canvas 0.81 x the final width, measured from the user's capture).
    const logoW = Math.min(Math.max(Math.floor(cw * 0.81 * 0.28), 420), 650);
    /* Layout (user, 2026-11-17): the original has the linac picture on the left (centre 0.28 w) and the logo column on the
       right (centre 0.70 w), each placed by its own fraction of the canvas. The demo shows the moving QA HUB picture from the
       Why popup instead of the linac (a DOM layer over the canvas: a 380 x 380 crop with sphere + orbits, see why.css .dm-hero)
       and lays the two out as ONE group: the picture is a bit taller than the logo column, both share one vertical centre, the group
       is centred in the canvas, and the two help lines sit centred under it. */
    const draw = () => {
      if (!welcome) return;
      const px = (n) => n * 1.3333;
      c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, cw, ch);
      const T = imgCache['assets/dosimachine2.png'], H = imgCache['assets/dosicare_logo.png'];
      const okT = T && T.complete && T.naturalWidth, okH = H && H.complete && H.naturalWidth;
      const b = whyBadge();                            // lecture-only badge (opens js/why.js), not in the original
      b.classList.add('on');
      // logo column, measured from its own top: logo, subtitle, DosiCare logo, badge (gaps 12 / 90 / 36 px as before).
      // The company-site link that sat under the badge was removed (user, 2026-11-17).
      // The whole group is first laid out at full size (the look the user approved, 2026-11-17 capture). When the canvas is
      // too narrow or short for it (small window, homepage Demo tab), the group is scaled down as ONE piece - picture, logos,
      // gaps, badge and text by the same factor - instead of squeezing the picture next to a full-size logo.
      const HELP_H0 = 74;                              // room kept under the group for the two help lines (full size)
      const BH0 = b.offsetHeight || 70;                // badge height at full size
      const th10 = okT ? Math.floor(T.naturalHeight * logoW / T.naturalWidth) : 90;
      const tw20 = Math.floor(logoW * 0.7), th20 = okH ? Math.floor(H.naturalHeight * tw20 / H.naturalWidth) : 0;
      const badge0 = okH ? th10 + 12 + 90 + th20 / 2 + 36 : th10 + 12 + 150;
      const colH0 = badge0 + BH0;
      const D0 = colH0 * 1.35;                         // the picture is about 1.35 x the column ("the moving picture is small")
      const W0 = D0 * 1.14 + logoW, H0 = Math.max(D0, colH0) + HELP_H0;
      const s = Math.max(0.3, Math.min(1, (cw - 32) / W0, (ch - 20) / H0));
      const lw = Math.round(logoW * s), th1 = Math.round(th10 * s), subRel = th1 + Math.round(12 * s);
      const tw2 = Math.round(tw20 * s), th2 = Math.round(th20 * s), kk = s;
      const badgeRel = Math.round(badge0 * s), colH = badgeRel + BH0 * s, HELP_H = HELP_H0 * s;
      const D = D0 * s;
      const gap = Math.round(D * 0.14);
      const totalW = D + gap + lw;
      const x0 = Math.max(12, Math.round((cw - totalW) / 2));
      const blockH = Math.max(D, colH);
      const top = Math.max(10, Math.round((ch - blockH - HELP_H) / 2));
      const midY = top + blockH / 2;
      const colTop = Math.round(midY - colH / 2);
      const bx = Math.round(x0 + D + gap + lw / 2);

      const hero = heroArt();
      if (hero) {
        hero.style.left = Math.round(x0 + D / 2) + 'px'; hero.style.top = Math.round(midY) + 'px';
        hero.style.transform = 'translate(-50%, -50%) scale(' + (D / 380).toFixed(3) + ')';
        hero.classList.add('on');
      } else setTimeout(draw, 100);   // why.js loads after shell.js

      if (okT) c.drawImage(T, Math.round(bx - lw / 2), colTop, lw, th1);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = px(15) * Math.min(1, logoW / 420) * s + 'px "Segoe UI","Malgun Gothic",sans-serif'; c.fillStyle = '#555555';
      c.fillText('Medical Physics Quality Assurance Tool', bx, colTop + subRel);
      if (okH) c.drawImage(H, Math.round(bx - tw2 / 2), Math.round(colTop + subRel + 90 * kk - th2 / 2), tw2, th2);
      const tb = tourBadge();
      tb.classList.add('on');
      const PAIR_GAP = 10, bw0 = b.offsetWidth || 330, tw0 = tb.offsetWidth || 104;
      const whyX = bx - (tw0 + PAIR_GAP) / 2 * s;                 // centre of the Why badge
      b.style.left = Math.round(whyX) + 'px'; b.style.top = Math.round(colTop + badgeRel) + 'px';
      b.style.transformOrigin = 'top center';
      b.style.transform = s < 1 ? 'translate(-50%, 0) scale(' + s.toFixed(3) + ')' : '';
      tb.style.height = BH0 + 'px';
      tb.style.left = Math.round(whyX + (bw0 / 2 + PAIR_GAP) * s) + 'px'; tb.style.top = b.style.top;
      tb.style.transformOrigin = 'top left';
      tb.style.transform = s < 1 ? 'scale(' + s.toFixed(3) + ')' : '';

      // help lines: shrink with the group, but not below a readable size
      const hs = Math.max(0.75, s);
      const ix = Math.round(x0 + totalW / 2), iy = Math.min(ch - 40 * hs, Math.round(top + blockH + 34 * s));
      c.font = px(10) * hs + 'px "Segoe UI","Malgun Gothic",sans-serif'; c.fillStyle = '#777777';
      c.fillText("Click 'Open' to load DICOM images or profile files", ix, iy);
      c.fillText('Access analysis tools from the Tools and Reports menus', ix, iy + 25 * hs);
    };
    draw();
    ['assets/dosimachine2.png', 'assets/dosicare_logo.png'].forEach((s) => {
      if (!imgCache[s] || !imgCache[s].complete) loadImg(s, draw);
    });
  }
  function showWelcome() {
    welcome = true;
    if (ui) { fitImageCanvas(); paintWelcome(); }
  }
  function hideWelcome() {
    welcome = false;
    if (ui && ui.whyBadge) ui.whyBadge.classList.remove('on');
    if (ui && ui.tourBadge) ui.tourBadge.classList.remove('on');
    if (ui && ui.hero) ui.hero.classList.remove('on');
  }
  function heroArt() {
    if (!ui.hero) {
      if (!(DM.why && DM.why.hubArt)) return null;
      const d = ui.hero = el('div', 'dm-hero');
      d.appendChild(DM.why.hubArt('dmhero').hub);
      ui.imageCanvas.parentNode.appendChild(d);
    }
    return ui.hero;
  }
  function whyBadge() {
    if (!ui.whyBadge) {
      const b = ui.whyBadge = el('button', 'dm-why-badge');
      const t = el('span'); t.append(document.createTextNode('Why DosiMachine?'), el('small', null, '왜 DosiMachine인가 — 눌러서 소개 보기'));
      b.append(el('span', 'g', '✦'), t);
      b.addEventListener('click', () => fireTb('why'));
      ui.imageCanvas.parentNode.appendChild(b);
    }
    return ui.whyBadge;
  }
  // Auto Tour badge next to the Why badge (not in the original): opens the chapter picker of js/tour.js
  function tourBadge() {
    if (!ui.tourBadge) {
      const b = ui.tourBadge = el('button', 'dm-tour-badge');
      b.append(el('span', 'g', '▶'), el('span', null, 'Tour'));
      b.addEventListener('click', () => fireTb('tour'));
      ui.imageCanvas.parentNode.appendChild(b);
    }
    return ui.tourBadge;
  }

  function fitImageCanvas() {
    const cv = ui.imageCanvas;
    const w = Math.max(1, cv.clientWidth), h = Math.max(1, cv.clientHeight);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; return true; }
    return false;
  }

  /* ---------------- Plan View bottom pane: Plan Check sub-view ----------------
     The Plan View is a capture (screens/plan_view_body.png, 1707 x 890, its bottom pane on the Fields tab).
     Clicking the Plan Check tab on it shows this replica of the Plan Check sub-view (main.py
     setup_plan_check_frame) over the bottom pane; its Open Report Window opens the Plan Check report window.
     Rows: the sample plan with the FAST-Forward breast template, as in the report window and its PDF. */
  const PV_W = 1707, PV_H = 890, PV_PANE = { x: 0, y: 671, w: 1247, h: 219 };
  const PC_ROWS = [
    ['PTV WB DVH', 'PTV_EVAL_EZ1', 'V95%>95-90%', 'PTV_EVAL_EZ1', '99.5 %', 'Passed'],
    ['PTV WB DVH', 'PTV_EVAL_EZ1', 'V105%<5-7%', 'PTV_EVAL_EZ1', '0.3 %', 'Passed'],
    ['PTV WB DVH', 'PTV_EVAL_EZ1', 'V107%<2%', 'PTV_EVAL_EZ1', '0.0 %', 'Passed'],
    ['PTV WB DVH', 'PTV_EVAL_EZ1', 'Max<110%', 'PTV_EVAL_EZ1', '105.9 %', 'Passed'],
    ['Tumorbed', '', 'Min>95%', '', 'N/A  (structure not in the structure set)', 'Not Found'],
    ['Ipsilateral Lung', 'Lung.*', 'V30%<15-17%', 'Lungs', '0.4 %', 'Passed'],
    ['Heart', '', 'V25%<5%', '', 'N/A  (structure not in the structure set)', 'Not Found'],
    ['Heart', '', 'V5%<25%', '', 'N/A  (structure not in the structure set)', 'Not Found'],
    ['Heart', '', 'V150cGy<30%', '', 'N/A  (structure not in the structure set)', 'Not Found'],
    ['Heart', '', 'V700cGy<5%', '', 'N/A  (structure not in the structure set)', 'Not Found'],
  ];
  function buildPlanCheckPane(planView) {
    const pct = (v, of) => (v / of * 100) + '%';
    const hit = el('div', 'pv-pc-hit dm-clickable');     // the Plan Check tab on the capture
    Object.assign(hit.style, { left: pct(636, PV_W), top: pct(673, PV_H), width: pct(84, PV_W), height: pct(22, PV_H) });
    const pane = el('div', 'pv-pc');
    const show = (on) => pane.classList.toggle('on', on);
    hit.addEventListener('click', () => show(true));

    const tabs = el('div', 'pv-pc-tabs');
    ['Fields', 'Dose', 'Dose Statistics', 'Plan Objectives', 'Optimization Objectives', 'Calculation Models', 'Plan Check']
      .forEach((t) => {
        const b = el('div', 'pv-pc-tab' + (t === 'Plan Check' ? ' on' : t === 'Fields' || t === 'Calculation Models' ? ' dm-clickable' : ''), t);
        b.addEventListener('click', () => { if (t === 'Fields') show(false); else if (t === 'Calculation Models' && DM.calcmodels) { show(false); DM.calcmodels.show(true); } else if (t !== 'Plan Check') toast(); });
        tabs.appendChild(b);
      });
    const prof = el('div', 'pv-pc-tab prof', 'Dose Profiles'); prof.addEventListener('click', () => toast());
    tabs.appendChild(prof);

    const bar = el('div', 'pv-pc-bar');
    bar.append(el('span', 'lab', 'Template'), el('span', 'combo', 'Fast-Foward Breast'));
    ['Add', 'Delete', 'Save As...', 'Run'].forEach((t) => {
      const b = el('span', 'b', t); b.addEventListener('click', () => toast()); bar.appendChild(b);
    });
    const open = el('span', 'b acc dm-clickable', 'Open Report Window');
    open.addEventListener('click', () => {
      if (!(DM.win && DM.win.openLive && DM.win.openLive('plancheck', rectOf(open)))) toast();
    });
    bar.append(open, el('span', 'rx', 'Rx 2000 cGy (plan)'));

    const nb = el('div', 'pv-pc-nb');
    ['Constraints', 'Structures', 'Plan', 'Policy', 'Collision'].forEach((t, i) => nb.appendChild(el('span', i === 0 ? 'on' : null, t)));

    const grid = el('div', 'pv-pc-grid');
    const tb = el('table');
    const cg = el('colgroup');
    [140, 150, 160, 140, 220, 90].forEach((w) => { const c = el('col'); c.style.width = (w / 900 * 100) + '%'; cg.appendChild(c); });
    const trh = el('tr');
    ['Structure', 'Aliases', 'Constraint', 'Matched', 'Calculated', 'Status'].forEach((n) => trh.appendChild(el('th', n === 'Status' ? 'c' : null, n)));
    const thd = el('thead'); thd.appendChild(trh);
    const tbd = el('tbody');
    PC_ROWS.forEach((r) => {
      const tr = el('tr', r[5].replace(' ', ''));
      r.forEach((v, i) => tr.appendChild(el('td', i === 5 ? 'c' : null, v)));
      tbd.appendChild(tr);
    });
    tb.append(cg, thd, tbd); grid.appendChild(tb);
    grid.addEventListener('wheel', (e) => { e.preventDefault(); grid.scrollTop += e.deltaY > 0 ? 24 : -24; }, { passive: false });

    pane.append(tabs, bar, nb, grid);
    planView.append(hit, pane);
    // stretch like the capture under it (object-fit: fill)
    const fit = () => {
      const sx = planView.clientWidth / PV_W, sy = planView.clientHeight / PV_H;
      pane.style.left = (PV_PANE.x * sx) + 'px'; pane.style.top = (PV_PANE.y * sy) + 'px';
      pane.style.transform = 'scale(' + sx + ',' + sy + ')';
    };
    if (root.ResizeObserver) new ResizeObserver(fit).observe(planView);
    fit();
  }

  /* ---------------- build ---------------- */
  function build(rootEl) {
    ui = {};
    const W = innerWidth, H = innerHeight;
    const rw = W < 1400 ? 380 : W < 1800 ? 460 : W < 2100 ? 540 : 640;
    const ph = H < 900 ? 160 : H < 1050 ? 180 : 190; // original rule (main.py:6732); 1080 -> 190 (+30)
    document.documentElement.style.setProperty('--right-w', rw + 'px');
    document.documentElement.style.setProperty('--bottom-h', (ph + 30) + 'px');

    const app = el('div'); app.id = 'dm-root'; rootEl.appendChild(app);
    ui.menubar = el('div', 'dm-menubar'); app.appendChild(ui.menubar);
    buildMenubar(ui.menubar);
    ui.toolbar = el('div', 'dm-toolbar'); app.appendChild(ui.toolbar);
    buildToolbar(ui.toolbar);

    const body = el('div', 'dm-body'); app.appendChild(body);
    const left = el('div', 'dm-left'); body.appendChild(left);
    const right = el('div', 'dm-right'); body.appendChild(right);

    // nav
    const nav = el('div', 'dm-nav'); left.appendChild(nav);
    // Plan View: shows the original program's Plan View screen (screenshot below the tab row)
    // over everything under the tab row; Image View brings the live main window back.
    body.style.position = 'relative';
    const planView = el('div', 'dm-planview');
    const planImg = el('img'); planImg.src = 'screens/plan_view_body.png'; planImg.alt = '';
    planView.appendChild(planImg); body.appendChild(planView);
    buildPlanCheckPane(planView);
    const PLAN_READY = 'Plan View: Ready';
    const PLAN_LOADED = 'Loaded Plan eztestEZ0 | RS CT_1 | CT 109 sl | Dose sum of 2 BEAM | CT (109, 256, 256) | Dose Max=21.19 Gy | Structures=6';
    const navTabs = [];
    const readyLab = el('div', 'ready', PLAN_READY);
    // Profile View: a pane over the image canvas (mini toolbar + plot), filled by DM.profileview.
    const profPane = el('div', 'dm-profpane');
    const profBar = el('div', 'dm-profbar');
    profBar.append(el('button', null, 'Reset Plot Zoom'), el('span', null, '(Drag a box on the plot to zoom)'));
    ui.profileCanvas = el('canvas');
    profPane.append(profBar, ui.profileCanvas);
    ui.hasProfile = false;
    const VIEW_NAMES = ['Image View', 'Profile View', 'Plan View'];
    const setView = (i) => {
      navTabs.forEach((x, j) => x.classList.toggle('active', j === i));
      planView.classList.toggle('on', i === 2);
      profPane.classList.toggle('on', i === 1);
      disp.classList.toggle('covered', i !== 0);   // hides the welcome badge + hub picture while a pane covers the image view
      readyLab.textContent = i === 2 ? PLAN_LOADED : PLAN_READY;
      if (ui.activeView) ui.activeView.textContent = 'Active View: ' + VIEW_NAMES[i];
      if (i === 1 && profShowCb) profShowCb();
    };
    VIEW_NAMES.forEach((t, i) => {
      const b = el('div', 'dm-tab' + (i === 0 ? ' active' : ''), t);
      b.addEventListener('click', () => {
        if (i === 1 && !ui.hasProfile) { toast(); return; }     // nothing loaded: the demo has no empty Profile View
        setView(i);
      });
      navTabs.push(b); nav.appendChild(b);
    });
    nav.appendChild(readyLab);
    ui.setView = setView;
    ui.setProfileTab = (name) => { ui.hasProfile = !!name; navTabs[1].textContent = name || 'Profile View'; };
    showImageViewFn = () => { if (planView.classList.contains('on') || profPane.classList.contains('on')) navTabs[0].click(); };

    // display
    const disp = el('div', 'dm-display'); left.appendChild(disp);
    ui.imageCanvas = el('canvas', 'image'); disp.appendChild(ui.imageCanvas);
    const cs = el('div', 'dm-contrast'); cs.append(el('div', 'trough'), el('div', 'knob')); disp.appendChild(cs);
    disp.appendChild(profPane);

    // bottom
    const bottom = el('div', 'dm-bottom'); left.appendChild(bottom);
    const stats = el('div', 'dm-stats'); bottom.appendChild(stats);
    const btn = (txt, cls) => { const b = el('button', 'dm-btn ' + cls, txt); b.addEventListener('click', () => toast()); return b; };
    ui.realtimeBtn = el('button', 'dm-btn off dm-clickable', 'Real-time Profile: OFF');   // behaviour is wired by DM.mainview
    ui.realtimeBtn.addEventListener('click', () => { if (rtCb) rtCb(); else toast(); });
    stats.appendChild(ui.realtimeBtn);
    stats.appendChild(btn('Save Profile to ASC', 'blue'));
    stats.appendChild(btn('단위: 아이소 mm', 'on'));
    ui.statusLabel = el('span', 'lab', 'Real-time Profile: OFF'); stats.appendChild(ui.statusLabel);
    const chk = el('span', 'dm-chk'); chk.append(el('i'), document.createTextNode('Symmetric Cursor'));
    chk.addEventListener('click', () => toast()); stats.appendChild(chk);
    stats.appendChild(btn('Grid: OFF', 'off'));
    stats.appendChild(el('span', 'mm', '(mm)'));
    const ent = el('input', 'ent'); ent.value = '10.0';
    ent.addEventListener('keydown', (e) => { if (e.key === 'Enter') toast(); e.stopPropagation(); });
    stats.appendChild(ent);
    stats.appendChild(btn('Apply', 'blue'));
    stats.appendChild(btn('Dose Statistics', 'purple'));

    const plots = el('div', 'dm-plots'); bottom.appendChild(plots);
    const ch = el('canvas'); ch.dataset.side = 'h'; const cv = el('canvas'); cv.dataset.side = 'v';
    plots.append(ch, cv);
    ui.plots = { h: ch, v: cv };

    // right panel
    right.appendChild(el('div', 'dm-rhead', 'File Information'));
    const tabs = el('div', 'dm-rtabs'); right.appendChild(tabs);
    const pages = el('div', 'dm-rpages'); right.appendChild(pages);
    const names = ['≡ Detailed Text', '▦ Analysis Table', 'DVH View', 'Plan Tree'];
    const pg = names.map((n, i) => {
      const t = el('div', 'dm-rtab' + (i === 0 ? ' active' : ''), n);
      const p = el('div', 'dm-rpage' + (i === 0 ? ' active' : ''));
      t.addEventListener('click', () => {
        [...tabs.children].forEach((x, j) => x.classList.toggle('active', j === i));
        [...pages.children].forEach((x, j) => x.classList.toggle('active', j === i));
      });
      tabs.appendChild(t); pages.appendChild(p); return p;
    });
    // Detailed Text
    pg[0].classList.add('has-sb');
    const pre = el('pre'); pg[0].appendChild(pre); pg[0].appendChild(el('div', 'dm-sb'));
    // Analysis Table
    const tb = el('table', 'dm-table');
    const cols = [['Profile Name', 110], ['Flatness', 65], ['Symmetry', 65], ['Field Width', 70], ['Penumbra', 95], ['Center Shift', 65]];
    const cg = el('colgroup'); cols.forEach(([, w]) => { const c = el('col'); c.style.width = w + 'px'; cg.appendChild(c); }); tb.appendChild(cg);
    const trh = el('tr'); cols.forEach(([n]) => trh.appendChild(el('th', null, n)));
    const th = el('thead'); th.appendChild(trh); tb.appendChild(th); tb.appendChild(el('tbody'));
    pg[1].appendChild(tb); pg[1].appendChild(el('div', 'dm-sb'));
    // DVH
    pg[2].classList.add('black');
    const dvh = el('div', 'dm-dvh'); dvh.appendChild(el('div', null, 'DOSE VOLUME HISTOGRAM (DVH)'));
    const row = el('div', 'row'); ['Cumulative', '%', 'Export CSV'].forEach((t) => row.appendChild(el('span', null, t)));
    dvh.appendChild(row); pg[2].appendChild(dvh);
    ui.rightTabs = { detailedText: pre, analysisTable: tb.querySelector('tbody') };

    // profile list
    const pl = el('div', 'dm-plist'); right.appendChild(pl);
    const hd = el('div', 'dm-plhead'); pl.appendChild(hd);
    ui.activeView = el('div', 'av', 'Active View: Profile View'); hd.appendChild(ui.activeView);
    const bs = el('div', 'btns'); hd.appendChild(bs);
    ui.filterBtns = {};
    [['All', 'blue', 'all'], ['∿ Profile', 'dis', 'profile'], ['↘ PDD', 'dis', 'pdd']].forEach(([t, c, k]) => {
      const b = el('button', 'dm-btn ' + c, t);
      b.addEventListener('click', () => { if (!(filterCb && filterCb(k) === true) && k === 'all') toast(); });
      ui.filterBtns[k] = b; bs.appendChild(b);
    });
    const ctl = el('div', 'dm-plctl'); pl.appendChild(ctl);
    ctl.appendChild(el('span', null, 'Loaded Profiles (Right-click to manage)'));
    const al = el('span', 'dm-chk'); al.style.margin = '0'; al.append(el('i'), document.createTextNode('Align to 0')); al.addEventListener('click', () => toast());
    ctl.appendChild(al);
    const plb = el('div', 'dm-plbody'); pl.appendChild(plb);
    const psc = el('div', 'dm-plscroll'); plb.appendChild(psc);     // scrolls like the Treeview, header row stays
    const pt = el('table', 'dm-table');
    const pcg = el('colgroup'); [100, 70, 90, 90].forEach((w) => { const c = el('col'); c.style.width = w + 'px'; pcg.appendChild(c); }); pt.appendChild(pcg);
    const pth = el('thead'); const ptr = el('tr');
    ['Scan Mode', 'Energy', 'Field size X', 'Field size Y'].forEach((n) => ptr.appendChild(el('th', null, n)));
    pth.appendChild(ptr); pt.appendChild(pth); psc.appendChild(pt);
    ui.profileTable = pt.appendChild(el('tbody'));

    // sizing
    const redrawPlots = () => { drawPlot(ch, ch._plotOpts || { title: 'Horizontal (Crossline)' }); drawPlot(cv, cv._plotOpts || { title: 'Vertical (Inline)' }); };
    redrawPlots();
    ui.imageCanvas.width = 1; ui.imageCanvas.height = 1;
    if (root.ResizeObserver) {
      new ResizeObserver(() => { redrawPlots(); }).observe(plots);
      new ResizeObserver(() => { fitImageCanvas(); if (welcome) paintWelcome(); if (resizeCb) resizeCb(ui.imageCanvas); }).observe(disp);
    }
    // initial sizes (layout is ready)
    fitImageCanvas();
    return {
      menubar: ui.menubar, toolbar: ui.toolbar, imageCanvas: ui.imageCanvas, rightTabs: ui.rightTabs,
      statusLabel: ui.statusLabel, plots: ui.plots, realtimeBtn: ui.realtimeBtn, activeView: ui.activeView,
    };
  }

  DM.shell = {
    build, showWelcome, hideWelcome, drawPlot, toast,
    showImageView() { if (showImageViewFn) showImageViewFn(); },
    onMenu(fn) { menuCb = fn; },
    onToolbar(fn) { toolbarCbs.push(fn); },   // listeners return true when they handled the button
    onImageResize(fn) { resizeCb = fn; },
    onRealtime(fn) { rtCb = fn; },
    onFilter(fn) { filterCb = fn; },              // Profile / PDD / All filter buttons; return true when handled
    onProfileShow(fn) { profShowCb = fn; },       // the Profile View tab was brought to the front
    ui() { return ui; },
    plotUtil: { niceTicks, fmtTick },
    closeMenus() { if (ui && ui.menubar.closeAll) ui.menubar.closeAll(); },
    menu: { reveal(labels, openLast) { return ui && ui.menubar.reveal ? ui.menubar.reveal(labels, !!openLast) : null; } },
  };
})(typeof window !== 'undefined' ? window : globalThis);
