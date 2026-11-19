/* Auto Tour - not part of the original program (user, 2026-11-19).
   A fake cursor drives the REAL demo (menus, dialogs, buttons) while a caption bar at the bottom explains; the
   visitor picks one chapter or plays them all. The script is data/tour.js, the DOM-free parts are js/tour-core.js.
   Spec: docs/superpowers/specs/2026-11-19-auto-tour-design.md

   While a chapter plays, a transparent shield covers the page so the visitor's own mouse cannot disturb the open
   menus; pressing it pauses the tour and gives the demo back. Playing again restarts the current scene on an empty
   stage. Keys while playing: Space pause, Left/Right previous/next scene, Esc end. A chapter starts on, and the tour ends on, the first screen. While paused the keys belong to
   the demo again. Self-playing windows: `step` presses the window's own steps (the window manager's auto-run is off
   while the tour plays, DM.win.noAutoRun); `view` presses a main-window view tab. Voice: a line's recording (assets/tour/<line id>.mp3, listed in data/tour-audio.js) is played with its
   caption and the line waits for it to end; the note button switches it off (remembered in this browser). */
(function (root) {
  const DM = root.DM = root.DM || {};
  const C = DM.tourCore, A = DM.anim;
  const SEEN_KEY = 'dm_tour_seen_v1';
  const SOUND_KEY = 'dm_tour_sound_v1';   // '0' = the visitor switched the voice off
  const GAP_MS = 250;          // pause between two lines
  const AUTO_NEXT_S = 5;       // "play all": seconds the end card waits before the next chapter
  const WAIT_MS = 5000;        // longest wait for a window / dialog / element to appear
  const chapters = () => (root.DM_DATA && root.DM_DATA.tour && root.DM_DATA.tour.chapters) || [];

  const h = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const button = (cls, text, fn) => { const b = h('button', cls, text); b.type = 'button'; b.addEventListener('click', fn); return b; };

  let ui = null;          // built on first use
  let run = null;         // { chapter, all, runner }
  let cx = 0, cy = 0;     // cursor tip, viewport px
  let hotEls = [], autoTimer = 0;
  // voice: one recording per script line (data/tour-audio.js, made by bake/make_tour_audio.py); lines without one stay silent
  const voices = () => (root.DM_DATA && root.DM_DATA.tourAudio) || {};
  let clip = null, clipDone = null;
  let soundOn = (() => { try { return localStorage.getItem(SOUND_KEY) !== '0'; } catch (e) { return true; } })();

  /* ---------------- pieces ---------------- */
  function build() {
    if (ui) return ui;
    const rootEl = h('div', 'tour-root');
    const shield = h('div', 'tour-shield');
    shield.addEventListener('pointerdown', (e) => {
      if (!run) return;
      // the press only pauses: on touch the browser would replay it as mousedown/click on the demo that is now uncovered
      e.preventDefault();
      const off = () => { document.removeEventListener('click', eat, true); clearTimeout(tm); };
      const eat = (ev) => { ev.stopPropagation(); ev.preventDefault(); off(); };
      const tm = setTimeout(off, 500);
      document.addEventListener('click', eat, true);
      run.runner.pause();
    });
    const ring = h('div', 'tour-ring');
    const cursor = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    cursor.setAttribute('viewBox', '0 0 24 32'); cursor.setAttribute('class', 'tour-cursor');
    cursor.innerHTML = '<path d="M2 2 L2 26 L8 20 L12 30 L16 28 L12 18 L20 18 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/>';
    const bar = h('div', 'tour-bar'), main = h('div', 'tour-main');
    const pos = h('div', 'tour-pos'), text = h('div', 'tour-text');
    main.append(pos, text, h('div', 'tour-hint', '멈췄습니다. 화면을 직접 눌러 보세요. ▶ 를 누르면 이 장면을 처음부터 다시 봅니다.'));
    const ctl = h('div', 'tour-ctl');
    const mk = (cls, label, title, fn) => { const b = button('tour-btn ' + cls, label, fn); b.title = title; ctl.appendChild(b); return b; };
    mk('prev', '«', '이전 장면 (←)', () => run && run.runner.prev());
    const bPlay = mk('play', '❚❚', '멈춤 / 재생 (Space)', toggle);
    mk('next', '»', '다음 장면 (→)', () => run && run.runner.next());
    const bSnd = mk('snd', '♪', '소리 켜기 / 끄기', toggleSound);
    bSnd.classList.toggle('off', !soundOn);
    mk('list', '☰', '챕터 목록', () => { stop(); openPicker(); });
    mk('x', '✕', '끝내기 (Esc)', stop);
    bar.append(main, ctl);
    const picker = h('div', 'tour-picker'), card = h('div', 'tour-card');
    picker.appendChild(card);
    picker.addEventListener('pointerdown', (e) => { if (e.target === picker) closePicker(); });
    const end = h('div', 'tour-end'), endCard = h('div', 'tour-end-card');
    end.appendChild(endCard);
    rootEl.append(shield, ring, cursor, bar, picker, end);
    document.body.appendChild(rootEl);
    ui = { root: rootEl, ring, cursor, bar, pos, text, bPlay, picker, card, end, endCard };
    fitScale();
    return ui;
  }
  // a phone shows this page scaled down inside the homepage: enlarge the pieces (same rule as guide.js)
  function fitScale() {
    let k = 1;
    try { const fe = root.frameElement; if (fe) k = fe.getBoundingClientRect().width / (root.innerWidth || 1); } catch (e) { k = 1; }
    ui.root.style.setProperty('--ts', k > 0 && k < 0.8 ? Math.min(2.6, 0.9 / k).toFixed(3) : '1');
  }

  /* ---------------- cursor ---------------- */
  function placeCursor() { ui.cursor.style.transform = 'translate(' + (cx - 3) + 'px,' + (cy - 3) + 'px)'; }
  function showCursor(on) { ui.cursor.classList.toggle('on', !!on); }
  async function moveTo(el, t, fx, fy) {
    const r = el.getBoundingClientRect();
    const px = r.left + r.width * (fx == null ? 0.5 : fx), py = r.top + r.height * (fy == null ? 0.5 : fy);
    const x0 = cx, y0 = cy, d = Math.hypot(px - x0, py - y0);
    showCursor(true);
    await A.tween(Math.min(1000, 320 + d * 0.5), (k) => { const e = A.ease(k); cx = x0 + (px - x0) * e; cy = y0 + (py - y0) * e; placeCursor(); }, t);
  }
  async function ripple(t) {
    const r = h('div', 'tour-ripple');
    r.style.left = cx + 'px'; r.style.top = cy + 'px';
    ui.root.appendChild(r);
    setTimeout(() => r.remove(), 600);
    await A.wait(220, t);
  }
  function hot(el) { el.classList.add('tour-hot'); hotEls.push(el); }
  function clearHot() { hotEls.forEach((e) => e.classList.remove('tour-hot')); hotEls = []; }
  function ringOn(el) {
    const r = el.getBoundingClientRect();
    Object.assign(ui.ring.style, { left: (r.left - 4) + 'px', top: (r.top - 4) + 'px', width: (r.width + 8) + 'px', height: (r.height + 8) + 'px' });
    ui.ring.classList.add('on');
  }
  function clearRing() { ui.ring.classList.remove('on'); }

  /* ---------------- actions (script `do`) ---------------- */
  function need(el, what) { if (!el) throw new Error('tour: not found: ' + what); return el; }
  // poll until find() returns something or WAIT_MS passes (null then)
  async function waitFor(find, t, ms) {
    const t0 = performance.now();
    for (;;) {
      const v = find();
      if (v) return v;
      if (performance.now() - t0 > (ms || WAIT_MS)) return null;
      await A.wait(60, t);
    }
  }
  const mouse = (el, type) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: root }));
  // the cursor goes down the menu path one level at a time; with fire it clicks the last row
  async function walkMenu(labels, fire, t) {
    for (let n = 1; n <= labels.length; n++) {
      const part = labels.slice(0, n), last = n === labels.length;
      const el = need(DM.shell.menu.reveal(part, false), 'menu ' + part.join(' > '));
      await moveTo(el, t, n === 1 ? 0.5 : 0.3);
      hot(el);
      if (last && fire) {
        await ripple(t);
        clearHot();
        el.click();
        need(await waitFor(() => document.querySelector('.dm-win, .dm-od'), t), 'window after ' + labels.join(' > '));   // captures load their picture first
        return;
      }
      DM.shell.menu.reveal(part, true);
      await A.wait(260, t);
    }
  }
  const ACT = {
    menu: (path, t) => walkMenu(path.split(' > '), false, t),
    click: (path, t) => walkMenu(path.split(' > '), true, t),
    async tab(name, t) {
      const el = need(await waitFor(() => [...document.querySelectorAll('.dm-win .dm-rtab')].find((x) => x.textContent === name), t), 'tab ' + name);
      await moveTo(el, t); await ripple(t); el.click();
    },
    // the file-type list of the Open dialog: the first call opens it, the next one closes it
    async filter(_, t) {
      const el = need(await waitFor(() => document.querySelector('.dm-od .od-combo'), t), 'file type list');
      await moveTo(el, t, 0.9); await ripple(t); mouse(el, 'mousedown');
    },
    async openFile(name, t) {
      const row = need(await waitFor(() => [...document.querySelectorAll('.dm-od .od-row')].find((r) => r.firstChild.textContent === name), t), 'file ' + name);
      await moveTo(row, t, 0.25); await ripple(t); mouse(row, 'mousedown');
      await A.wait(350, t);
      const ok = need(document.querySelector('.dm-od .od-btn.def'), 'Open button');
      await moveTo(ok, t); await ripple(t); ok.click();
    },
    async press(sel, t) {
      const el = need(await waitFor(() => document.querySelector(sel), t), sel);
      await moveTo(el, t); await ripple(t); el.click();
    },
    async point(sel, t) {
      const el = need(await waitFor(() => document.querySelector(sel), t), sel);
      ringOn(el);
      await moveTo(el, t, 0.85, 0.85);
    },
    // script numbers: 0 overview, 1-8 cards, 9 summary (DM.why.go counts from -1)
    async why(n, t) {
      if (!DM.why.isOpen) { DM.why.open(); await A.wait(350, t); }
      const node = document.querySelectorAll('.why-node')[n - 1];
      if (node) { await moveTo(node, t); await ripple(t); }
      DM.why.go(n - 1);
    },
    async close(_, t) { closeAll(); await A.wait(200, t); },
    // the Image View / Profile View / Plan View tab of the main window
    async view(name, t) {
      const el = need(await waitFor(() => [...document.querySelectorAll('.dm-tab')].find((x) => x.textContent === name), t), 'view ' + name);
      await moveTo(el, t); await ripple(t); el.click();
    },
    /* A self-playing window (js/windows/*.js): the tour presses its steps instead of the window manager's auto-run, so a
       caption (and its voice) and the window's step go together. step: n plays the window's steps up to step n (1-based);
       step: 'end' presses the window's own start (RUN / Space) and waits until its last step is done. */
    async step(n, t) {
      showCursor(false);                                   // the window shows its own cursor
      const inst = need(await waitFor(() => { const c = DM.win.current; return c && c.inst && c.inst.ready !== false && c.inst.player ? c.inst : null; }, t, 20000), 'a self-playing window');
      const p = inst.player;
      const st = () => p.state || {};
      const count = st().count != null ? st().count : (p.steps ? p.steps.length : 1);
      const idx = () => (st().index == null ? -1 : st().index);
      // a window may close itself at its last step (3D EPID PDD opens its export in the main window): that is the end
      const gone = () => !DM.win.current || DM.win.current.inst !== inst;
      const idle = async (ms) => {
        const t0 = performance.now();
        while (!gone() && (st().busy || st().playing)) {
          if (performance.now() - t0 > ms) throw new Error('tour: the window step did not finish');
          await A.wait(80 * A.speed, t);
        }
      };
      await idle(120000);
      if (n === 'end') {
        // the window's own start may first animate a button press: wait for it to begin, then for it to end
        for (let tries = 0; !gone() && idx() < count - 1; tries++) {
          if (tries > count + 2) throw new Error('tour: the window did not reach its last step');
          const before = idx(), t0 = performance.now();
          p.toggle();
          while (!(st().busy || st().playing) && idx() === before && performance.now() - t0 < 4000) await A.wait(80 * A.speed, t);
          await idle(180000);
        }
        return;
      }
      const goal = Math.min(n, count) - 1;
      for (let guard = 0; !gone() && idx() < goal; guard++) {
        if (guard > count + 2) throw new Error('tour: the window does not advance');
        await p.next();
        await A.wait(60 * A.speed, t);
        await idle(120000);
      }
    },
  };

  /* ---------------- stage ---------------- */
  function closeAll() {
    clearHot(); clearRing();
    DM.shell.closeMenus();
    if (DM.opendialog && DM.opendialog.isOpen) DM.opendialog.close();
    if (DM.why) DM.why.close();
    if (DM.win) DM.win.close();
  }
  // before a scene: an empty stage, except when a keep-scene is reached by playing through the one before it
  /* ---------------- voice ---------------- */
  function stopVoice(why) {
    if (clip) { clip.onended = clip.onerror = null; clip.pause(); }
    if (clipDone) { const d = clipDone; clipDone = null; d(why || 'stopped'); }
  }
  // start this line's recording; returns { done } where done becomes 'ended', or the reason it did not play through
  function speak(line) {
    stopVoice();
    const v = voices()[line.id];
    if (!soundOn || !v) return null;
    if (!clip) { clip = new Audio(); clip.preload = 'auto'; }
    const h = { done: '' };
    clipDone = (why) => { h.done = why; };
    const fin = (why) => { if (clipDone) { const d = clipDone; clipDone = null; clip.onended = clip.onerror = null; d(why); } };
    clip.onended = () => fin('ended');
    clip.onerror = () => fin('failed');
    clip.src = v.file;
    const p = clip.play();
    if (p && p.catch) p.catch(() => fin('blocked'));     // autoplay refused: the line falls back to its reading time
    return h;
  }
  function toggleSound() {
    soundOn = !soundOn;
    try { localStorage.setItem(SOUND_KEY, soundOn ? '1' : '0'); } catch (e) { /* ignore */ }
    const b = ui.bar.querySelector('.tour-btn.snd');
    if (b) b.classList.toggle('off', !soundOn);
    if (!soundOn) stopVoice('off');                      // the current line goes on with its reading time
  }

  function reset(scene, jumped) {
    stopVoice();
    if (scene.view) {                                    // the scene needs this view tab; a jump may arrive from another
      const tab = [...document.querySelectorAll('.dm-tab')].find((x) => x.textContent === scene.view);
      if (tab && !tab.classList.contains('active')) tab.click();
    }
    if (scene.keep && !jumped) { clearHot(); clearRing(); return; }
    closeAll();
  }
  async function runLine(line, t) {
    clearRing();
    ui.text.textContent = line.say;
    const t0 = performance.now();
    const heard = speak(line);
    if (line.do) {
      const k = Object.keys(line.do)[0];
      if (!ACT[k]) throw new Error('tour: unknown action ' + k);
      await ACT[k](line.do[k], t);
    }
    // with a voice the line stays until the voice has finished; without one (none recorded, switched off, blocked by
    // the browser, failed to load) it stays for the reading time
    if (heard) { while (!heard.done) await A.wait(60 * A.speed, t); }
    if (!heard || heard.done !== 'ended') {
      const left = C.readMs(line.say) - (performance.now() - t0);
      if (left > 0) await A.wait(left * A.speed, t);     // A.wait divides by A.speed
    }
    await A.wait(GAP_MS, t);
  }

  /* ---------------- run ---------------- */
  function onState(s) {
    if (!run) return;
    const all = chapters(), no = all.indexOf(run.chapter) + 1;
    ui.pos.textContent = no + '/' + all.length + ' ' + run.chapter.title + ' · 장면 ' + (s.index + 1) + '/' + s.count;
    ui.bPlay.textContent = s.playing ? '❚❚' : '▶';
    ui.root.classList.toggle('playing', s.playing);
    if (DM.win) DM.win.noAutoRun = s.playing;            // while the tour plays, windows wait for the tour's `step`
    ui.bar.classList.toggle('paused', !s.playing && !s.done);
    if (!s.playing) { showCursor(false); clearRing(); clearHot(); stopVoice(); }
    if (s.done) finishChapter();
  }
  function start(id, all) {
    const ch = chapters().find((c) => c.id === id);
    if (!ch || !ch.scenes.length) return;
    build();
    closePicker(); hideEnd();
    if (run) run.runner.stop();
    closeAll();
    if (DM.mainview && DM.mainview.close) DM.mainview.close();   // every chapter starts on the first screen
    run = { chapter: ch, all: !!all, runner: new C.Runner({ scenes: ch.scenes, runLine, reset, onState }) };
    ui.root.classList.add('on'); ui.bar.classList.add('on');
    cx = innerWidth * 0.5; cy = innerHeight * 0.55; placeCursor();
    run.runner.play(0);
  }
  function toggle() { if (run && !run.runner.done) run.runner.toggle(); }
  function stop() {
    if (!ui) return;
    hideEnd();
    stopVoice();
    if (DM.win) DM.win.noAutoRun = false;
    const was = run;
    if (run) { run.runner.stop(); run = null; }
    ui.bar.classList.remove('on', 'paused');
    ui.root.classList.remove('playing');
    showCursor(false);
    if (!ui.picker.classList.contains('on')) ui.root.classList.remove('on');
    if (was) { closeAll(); if (DM.mainview && DM.mainview.close) DM.mainview.close(); }   // back to the first screen
  }

  /* ---------------- end of a chapter ---------------- */
  function seenSet() { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch (e) { return new Set(); } }
  function markSeen(id) { const s = seenSet(); s.add(id); try { localStorage.setItem(SEEN_KEY, JSON.stringify([...s])); } catch (e) { /* ignore */ } }
  function hideEnd() { clearInterval(autoTimer); autoTimer = 0; if (ui) ui.end.classList.remove('on'); }
  function finishChapter() {
    const ch = run.chapter, all = run.all;
    markSeen(ch.id);
    const next = C.nextChapter(chapters(), ch.id);
    const c = ui.endCard;
    c.textContent = '';
    c.appendChild(h('div', 'tour-end-t', '「' + ch.title + '」 챕터를 다 봤습니다'));
    c.appendChild(h('div', 'tour-end-n', next ? '다음: ' + next.title + ' (약 ' + next.minutes + '분)' : '준비된 Tour를 모두 보셨습니다.'));
    const count = h('div', 'tour-end-c');
    const row = h('div', 'tour-end-b');
    if (next) row.appendChild(button('main', '이어서 보기', () => start(next.id, all)));
    row.appendChild(button('', '목록으로', () => { stop(); openPicker(); }));
    row.appendChild(button('', '끝내기', stop));
    c.append(count, row);
    ui.end.classList.add('on');
    if (next && all) {
      let n = AUTO_NEXT_S;
      count.textContent = n + '초 뒤 저절로 넘어갑니다';
      autoTimer = setInterval(() => {
        n -= 1;
        if (n <= 0) start(next.id, true); else count.textContent = n + '초 뒤 저절로 넘어갑니다';
      }, 1000);
    }
  }

  /* ---------------- chapter picker ---------------- */
  function openPicker() {
    build();
    if (run) stop();
    const all = chapters(), can = C.playable(all), seen = seenSet(), card = ui.card;
    card.textContent = '';
    const head = h('div', 'tour-p-head');
    head.append(h('b', null, 'DosiMachine Tour'), h('span', null, '보고 싶은 부분을 고르세요. 데모가 스스로 움직이며 설명합니다.'),
      button('tour-p-x', '✕', closePicker));
    card.appendChild(head);
    if (can.length) {
      const mins = can.reduce((a, c) => a + c.minutes, 0);
      card.appendChild(button('tour-p-all', '▶ 처음부터 전부 보기 (약 ' + mins + '분)', () => start(can[0].id, true)));
    }
    all.forEach((c, i) => {
      const ok = c.scenes.length > 0;
      const row = h('button', 'tour-p-row' + (ok ? '' : ' off') + (seen.has(c.id) ? ' seen' : ''));
      row.type = 'button'; row.disabled = !ok;
      const mid = h('div');
      mid.append(h('b', null, c.title), h('small', null, c.desc));
      row.append(h('i', null, seen.has(c.id) ? '✓' : String(i + 1)), mid, h('em', null, ok ? '약 ' + c.minutes + '분' : '준비 중'));
      if (ok) row.addEventListener('click', () => start(c.id, false));
      card.appendChild(row);
    });
    ui.root.classList.add('on'); ui.picker.classList.add('on');
  }
  function closePicker() {
    if (!ui) return;
    ui.picker.classList.remove('on');
    if (!run) ui.root.classList.remove('on');
  }

  /* ---------------- keyboard ---------------- */
  // registered at load, on window capture: runs before the Open dialog's, the Why popup's and the window manager's handlers
  function onKey(e) {
    if (!ui || e.ctrlKey || e.altKey || e.metaKey) return;
    const k = e.key, c = e.code;
    let hit = true;
    if (ui.picker.classList.contains('on')) { if (k === 'Escape') closePicker(); else hit = false; }
    else if (ui.end.classList.contains('on') && k === 'Escape') stop();
    else if (!run || !run.runner.playing) hit = false;       // paused or no tour: the keys belong to the demo
    else if (k === 'Escape') stop();
    else if (k === ' ' || c === 'Space') { if (!e.repeat) toggle(); }
    else if (k === 'ArrowRight') { if (!e.repeat) run.runner.next(); }
    else if (k === 'ArrowLeft') { if (!e.repeat) run.runner.prev(); }
    else hit = false;
    if (hit) { e.preventDefault(); e.stopImmediatePropagation(); }
  }
  root.addEventListener('keydown', onKey, true);
  root.addEventListener('resize', () => { if (ui) fitScale(); });

  DM.tour = { open: openPicker, start, stop, get active() { return !!run; } };
  if (DM.shell && DM.shell.onToolbar) DM.shell.onToolbar((name) => { if (name === 'tour') { openPicker(); return true; } return false; });
})(typeof window !== 'undefined' ? window : globalThis);
