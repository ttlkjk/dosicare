/* Phones, inside the homepage's Demo tab only (dosicare.co.kr): the homepage shows this demo scaled down to fit
   (index.html fitDemoFrame). Touches on the frame land in this document and never reach the homepage, so the
   browser's own zoom and scroll do nothing there. Gestures are caught here and passed up; the homepage zooms and
   moves the frame. Not in the original program.
   - two fingers: zoom and move (the demo itself gets nothing meanwhile: a screen-capture window has its own
     tap-to-zoom and drag-to-move in winman.js, which would otherwise fight the pinch)
   - one finger, only while zoomed in: dragging moves the view; the press is cancelled in the demo once the finger
     travels a few pixels, so window drags and sliders do not react. Not zoomed in, a drag goes to the demo as before.
   - a tap without a drag always goes to the demo. */
(function () {
  if (window.parent === window || !window.frameElement || !('ontouchstart' in window)) return;

  const post = (msg) => { try { window.parent.postMessage(msg, '*'); } catch (err) { /* ignore */ } };
  let zoomed = false;   // told by the homepage (index.html applyDemoView)
  window.addEventListener('message', (e) => {
    if (e.source === window.parent && e.data && e.data.type === 'dm-zoom') zoomed = !!e.data.zoomed;
  });

  // ---- two fingers (touch events: both fingers in one event) ----
  // A finger's place on the homepage, measured right now: the homepage moves and scales this page while the fingers
  // move, so this page's own coordinates shift under them, and a position worked out later from them is out of date
  // (the view shook). Touch.screenX is no way round it: some phone browsers report it as 0 inside a frame.
  const frameEl = window.frameElement;   // the homepage's <iframe> (same site)
  function onHomepage(cx, cy) {
    const r = frameEl.getBoundingClientRect();
    const k = r.width / (frameEl.offsetWidth || r.width);   // current scale of the frame
    return [r.left + cx * k, r.top + cy * k];
  }

  // x, y: finger midpoint in this page's own (unscaled) coordinates - used once, to find the demo point under the
  // fingers. sx, sy, sd: midpoint and spread on the homepage, which the homepage follows from then on.
  function sendPinch(phase, e) {
    const msg = { type: 'dm-pinch', phase };
    const a = e.touches[0], b = e.touches[1];
    if (a && b) {
      const pa = onHomepage(a.clientX, a.clientY), pb = onHomepage(b.clientX, b.clientY);
      msg.x = (a.clientX + b.clientX) / 2;
      msg.y = (a.clientY + b.clientY) / 2;
      msg.sx = (pa[0] + pb[0]) / 2;
      msg.sy = (pa[1] + pb[1]) / 2;
      msg.sd = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
    }
    post(msg);
  }
  let pinching = false;
  const opt = { passive: false, capture: true };
  window.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 2) return;
    pinching = true;
    e.preventDefault();
    sendPinch('start', e);
  }, opt);
  window.addEventListener('touchmove', (e) => {
    if (pinching && e.touches.length >= 2) { e.preventDefault(); sendPinch('move', e); return; }
    if (pan) e.preventDefault();   // zoomed in: one finger moves the view, so the browser must not start its own scroll
  }, opt);
  const stopPinch = (e) => {
    if (!pinching || e.touches.length >= 2) return;
    pinching = false;
    sendPinch('end', e);
  };
  window.addEventListener('touchend', stopPinch, true);
  window.addEventListener('touchcancel', stopPinch, true);

  // ---- who gets the fingers (pointer events) ----
  const pointers = new Map();     // finger id -> element its press went to
  const blocked = new Set();      // fingers whose events the demo must not see until they lift
  let passing = false;            // true while our own cancel event travels to the demo
  let quietUntil = 0;             // swallow the click a gesture can leave behind
  let pan = null;                 // one-finger move while zoomed: { id, x0, y0, on }

  // the finger's press already reached the demo: end it there as a cancel (not a tap) and keep the rest from it
  function takeOver(id) {
    if (blocked.has(id)) return;
    const target = pointers.get(id);
    passing = true;
    try { target.dispatchEvent(new PointerEvent('pointercancel', { pointerId: id, pointerType: 'touch', bubbles: true })); } catch (err) { /* ignore */ }
    passing = false;
    blocked.add(id);
  }
  function endPan() {
    if (pan && pan.on) post({ type: 'dm-pan', phase: 'end' });
    pan = null;
  }

  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    pointers.set(e.pointerId, e.target);
    if (pointers.size === 1) {
      if (zoomed) {
        const p = onHomepage(e.clientX, e.clientY);
        pan = { id: e.pointerId, x0: p[0], y0: p[1], on: false };
      }
      return;
    }
    // second finger: a pinch; the demo gets neither finger
    endPan();
    pointers.forEach((_, id) => { if (id !== e.pointerId) takeOver(id); });
    blocked.add(e.pointerId);
    e.stopImmediatePropagation();
  }, true);

  function onPointer(e) {
    if (passing || e.pointerType !== 'touch') return;
    const lifted = e.type === 'pointerup' || e.type === 'pointercancel';
    if (pan && e.pointerId === pan.id) {
      if (e.type === 'pointermove') {
        const p = onHomepage(e.clientX, e.clientY);   // homepage, not this page: see onHomepage
        if (!pan.on && Math.hypot(p[0] - pan.x0, p[1] - pan.y0) > 8) {
          pan.on = true;
          takeOver(e.pointerId);
          post({ type: 'dm-pan', phase: 'start', sx: p[0], sy: p[1] });
        } else if (pan.on) {
          post({ type: 'dm-pan', phase: 'move', sx: p[0], sy: p[1] });
        }
      } else if (lifted) {
        endPan();
      }
    }
    if (blocked.has(e.pointerId)) {
      e.stopImmediatePropagation();
      if (lifted) { blocked.delete(e.pointerId); quietUntil = Date.now() + 400; }
    }
    if (lifted) pointers.delete(e.pointerId);
  }
  ['pointermove', 'pointerup', 'pointercancel'].forEach((t) => window.addEventListener(t, onPointer, true));
  window.addEventListener('click', (e) => {
    if (blocked.size || Date.now() < quietUntil) { e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);
})();
