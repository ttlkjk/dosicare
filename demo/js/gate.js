/* Visitor registration gate - not part of the original program.
   On the first visit a popup asks for name / hospital / email / phone over a blurred demo; the demo is blocked until it is filled.
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
      name: v.name, hospital: v.hospital, email: v.email, phone: v.phone,
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
      '<h2>데모를 시작하기 전에</h2>' +
      '<p class="gate-sub">처음 한 번만 입력하면, 이 컴퓨터에서는 다시 묻지 않습니다.</p>' +
      field('name', '이름', 'text', '홍길동', 'name') +
      field('hospital', '병원명', 'text', '○○대학교병원', 'organization') +
      field('email', '이메일', 'email', 'name@hospital.com', 'email') +
      field('phone', '핸드폰', 'tel', '010-1234-5678', 'tel') +
      '<label class="gate-agree"><input type="checkbox" name="agree"> ' +
        '<span>개인정보 수집 · 이용에 동의합니다.<small>수집 항목: 이름, 병원명, 이메일, 핸드폰 · 목적: 데모 이용 안내와 연락 · 보관: 동의 철회 시까지</small></span></label>' +
      '<div class="gate-err" role="alert"></div>' +
      '<button type="submit" class="gate-go">데모 시작하기</button>' +
    '</form>';
  function field(name, label, type, ph, ac) {
    return '<label class="gate-f"><span>' + label + '</span><input name="' + name + '" type="' + type + '" placeholder="' + ph + '" autocomplete="' + ac + '" maxlength="100"></label>';
  }

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
    const v = {
      name: f.name.value.trim(), hospital: f.hospital.value.trim(),
      email: f.email.value.trim(), phone: f.phone.value.trim(),
    };
    const digits = v.phone.replace(/\D/g, '');
    let bad = null;
    if (!v.name) bad = ['name', '이름을 입력해 주세요.'];
    else if (!v.hospital) bad = ['hospital', '병원명을 입력해 주세요.'];
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) bad = ['email', '이메일 주소를 확인해 주세요.'];
    else if (digits.length < 9 || digits.length > 13) bad = ['phone', '핸드폰 번호를 확인해 주세요.'];
    else if (!f.agree.checked) bad = ['agree', '개인정보 수집 · 이용에 동의해 주세요.'];
    form.querySelectorAll('.bad').forEach((n) => n.classList.remove('bad'));
    if (bad) {
      err.textContent = bad[1];
      const n = f[bad[0]];
      (n.closest('label') || n).classList.add('bad');
      n.focus();
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
