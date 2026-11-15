/* Phones, inside the homepage's Demo tab only (dosicare.co.kr): the homepage shows this demo scaled down to fit
   (index.html fitDemoFrame). Touches on the frame land in this document and never reach the homepage, so the
   browser's own two-finger zoom does nothing there. Two-finger gestures are caught here and passed up; the homepage
   zooms and moves the frame. One-finger taps and drags still go to the demo as before. Not in the original program.
   While two fingers are down the demo itself gets nothing: a screen-capture window has its own tap-to-zoom and
   drag-to-move (winman.js), which would otherwise fight the pinch. */
(function () {
  if (window.parent === window || !('ontouchstart' in window)) return;

  function send(phase, e) {
    const msg = { type: 'dm-pinch', phase };
    const a = e.touches[0], b = e.touches[1];
    if (a && b) {   // midpoint and spread of the two fingers, in this page's own (unscaled) coordinates
      msg.x = (a.clientX + b.clientX) / 2;
      msg.y = (a.clientY + b.clientY) / 2;
      msg.d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    }
    try { window.parent.postMessage(msg, '*'); } catch (err) { /* ignore */ }
  }

  let pinching = false;
  const opt = { passive: false, capture: true };
  window.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 2) return;
    pinching = true;
    e.preventDefault();
    send('start', e);
  }, opt);
  window.addEventListener('touchmove', (e) => {
    if (!pinching || e.touches.length < 2) return;
    e.preventDefault();
    send('move', e);
  }, opt);
  const stop = (e) => {
    if (!pinching || e.touches.length >= 2) return;
    pinching = false;
    send('end', e);
  };
  window.addEventListener('touchend', stop, true);
  window.addEventListener('touchcancel', stop, true);

  // Keep the demo out of two-finger gestures. pointers: finger id -> element its press went to.
  const pointers = new Map();
  const blocked = new Set();      // fingers whose events the demo must not see until they lift
  let passing = false;            // true while our own cancel event travels to the demo
  let quietUntil = 0;             // swallow the click a pinch can leave behind
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    pointers.set(e.pointerId, e.target);
    if (pointers.size < 2) return;
    // second finger: the first one's press already reached the demo, so end it there as a cancel (not a tap)
    passing = true;
    pointers.forEach((target, id) => {
      if (id === e.pointerId || blocked.has(id)) return;
      try { target.dispatchEvent(new PointerEvent('pointercancel', { pointerId: id, pointerType: 'touch', bubbles: true })); } catch (err) { /* ignore */ }
    });
    passing = false;
    pointers.forEach((_, id) => blocked.add(id));
    e.stopImmediatePropagation();
  }, true);
  function onPointer(e) {
    if (passing || e.pointerType !== 'touch') return;
    const lifted = e.type === 'pointerup' || e.type === 'pointercancel';
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
