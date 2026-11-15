/* Visitor registration gate - not part of the original program.
   On the first visit a popup asks for a name and a hospital or a company (one of the two is enough; user 2026-11-16, was
   name / hospital / email / phone) over a blurred demo; the demo is blocked until it is filled. The hospital box has
   "병원" after it, so "서울대" is recorded as "서울대병원".
   The answers are kept in this browser's localStorage, so the same browser on the same computer is never asked again.
   Each registration is POSTed to a Google Apps Script web app that appends a row to a Google Sheet (docs/gate/apps-script.gs).
   Offline or not yet configured: the visitor still gets in, the row stays "pending" and is re-sent on a later visit. */
(function () {
  // Paste the Apps Script web-app URL here (Deploy > New deployment > Web app > URL ending in /exec). Empty = save locally only.
  // Sheet "DosiMachine 데모 접속자" (tab 접속자) owned by the DosiCare Google account.
  const SHEET_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyCL7n0dHESNfi60R3mkRackrIJwzsc9LuDI8DtwbU3dxGk141ygFct_BxFjPEZSxPr/exec';

  const KEY = 'dm_visitor_v1';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
  }
  function save(v) {
    try { localStorage.setItem(KEY, JSON.stringify(v)); return true; } catch (e) { return false; }
  }

  // no-cors: the browser can not read Apps Script's reply, so "resolved" only means the request left this computer
  function send(v) {
    if (!SHEET_ENDPOINT) return Promise.reject(new Error('SHEET_ENDPOINT not set'));
    const body = new URLSearchParams({
      name: v.name || '', hospital: v.hospital || '', company: v.company || '',
      email: v.email || '', phone: v.phone || '',   // only rows saved by the old four-box popup still carry these
      registeredAt: v.registeredAt, source: location.protocol === 'file:' ? 'local file' : location.host,
    });
    return fetch(SHEET_ENDPOINT, { method: 'POST', mode: 'no-cors', body });
  }
  function sendAndMark(v) {
    return send(v).then(() => { v.sent = true; save(v); }, (err) => { console.warn('[gate] not sent yet, will retry next visit:', err.message); });
  }

  // The demo is laid out for 1366 x 768 or more. On a phone, once past the popup (which is itself sized for phones):
  // opened on its own, the page asks the browser for a 1366-px-wide layout and zooms out to fit; inside the homepage's
  // Demo tab, the homepage scales the frame instead and only needs to hear that the popup is done.
  function desktopLayout() {
    window.dispatchEvent(new Event('dm-gate-done'));   // js/guide.js shows the first-visit guide after the popup
    if (window.parent !== window) {
      try { window.parent.postMessage('dm-gate-done', '*'); } catch (e) { /* ignore */ }
    } else if (Math.min(screen.width, screen.height) < 600) {
      const vp = document.querySelector('meta[name="viewport"]');
      if (vp) vp.setAttribute('content', 'width=1366');
    }
  }

  const known = load();
  if (known && known.name) {
    if (!known.sent) sendAndMark(known);
    desktopLayout();
    return;
  }

  // ---- popup ----
  const back = document.createElement('div');
  back.className = 'gate-back';
  back.innerHTML =
    '<form class="gate-card" novalidate>' +
      '<img class="gate-logo" src="assets/dosimachine2.png" alt="DosiMachine">' +
      '<h2>방명록</h2>' +
      '<p class="gate-sub">두 칸만 남겨 주시면 데모가 열립니다. 이 컴퓨터에서는 다시 묻지 않습니다.</p>' +
      '<label class="gate-f"><span>이름</span><input name="name" type="text" placeholder="홍길동" autocomplete="name" maxlength="60"></label>' +
      '<div class="gate-f gate-org"><span>병원 또는 회사 <small>(둘 중 하나)</small></span>' +
        '<div class="gate-org-row">' +
          '<label class="gate-org-box"><input name="hospital" type="text" placeholder="서울대" autocomplete="off" maxlength="60"><em>병원</em></label>' +
          '<i class="gate-or">또는</i>' +
          '<label class="gate-org-box"><em>회사:</em><input name="company" type="text" placeholder="도시케어" autocomplete="organization" maxlength="60"></label>' +
        '</div></div>' +
      '<div class="gate-err" role="alert"></div>' +
      '<button type="submit" class="gate-go">데모 시작하기</button>' +
      '<p class="gate-note">시작하면 이름과 소속을 데모 안내 목적으로 수집·이용하는 데 동의하는 것으로 봅니다.</p>' +
    '</form>';

  const form = back.querySelector('form');
  const err = back.querySelector('.gate-err');

  // keep the demo's own shortcuts (1-9, F, H, Space, ...) and first-click fullscreen from firing while the visitor types
  const block = (e) => { e.stopPropagation(); };
  const EVENTS = ['keydown', 'keyup', 'keypress', 'pointerdown', 'mousedown', 'click', 'wheel'];
  function guard(on) {
    EVENTS.forEach((t) => (on ? window.addEventListener : window.removeEventListener).call(window, t, block, true));
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = form.elements;
    // the box already says 병원: "서울대" -> "서울대병원"; a visitor who typed "서울대병원" does not get "병원병원"
    const hosp = f.hospital.value.trim().replace(/\s*병원$/, '');
    const v = { name: f.name.value.trim(), hospital: hosp ? hosp + '병원' : '', company: f.company.value.trim() };
    let bad = null;
    if (!v.name) bad = [f.name, f.name.closest('label'), '이름을 입력해 주세요.'];
    else if (!v.hospital && !v.company) bad = [f.hospital, form.querySelector('.gate-org'), '병원 또는 회사 중 하나를 적어 주세요.'];
    form.querySelectorAll('.bad').forEach((n) => n.classList.remove('bad'));
    if (bad) {
      err.textContent = bad[2];
      bad[1].classList.add('bad');
      bad[0].focus();
      return;
    }
    v.registeredAt = new Date().toISOString();
    v.sent = false;
    save(v);
    sendAndMark(v);
    guard(false);
    back.classList.remove('show');
    setTimeout(() => { back.remove(); desktopLayout(); }, 300);
  });

  guard(true);
  document.body.appendChild(back);
  requestAnimationFrame(() => { back.classList.add('show'); form.elements.name.focus(); });
})();
