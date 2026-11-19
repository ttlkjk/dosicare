/* DosiMachine replica - window manager: Windows-style child window over the main window,
   screenshot windows opened from menu items, menu wiring and the presenter keyboard.

   Live window contract (DM.windows[key] = { title, width, height, theme, mount(body) }):
   - mount(body) receives an element of EXACTLY width x height CSS px (the original window's
     logical size, unscaled). It is a positioned (absolute) box with overflow:hidden, so children can use position:absolute; the mount fills it and may
     lay out in fixed px like the Tk original. The frame scales it with transform: scale(k)
     (origin top left), k = largest factor that fits the screen minus 24px margins and the title
     bar (k may be >1 or <1); k is re-applied on maximize/restore and on browser resize.
   - mount returns { player?, ready?, destroy() }. destroy() is called exactly once, on any
     close or when another window replaces this one (also if the mount itself throws after
     returning). `ready` must be a live property (getter): winman reads it at keypress time and
     ignores space/arrows while it is === false.
   - `theme` only adds the class theme-<x> to the frame; no theme styles exist unless the window
     adds them itself.
   - Screenshot windows are sized by the capture's aspect ratio and are not scaled. */
(function (root) {
  const DM = root.DM = root.DM || {};
  const MARGIN = 24, TITLE_H = 32, TAB_H = 28;
  const ORDER = ['wl', 'starshot', 'pf', 'trs398'];
  const SCREENS = () => (root.DM_DATA && root.DM_DATA.screens) || {};
  DM.windows = DM.windows || {};

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  let cur = null;      // { title, inst, node, maximized }
  const win = {};

  function hasScreen(path) { const s = SCREENS()[path]; return !!(s && s.length); }
  // menu items that have nothing to show are drawn grey
  function isGrey(path, item) {
    if (!item) return false;
    if (item.disabled) return true;
    if (item.action === 'open') return false;
    const m = /^live:(.+)$/.exec(item.action || '');
    if (m && DM.windows[m[1]]) return false;
    return !hasScreen(path);
  }

  function close() {
    screenToken++;                                          // a slow screenshot load must not pop up later
    if (!cur) return;
    const c = cur; cur = null;
    if (c.onResize) removeEventListener('resize', c.onResize);
    try { if (c.inst && c.inst.destroy) c.inst.destroy(); } catch (e) { console.error(e); }
    c.node.remove();
  }

  /* opts: { title, subtitle, width, height, extraH, theme, origin, render(body) } */
  function open(opts) {
    if (DM.shell && DM.shell.closeMenus) DM.shell.closeMenus();
    close();
    screenToken++;
    const vw = innerWidth, vh = innerHeight;
    const maxW = vw - MARGIN * 2, maxH = vh - MARGIN * 2;
    const extra = opts.extraH || 0;                           // tab strip inside the window
    const bw0 = opts.width || 800, bh0 = opts.height || 600;
    let k = Math.min(maxW / bw0, (maxH - TITLE_H - extra) / bh0);
    if (opts.natural) k = Math.min(1, k);                     // small dialog: its own size, shrunk only if the screen is smaller
    const bw = Math.max(200, Math.floor(bw0 * k)), bh = Math.max(120, Math.floor(bh0 * k));
    const w = bw, h = bh + TITLE_H + extra;

    const node = el('div', 'dm-win' + (opts.theme ? ' theme-' + opts.theme : ''));
    node.style.width = w + 'px'; node.style.height = h + 'px';
    node.style.left = Math.round((vw - w) / 2) + 'px'; node.style.top = Math.round((vh - h) / 2) + 'px';
    const bar = el('div', 'dm-win-bar');
    const ic = el('img', 'dm-win-icon'); ic.src = 'assets/app_icon.png'; ic.alt = ''; ic.draggable = false;
    bar.append(ic, el('span', 'dm-win-title', opts.title || ''));
    if (opts.subtitle) bar.append(el('span', 'dm-win-sub', opts.subtitle));
    bar.append(el('span', 'dm-win-fill'));
    const bMin = el('button', 'dm-win-btn min'); bMin.title = '닫기';
    const bMax = el('button', 'dm-win-btn max'); bMax.title = '꽉 채우기';
    const bX = el('button', 'dm-win-btn x', '✕'); bX.title = '닫기';
    [bMin, bMax, bX].forEach((b) => { b.tabIndex = -1; b.addEventListener('pointerdown', (e) => e.stopPropagation()); });
    bar.append(bMin, bMax, bX);
    const wrap = el('div', 'dm-win-body');
    let body = wrap, inner = null;
    if (opts.scaled) {                                        // live window: fixed-px inner, scaled by the frame
      inner = el('div', 'dm-win-inner');
      inner.style.width = bw0 + 'px'; inner.style.height = bh0 + 'px';
      wrap.appendChild(inner); body = inner;
    }
    node.append(bar, wrap);
    document.body.appendChild(node);
    if (opts.natural) {                                       // grow by the frame border so the capture is shown at exactly 1:1
      const dw = node.offsetWidth - wrap.clientWidth, dh = node.offsetHeight - TITLE_H - extra - wrap.clientHeight;
      if (dw > 0 || dh > 0) {
        node.style.width = (w + Math.max(0, dw)) + 'px'; node.style.height = (h + Math.max(0, dh)) + 'px';
        node.style.left = Math.round((vw - node.offsetWidth) / 2) + 'px'; node.style.top = Math.round((vh - node.offsetHeight) / 2) + 'px';
      }
    }

    const entry = { title: opts.title, inst: null, node, maximized: false, onResize: null };
    cur = entry;
    // re-fit a scaled live window to the screen (open, maximize/restore, browser resize)
    const fit = () => {
      if (!inner) return;
      const W = innerWidth, H = innerHeight;
      const kk = entry.maximized ? Math.min(W / bw0, (H - TITLE_H) / bh0)
        : Math.min((W - MARGIN * 2) / bw0, (H - MARGIN * 2 - TITLE_H) / bh0);
      const fw = Math.round(bw0 * kk), fh = Math.round(bh0 * kk);
      inner.style.transform = 'scale(' + kk + ')';
      if (entry.maximized) {
        inner.style.left = Math.round((W - bw0 * kk) / 2) + 'px'; inner.style.top = '0px';
      } else {
        inner.style.left = '0px'; inner.style.top = '0px';
        node.style.width = fw + 'px'; node.style.height = (fh + TITLE_H) + 'px';
        node.style.left = Math.max(0, Math.min(W - fw, node.offsetLeft)) + 'px';
        node.style.top = Math.max(0, Math.min(H - TITLE_H, node.offsetTop)) + 'px';
      }
    };
    if (inner) { entry.onResize = fit; addEventListener('resize', fit); }
    const closeThis = () => { if (cur === entry) close(); };
    bMin.addEventListener('click', closeThis);
    bX.addEventListener('click', closeThis);
    let saved = null;
    bMax.addEventListener('click', () => {
      entry.maximized = !entry.maximized;
      node.classList.toggle('max', entry.maximized);
      if (entry.maximized) saved = { l: node.style.left, t: node.style.top };
      else if (saved) { node.style.left = saved.l; node.style.top = saved.t; }
      fit();
    });
    bar.addEventListener('dblclick', () => bMax.click());
    // The original analysis windows open maximized (state('zoomed')), so every window
    // starts filling the screen; □ restores the floating size as before.
    if (opts.maximized !== false) {
      entry.maximized = true;
      node.classList.add('max');
      saved = { l: node.style.left, t: node.style.top };
    }

    // drag by the title bar
    bar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || entry.maximized) return;
      const sx = e.clientX, sy = e.clientY, l0 = node.offsetLeft, t0 = node.offsetTop;
      bar.setPointerCapture(e.pointerId);
      const mv = (ev) => {
        const nl = Math.min(innerWidth - 80, Math.max(80 - node.offsetWidth, l0 + ev.clientX - sx));
        const nt = Math.min(innerHeight - TITLE_H, Math.max(0, t0 + ev.clientY - sy));
        node.style.left = nl + 'px'; node.style.top = nt + 'px';
      };
      const up = () => { bar.removeEventListener('pointermove', mv); bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', up); };
      bar.addEventListener('pointermove', mv); bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
    });

    // grow from the menu position (0.25 s)
    const o = opts.origin;
    if (o && o.width != null) {
      const l = (vw - w) / 2, t = (vh - h) / 2;
      node.style.transformOrigin = (o.left + o.width / 2 - l) + 'px ' + (o.top + o.height / 2 - t) + 'px';
      node.classList.add('grow');
      node.getBoundingClientRect();
      setTimeout(() => node.classList.remove('grow'), 20);
    }

    if (inner) fit();
    try { entry.inst = opts.render ? (opts.render(body) || null) : null; }
    catch (e) {
      console.error(e);
      closeThis();
    }
    return { close: closeThis };
  }

  /* ---------------- screenshot window ---------------- */
  function loadImage(src) {
    return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  }
  let screenToken = 0;
  // Data Handling, RTPS and Demo Status are small fixed-size Toplevel dialogs in the original (e.g. Move =
  // geometry("420x430"), point_tool_window.py:163). Their captures are that size, so they open floating at 1:1.
  const DIALOG_MENUS = ['Data Handling > ', 'RTPS > ', 'Help > Demo Status'];
  const isDialog = (path) => DIALOG_MENUS.some((p) => path.indexOf(p) === 0);
  function openScreen(path, origin, label) {
    const list = SCREENS()[path];
    if (!list || !list.length) return null;
    const tok = ++screenToken;
    const first = list.find((it) => it.file);          // window size comes from the first real capture
    return loadImage(first ? first.file : '').then((im0) => {
      if (tok !== screenToken) return null;
      const nat = im0 ? { w: im0.naturalWidth, h: im0.naturalHeight } : { w: 1707, h: 1019 };
      const dialog = isDialog(path);
      return open({
        title: label || path.split(' > ').pop(), subtitle: '화면 캡처',
        width: nat.w, height: nat.h, extraH: list.length > 1 ? TAB_H : 0, origin,
        maximized: !dialog, natural: dialog,
        render(body) { return mountShot(body, list); },
      });
    });
  }

  function mountShot(body, list) {
    const tabEls = [];
    let tabs = null;
    if (list.length > 1) { tabs = el('div', 'dm-win-tabs'); body.appendChild(tabs); }
    const view = el('div', 'dm-shot');
    const img = el('img'); img.draggable = false; img.alt = '';
    view.appendChild(img);
    body.appendChild(view);
    // A list entry with `intro` instead of `file` is a lecture-only HTML page (js/intros/*.js), shown in place of the capture.
    const intro = el('div', 'dm-intro');
    body.appendChild(intro);
    let s = 1, tx = 0, ty = 0, idx = 0;

    const apply = () => {
      const W = view.clientWidth, H = view.clientHeight;
      tx = Math.min(0, Math.max(W - W * s, tx)); ty = Math.min(0, Math.max(H - H * s, ty));
      img.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')';
      view.classList.toggle('zoomed', s > 1.001);
    };
    // zoom to scale ns keeping the point (px,py) of the view fixed
    const zoomAt = (ns, px, py) => {
      ns = Math.min(4, Math.max(1, ns));
      const ix = (px - tx) / s, iy = (py - ty) / s;
      s = ns; tx = px - ix * s; ty = py - iy * s;
      if (s === 1) { tx = 0; ty = 0; }
      apply();
    };
    // click = 2x centred on that point (click again = back to 1x)
    const clickZoom = (px, py) => {
      if (s > 1.001) { s = 1; tx = 0; ty = 0; apply(); return; }
      s = 2; tx = view.clientWidth / 2 - px * 2; ty = view.clientHeight / 2 - py * 2; apply();
    };
    let drag = null;
    view.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, tx, ty, moved: false };
      view.setPointerCapture(e.pointerId);
    });
    view.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 4) drag.moved = true;
      if (drag.moved && s > 1.001) { tx = drag.tx + dx; ty = drag.ty + dy; apply(); }
    });
    const end = (e) => {
      if (!drag) return;
      const d = drag; drag = null;
      if (!d.moved && e.type === 'pointerup') { const r = view.getBoundingClientRect(); clickZoom(e.clientX - r.left, e.clientY - r.top); }
    };
    view.addEventListener('pointerup', end); view.addEventListener('pointercancel', end);
    view.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = view.getBoundingClientRect();
      zoomAt(s * (e.deltaY < 0 ? 1.2 : 1 / 1.2), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    const show = (i) => {
      idx = i; s = 1; tx = 0; ty = 0;
      const page = list[i].intro && DM.intros && DM.intros[list[i].intro];
      view.style.display = page ? 'none' : '';
      intro.style.display = page ? '' : 'none';
      if (page) { intro.innerHTML = ''; page(intro); } else { img.src = list[i].file; apply(); }
      tabEls.forEach((t, j) => t.classList.toggle('active', j === i));
    };
    if (tabs) list.forEach((it, i) => {
      const t = el('div', 'dm-rtab', it.tab || ('' + (i + 1)));
      t.addEventListener('click', () => show(i));
      tabs.appendChild(t); tabEls.push(t);
    });
    show(0);
    const ro = root.ResizeObserver ? new ResizeObserver(apply) : null;
    if (ro) ro.observe(view);
    return { destroy() { if (ro) ro.disconnect(); }, get index() { return idx; } };
  }

  /* ---------------- menu actions ---------------- */
  function openLive(key, origin, path, label) {
    const reg = DM.windows[key];
    if (reg) {
      const handle = open({
        title: reg.title, width: reg.width, height: reg.height, theme: reg.theme, origin, scaled: true,
        render(body) { return reg.mount(body); },
      });
      if (handle) autoRun();
      return handle;
    }
    if (path && hasScreen(path)) return openScreen(path, origin, label);
    return null;
  }
  /* Presenter shortcut: a live window presses its own RUN ANALYSIS / Calculate once its
     images are loaded, after a short pause so the empty original window is seen first.
     Space still pauses/replays as before. Cancelled if the window is closed or replaced. */
  const AUTO_RUN_DELAY_MS = 600;
  function autoRun() {
    const entry = cur;
    const started = Date.now();
    const tick = () => {
      if (cur !== entry || !entry || !entry.inst) return;            // closed or replaced
      if (win.noAutoRun) return;                                     // the Auto Tour (js/tour.js) presses the window's steps itself
      if (entry.inst.ready === false) {
        if (Date.now() - started < 10000) setTimeout(tick, 100);      // wait for images, give up after 10 s
        return;
      }
      const p = entry.inst.player;
      if (p && p.toggle) p.toggle();
    };
    setTimeout(tick, AUTO_RUN_DELAY_MS);
  }

  const LIVE_PATH = {};      // menu path of each live key, for the screenshot fallback
  (DM.menuLeaves ? DM.menuLeaves() : []).forEach((l) => {
    const m = /^live:(.+)$/.exec(l.item.action || '');
    if (m) LIVE_PATH[m[1]] = l.path;
  });

  function onMenu(ev) {
    const { path, item, anchorRect } = ev;
    const label = path.split(' > ').pop();
    const act = item.action || 'screen';
    if (act === 'open') {
      if (DM.opendialog) DM.opendialog.open(); else DM.mainview.open();   // File > Open shows the Open dialog first
    } else if (/^live:/.test(act)) {
      if (!openLive(act.slice(5), anchorRect, path, label)) DM.shell.toast();
    } else if (!openScreen(path, anchorRect, label)) DM.shell.toast();
  }

  /* ---------------- keyboard (ported from the old app.js) ---------------- */
  const fsToggle = () => {
    const r = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    if (r && r.catch) r.catch(() => {});
  };
  function onKey(e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return;      // Alt+Left (back), Ctrl+F, Ctrl+1 stay with the browser
    const t = e.target, tag = t.tagName;
    const pointer = tag === 'BUTTON' || (tag === 'INPUT' && t.type === 'range');   // keys still belong to the player
    const typing = !pointer && ['INPUT', 'SELECT', 'TEXTAREA'].includes(tag);
    const k = e.key, c = e.code;                          // e.code works even in Korean IME mode
    const is = (key, code) => k === key || c === code;
    if (k === 'Escape' || k === 'Home' || c === 'Home' || k === 'h' || k === 'H' || c === 'KeyH') {
      if (typing && (k === 'h' || k === 'H' || c === 'KeyH' || k === 'Home' || c === 'Home')) return;   // typing text / moving the caret, not a command
      if (typing) { if (!e.repeat) { e.preventDefault(); t.blur(); } return; }       // Esc while typing only leaves the field (and closes its dropdown)
      if (e.repeat) return;
      e.preventDefault(); close(); return;
    }
    if (typing) return;
    const inst = cur && cur.inst;
    const player = inst && inst.ready !== false ? inst.player : null;
    const digit = /^(?:Digit|Numpad)([1-9])$/.exec(c || '');
    if (is(' ', 'Space')) { e.preventDefault(); if (player && !e.repeat) player.toggle(); }
    else if (is('ArrowRight', 'ArrowRight')) { e.preventDefault(); if (player && !e.repeat) player.next(); }
    else if (is('ArrowLeft', 'ArrowLeft')) { e.preventDefault(); if (player && !e.repeat) player.prev(); }
    else if (k === 'f' || k === 'F' || c === 'KeyF') { if (!e.repeat) fsToggle(); }
    else if (/^[1-9]$/.test(k) || digit) {
      if (e.repeat) return;
      const key = ORDER[Number(digit ? digit[1] : k) - 1];
      if (key) { const p = LIVE_PATH[key]; openLive(key, null, p, p && p.split(' > ').pop()); }
    }
  }

  /* Browsers only allow fullscreen from a user gesture, so a page opened by double-click
     goes fullscreen on the first click or key press (once; F toggles it after that).
     Inside the homepage's Demo tab (dosicare.co.kr) it never starts on its own (user, 2026-11-15); F still works.
     The launcher .bat opens a maximized window with a title bar, like the original program, and must stay that way
     (user, 2026-11-17): it adds ?win=1 to the URL, and then nothing happens here either. */
  let autoFsDone = window.parent !== window || /[?&]win=1\b/.test(location.search);
  function autoFullscreen(e) {
    if (autoFsDone) return;
    autoFsDone = true;
    document.removeEventListener('pointerdown', autoFullscreen, true);
    document.removeEventListener('keydown', autoFullscreen, true);
    const alreadyFull = document.fullscreenElement
      || (window.innerHeight >= screen.height - 1 && window.innerWidth >= screen.width - 1);
    const isF = e.type === 'keydown' && (e.key === 'f' || e.key === 'F' || e.code === 'KeyF');
    if (alreadyFull || isF || e.key === 'Escape') return;   // F is handled by onKey; Esc grants no gesture
    // phones / tablets: the homepage shows the demo scaled down to fit; fullscreen would drop that scaling
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;
    const r = document.documentElement.requestFullscreen();
    if (r && r.catch) r.catch(() => {});
  }
  document.addEventListener('pointerdown', autoFullscreen, true);
  document.addEventListener('keydown', autoFullscreen, true);

  Object.assign(win, { open, close, hasScreen, isGrey, openScreen, openLive });
  Object.defineProperty(win, 'current', { get() { return cur ? { title: cur.title, inst: cur.inst } : null; } });
  DM.win = win;
  if (DM.shell) DM.shell.onMenu(onMenu);
  // toolbar "파일 추가" icon = File > Add Data, which the demo shows as its capture
  if (DM.shell && DM.shell.onToolbar) DM.shell.onToolbar((name) => {
    if (name !== 'add' || !hasScreen('File > Add Data')) return false;
    openScreen('File > Add Data', null, 'Add Data');
    return true;
  });
  document.addEventListener('keydown', onKey);
})(typeof window !== 'undefined' ? window : globalThis);
