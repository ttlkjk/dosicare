/* Phones, inside the homepage's Demo tab only (dosicare.co.kr): the homepage shows this demo scaled down to fit
   (index.html fitDemoFrame). Touches on the frame land in this document and never reach the homepage, so the
   browser's own two-finger zoom does nothing there. Two-finger gestures are caught here and passed up; the homepage
   zooms and moves the frame. One-finger taps and drags still go to the demo as before. Not in the original program. */
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
})();
