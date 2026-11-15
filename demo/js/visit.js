/* Visit log, inside the homepage's Demo tab only (dosicare.co.kr) - not part of the original program (user, 2026-11-16).
   Clicks in this frame never reach the homepage, so each one is reported up; the homepage counts the site's clicks
   and time and writes one row per visit to the sheet (index.html visit log). Clicks on the guest-book popup are not
   counted: gate.js stops them before they get here. */
(function () {
  if (window.parent === window) return;
  document.addEventListener('click', () => {
    try { window.parent.postMessage('dm-click', '*'); } catch (e) { /* ignore */ }
  }, true);
})();
