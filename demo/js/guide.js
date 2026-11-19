/* First-visit guide - not part of the original program (user, 2026-11-15).
   New visitors did not know the functions sit behind the top menu bar. Once, per browser: the screen dims, the menu
   bar is lit and outlined, and a bubble says to open a menu (blue-dot items open a real screen). Any click or key
   closes it, and a click on the menu bar still opens that menu. Shown after the registration popup (gate.js), or on
   load for a visitor who registered before. Inside the homepage on a phone the demo is shown scaled down
   (index.html fitDemoFrame), so the bubble is enlarged there to stay readable.
   The bubble also offers the Auto Tour (js/tour.js, user, 2026-11-19). */
(function (root) {
  const KEY = 'dm_guide_v1';
  const seen = () => { try { return !!localStorage.getItem(KEY); } catch (e) { return true; } };
  const registered = () => { try { return !!localStorage.getItem('dm_visitor_v1'); } catch (e) { return false; } };

  function show() {
    if (seen() || document.querySelector('.dmg-back')) return;
    const bar = document.querySelector('.dm-menubar');
    if (!bar || !bar.firstElementChild) return;
    try { localStorage.setItem(KEY, '1'); } catch (e) { /* ignore */ }

    // lit area: from the first to the last menu title
    const a = bar.firstElementChild.getBoundingClientRect(), b = bar.lastElementChild.getBoundingClientRect();
    const box = { left: a.left - 4, top: a.top - 2, width: b.right - a.left + 8, height: Math.max(a.height, b.height) + 4 };

    const back = document.createElement('div');
    back.className = 'dmg-back';
    const hole = document.createElement('div');
    hole.className = 'dmg-hole';
    Object.assign(hole.style, { left: box.left + 'px', top: box.top + 'px', width: box.width + 'px', height: box.height + 'px' });
    const tip = document.createElement('div');
    tip.className = 'dmg-tip';
    tip.innerHTML =
      '<div class="dmg-arrow"></div>' +
      '<div class="dmg-title">👆 위쪽 메뉴부터 눌러 보세요</div>' +
      '<div class="dmg-line">메뉴를 누르면 DosiMachine의 기능 목록이 펼쳐집니다.</div>' +
      '<div class="dmg-line"><span class="dmg-dot"></span><b>파란 점</b>이 붙은 항목은 실제 화면이 열립니다.</div>' +
      '<div class="dmg-ex">예: <b>Machine QA</b> → <b>Winston-Lutz</b></div>' +
      '<div class="dmg-line">처음이시면 <b>둘러보기</b>가 대신 눌러서 보여 드립니다.</div>' +
      '<div class="dmg-btns"><button type="button" class="dmg-tour">▶ 둘러보기 틀기</button>' +
      '<button type="button" class="dmg-ok">알겠어요</button></div>';
    tip.style.left = Math.max(8, box.left + 12) + 'px';
    tip.style.top = (box.top + box.height + 12) + 'px';

    // a phone shows this page scaled down inside the homepage: enlarge the bubble so it reads at about 90 % size
    const fe = root.frameElement;
    const k = fe ? fe.getBoundingClientRect().width / (root.innerWidth || 1) : 1;
    if (k > 0 && k < 0.8) tip.style.transform = 'scale(' + Math.min(2.6, 0.9 / k) + ')';

    back.append(hole, tip);
    // the guide closes on any press (below); the Tour picker opens right after it
    const tourBtn = tip.querySelector('.dmg-tour');
    tourBtn.addEventListener('pointerdown', () => setTimeout(() => { if (root.DM.tour) root.DM.tour.open(); }, 0));
    document.body.appendChild(back);
    requestAnimationFrame(() => back.classList.add('show'));

    const close = () => {
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('keydown', close, true);
      back.classList.remove('show');
      setTimeout(() => back.remove(), 250);
    };
    // the click itself goes on: a click on a menu title opens that menu as the guide fades
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('keydown', close, true);
  }

  root.DM = root.DM || {};
  root.DM.guide = { show };
  if (seen()) return;
  if (registered()) setTimeout(show, 700);
  else root.addEventListener('dm-gate-done', () => setTimeout(show, 400), { once: true });
})(window);
