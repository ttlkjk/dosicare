(function (root) {
  const DM = (root.DM = root.DM || {});
  const CANCEL = { cancelled: true };
  const raf = root.requestAnimationFrame
    ? root.requestAnimationFrame.bind(root)
    : (fn) => setTimeout(() => fn(Date.now()), 16);
  const now = () => (root.performance ? root.performance.now() : Date.now());

  DM.anim = {
    speed: 1,
    CANCEL,
    ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
    tween(ms, draw, token) {
      return new Promise((resolve, reject) => {
        const start = now();
        const frame = () => {
          if (token && token.cancelled) return reject(CANCEL);
          const t = Math.min(1, (now() - start) / Math.max(1, ms / DM.anim.speed));
          draw(t);
          if (t < 1) raf(frame); else resolve();
        };
        raf(frame);
      });
    },
    wait(ms, token) { return DM.anim.tween(ms, () => {}, token); },
  };
  if (typeof module === 'object' && module.exports) module.exports = DM.anim;
})(typeof window !== 'undefined' ? window : globalThis);
