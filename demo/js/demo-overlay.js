/* Demo overlay for self-playing live windows (DosiReport, AI Consult): a fake cursor that moves and clicks,
   a caption next to it, and a step card listing the walkthrough. Not part of any original program.
   DM.demoOverlay(app, { W, H, title, steps: [{ t, cap, sub }] }) appends the pieces to `app` (the window's
   fixed-size root, W x H logical px, possibly scaled by the frame) and returns the helpers below. */
(function (root) {
  const DM = root.DM = root.DM || {};
  const WALKTHROUGH_SPEED = 1.3;          // 1 = as written in the window's steps

  const h = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  DM.demoOverlay = function (app, opts) {
    const { W, H, steps } = opts;
    const A = DM.anim;
    // the self-playing walkthroughs run a bit faster than written (lecture time); every move and wait goes through
    // DM.anim.tween, which divides by this. Put back when the window closes so the other windows keep their pace.
    const prevSpeed = A.speed;
    A.speed = opts.speed || WALKTHROUGH_SPEED;
    const timers = [];
    let destroyed = false;
    const later = (fn, ms) => timers.push(setTimeout(() => { if (!destroyed) fn(); }, ms));

    const cursor = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    cursor.setAttribute('viewBox', '0 0 24 32'); cursor.setAttribute('class', 'dr-cursor');
    cursor.innerHTML = '<path d="M2 2 L2 26 L8 20 L12 30 L16 28 L12 18 L20 18 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/>';
    const cap = h('div', 'dr-cap');
    const box = h('div', 'dr-steps');
    box.appendChild(h('h4', null, opts.title));
    const stepEls = steps.map((s, i) => {
      const r = h('div', 'dr-step');
      r.append(h('i', null, String(i + 1)), h('span', null, s.t));
      box.appendChild(r); return r;
    });
    box.appendChild(h('div', 'hint', 'Space 일시정지/재생 · ←/→ 한 단계씩'));
    app.append(box, cap, cursor);

    let cx = W * 0.62, cy = H * 0.55;
    const scaleK = () => { const a = app.getBoundingClientRect(); return a.width / W || 1; };
    // point inside el in app px (fx/fy: 0..1 of its box)
    function at(el, fx, fy) {
      const a = app.getBoundingClientRect(), r = el.getBoundingClientRect(), k = scaleK();
      return { x: (r.left - a.left + r.width * (fx == null ? 0.5 : fx)) / k, y: (r.top - a.top + r.height * (fy == null ? 0.5 : fy)) / k };
    }
    function placeCap() {
      if (!cap.classList.contains('on')) return;
      const cw = cap.offsetWidth, ch = cap.offsetHeight;
      let x = cx + 30, y = cy + 26;
      if (x + cw > W - 12) x = cx - cw - 24;
      if (y + ch > H - 12) y = cy - ch - 22;
      cap.style.left = Math.max(12, x) + 'px'; cap.style.top = Math.max(12, y) + 'px';
    }
    function placeCursor() { cursor.style.transform = 'translate(' + (cx - 3) + 'px,' + (cy - 3) + 'px)'; placeCap(); }
    function say(text, sub) {
      cap.innerHTML = '';
      cap.appendChild(document.createTextNode(text));
      if (sub) cap.appendChild(h('small', null, sub));
      cap.classList.add('on'); placeCap();
    }
    function hideCap() { cap.classList.remove('on'); }
    function showCursor(on) { cursor.classList.toggle('on', on); }
    const wait = (ms, t) => A.wait(ms, t);
    async function moveTo(p, t, ms) {
      const x0 = cx, y0 = cy;
      const d = Math.hypot(p.x - x0, p.y - y0);
      await A.tween(ms || Math.min(1100, 380 + d * 0.55), (k) => {
        const e = A.ease(k); cx = x0 + (p.x - x0) * e; cy = y0 + (p.y - y0) * e; placeCursor();
      }, t);
    }
    async function click(t) {
      const r = h('div', 'dr-ripple'); r.style.left = cx + 'px'; r.style.top = cy + 'px';
      app.appendChild(r); later(() => r.remove(), 600);
      await wait(220, t);
    }
    async function scrollTo(el, top, t, ms) {
      top = Math.max(0, Math.min(el.scrollHeight - el.clientHeight, top));
      const s0 = el.scrollTop;
      if (Math.abs(top - s0) < 2) return;
      await A.tween(ms || 700, (k) => { el.scrollTop = s0 + (top - s0) * A.ease(k); }, t);
    }
    // scrollTop of `scroller` that puts el in its middle
    function centerTop(scroller, el) {
      const k = scaleK();
      const off = (el.getBoundingClientRect().top - scroller.getBoundingClientRect().top) / k + scroller.scrollTop;
      return off - scroller.clientHeight / 2 + el.offsetHeight / 2;
    }
    function markSteps(doneUpTo, now) {
      stepEls.forEach((e, i) => { e.classList.toggle('done', i <= doneUpTo); e.classList.toggle('now', i === now); });
    }
    // start step i: mark it, show the cursor and the step's caption
    function begin(i) { markSteps(i - 1, i); showCursor(true); say(steps[i].cap, steps[i].sub); }
    // end state of step i after a pause/jump (-1 = just opened)
    function settle(i, lastText) {
      markSteps(i, -1);
      if (i < 0) { showCursor(false); hideCap(); }
      else say(i >= steps.length - 1 ? lastText : steps[i].cap + ' ✓', 'Space: 이어서 재생');
    }
    placeCursor();
    markSteps(-1, -1);

    return {
      at, say, hideCap, showCursor, wait, moveTo, click, scrollTo, centerTop, markSteps, begin, settle, later,
      destroy() { destroyed = true; timers.forEach(clearTimeout); A.speed = prevSpeed; },
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
