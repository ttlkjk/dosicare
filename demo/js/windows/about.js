/* Help > About replica (main.py show_help, "About DosiMachine"), clickable like the original.
   Left: "Key Features" list; right: "Feature Details" = a 450 x 600 preview + the feature's long text.
   The list and the texts are the original's own (features_data in main.py), baked by bake/bake_about.py into
   data/about.js, so they follow the main program when it is re-baked (01-69 on 2026-11-17).
   Preview, as in the original: assets/<number>.png when the program has one (copied, a few screenshots redacted by the
   bake script), otherwise the drawn gear picture. The original's other source - the newest report PDF on the PC - is
   left out on purpose (a hospital's real report); feature 01 keeps the report preview from the old About capture.
   Up / Down move through the list (like the Tk listbox). Sizes are the original's logical px (Tk scaling 1.333). */
(function (root) {
  const DM = root.DM = root.DM || {};
  DM.windows = DM.windows || {};

  const W = 1707, H = 996;
  const h = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  // the original's fallback picture (get_diagram_image, drawn with PIL on 450 x 600): grid, gear, label
  function gearSvg() {
    let s = '<svg viewBox="0 0 450 600" width="450" height="600" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="450" height="600" fill="#FBFCFC"/>';
    for (let x = 30; x < 450; x += 30) s += '<line x1="' + x + '" y1="0" x2="' + x + '" y2="600" stroke="#F2F4F4"/>';
    for (let y = 30; y < 600; y += 30) s += '<line x1="0" y1="' + y + '" x2="450" y2="' + y + '" stroke="#F2F4F4"/>';
    const cx = 225, cy = 300;
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="80" fill="none" stroke="#1A5276" stroke-width="6"/>';
    for (let a = 0; a < 360; a += 30) {
      const r = a * Math.PI / 180, c = Math.cos(r), n = Math.sin(r);
      s += '<line x1="' + (cx + 80 * c).toFixed(1) + '" y1="' + (cy + 80 * n).toFixed(1) + '" x2="' + (cx + 105 * c).toFixed(1) +
        '" y2="' + (cy + 105 * n).toFixed(1) + '" stroke="#1A5276" stroke-width="10"/>';
    }
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="35" fill="#FBFCFC" stroke="#1A5276" stroke-width="3"/>' +
      '<text x="160" y="110" font-family="Segoe UI, sans-serif" font-size="11" fill="#1A5276">DosiMachine V3</text></svg>';
    return s;
  }

  function mount(body) {
    const D = (root.DM_DATA && root.DM_DATA.about) || { features: [] };
    const F = D.features;
    body.classList.add('ab-root');

    const head = h('div', 'ab-head');
    head.append(h('div', 'ab-title', 'DosiMachine V3'), h('div', 'ab-sub', 'Medical Physics QA Solution  |  Version 3.0'));

    const main = h('div', 'ab-body');
    const left = h('fieldset', 'ab-panel ab-left'); left.append(h('legend', null, ' Key Features '));
    const list = h('div', 'ab-list'); list.tabIndex = 0;
    const rows = F.map((f, i) => {
      const r = h('div', 'ab-row', ' ' + f.key);
      r.addEventListener('mousedown', () => { select(i); list.focus(); });
      list.appendChild(r);
      return r;
    });
    left.appendChild(list);

    const right = h('fieldset', 'ab-panel ab-right'); right.append(h('legend', null, ' Feature Details '));
    const box = h('div', 'ab-box');
    const pic = h('div', 'ab-pic');
    const text = h('div', 'ab-text');
    box.append(pic, text);
    right.appendChild(box);
    main.append(left, right);

    const foot = h('div', 'ab-foot');
    const close = h('button', 'ab-close', 'Close');
    close.addEventListener('click', () => DM.win && DM.win.close && DM.win.close());
    foot.appendChild(close);
    body.append(head, main, foot);

    let idx = -1;
    function select(i) {
      if (!F.length) return;
      i = Math.max(0, Math.min(F.length - 1, i));
      if (i === idx) return;
      if (idx >= 0) rows[idx].classList.remove('on');
      idx = i;
      rows[i].classList.add('on');
      // keep the selected row in view (Tk listbox .see)
      const r = rows[i], top = r.offsetTop, bottom = top + r.offsetHeight;
      if (top < list.scrollTop) list.scrollTop = top;
      else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
      const f = F[i];
      pic.innerHTML = '';
      if (f.img) { const im = h('img'); im.src = f.img; im.alt = ''; im.draggable = false; pic.appendChild(im); }
      else pic.innerHTML = gearSvg();
      text.innerHTML = '';
      f.text.split('\n').forEach((line) => text.appendChild(h('div', line.trim() ? 'ab-line' : 'ab-line ab-blank', line)));
      text.scrollTop = 0;
    }
    function onKey(e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); e.stopPropagation();
        select(idx + (e.key === 'ArrowDown' ? 1 : -1));
      }
    }
    list.addEventListener('keydown', onKey);
    select(0);
    setTimeout(() => list.focus(), 0);
    return { destroy() { list.removeEventListener('keydown', onKey); } };
  }

  DM.windows.about = { title: 'About DosiMachine', width: W, height: H, theme: 'about', mount };
})(typeof window !== 'undefined' ? window : globalThis);
