/* Shared demo pieces of the two Eclipse windows (logrecon.js, cbct.js). Not part of DosiMachine:
   - eclipsePanel: a drawing of the Eclipse side (Tools > Scripts > the EMBridge plugin running a job). It is a
     schematic, labelled as such, not a copy of the Eclipse UI. The lines it prints are the plugin's own progress
     events and Eclipse's calc log from the real runs (result.json).
   - viewer: the Plan View images (axial / coronal / sagittal) baked from the real doses (bake/bake_eclipse.py). In
     DosiMachine these go to the main Plan View (Recon / Diff / Gamma); the demo shows them in a popup.
   - small DOM helpers. */
(function (root) {
  const DM = root.DM = root.DM || {};
  const h = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  function eclipsePanel(app, scripts) {
    const box = h('div', 'ec-ecl');
    const head = h('div', 'ec-ecl-head');
    const x = h('span', 'x', '×');
    head.append(h('b', null, 'Eclipse 15.6 (TBox)'), h('span', null, '시연용 그림 · 실제 Eclipse 화면이 아닙니다'), x);
    const menu = h('div', 'ec-ecl-menu');
    ['File', 'Edit', 'View', 'Insert', 'Planning', 'Tools', 'Window', 'Help'].forEach((t) => menu.appendChild(h('span', t === 'Tools' ? 'on' : null, t)));
    const body = h('div', 'ec-ecl-body');
    const sc = h('div', 'ec-ecl-scripts');
    sc.appendChild(h('h5', null, 'Tools > Scripts'));
    const lst = h('div', 'lst');
    const rows = scripts.map((s) => { const r = h('div', null, s[0]); if (s[1]) r.appendChild(h('small', null, s[1])); lst.appendChild(r); return r; });
    const run = h('span', 'ec-btn', 'Run'); const cl = h('span', 'ec-btn', 'Close');
    const btns = h('div', 'btns'); btns.append(run, cl);
    sc.append(lst, h('div', 'ec-small', '승인된 스크립트만 실행됩니다 (Script Approval)'), btns);
    const con = h('div', 'ec-ecl-con');
    const step = h('div', 'ec-ecl-step');
    const st = h('div', 't', '대기'); const bar = h('div', 'bar'); const fill = h('b'); bar.appendChild(fill);
    step.append(st, bar);
    const out = h('div', 'ec-ecl-out');
    con.append(step, out);
    body.append(sc, con);
    const foot = h('div', 'ec-ecl-foot', '');
    box.append(head, menu, body, foot);
    app.appendChild(box);
    return {
      el: box, run, rows, x,
      show(on) { box.classList.toggle('on', on); },
      reset(footText) { out.innerHTML = ''; st.textContent = '대기'; fill.style.width = '0'; rows.forEach((r) => r.classList.remove('sel')); foot.textContent = footText || ''; },
      select(i) { rows.forEach((r, j) => r.classList.toggle('sel', j === i)); },
      line(text, cls) { const d = h('div', cls || null, text); out.appendChild(d); while (out.scrollHeight > out.clientHeight + 2 && out.firstChild) out.removeChild(out.firstChild); },
      step(text, pct) { st.textContent = text; fill.style.width = pct + '%'; },
      foot(text) { foot.textContent = text; },
    };
  }

  const JET = 'linear-gradient(90deg,#00008f,#0000ff,#00ffff,#80ff80,#ffff00,#ff0000,#800000)';
  const BWR = 'linear-gradient(90deg,#0000ff,#ffffff,#ff0000)';
  const GAM = 'linear-gradient(90deg,#3fbf6a 0,#3fbf6a 50%,#f21a1a 50%,#f21a1a 100%)';

  function viewer(app, title) {
    const box = h('div', 'ec-view');
    const head = h('div', 'ec-view-head');
    const ttl = h('span', 'ttl', title);
    const tabsEl = h('span');
    const x = h('span', 'x', '×');
    head.append(ttl, tabsEl, x);
    const cells = h('div', 'ec-view-cells');
    const foot = h('div', 'ec-view-foot');
    const lg = h('div'); lg.style.display = 'flex'; lg.style.flexDirection = 'column'; lg.style.gap = '3px';
    const bar = h('div', 'bar'); const lgt = h('div', 'ec-small'); lg.append(bar, lgt);
    const txt = h('div', 'txt');
    foot.append(lg, txt);
    box.append(head, cells, foot);
    app.appendChild(box);
    x.addEventListener('click', () => box.classList.remove('on'));
    let tabs = [];
    return {
      el: box, x,
      show(on) { box.classList.toggle('on', on); },
      setTabs(names, active, onPick) {
        tabsEl.innerHTML = ''; tabs = names.map((n, i) => {
          const t = h('span', 'tab' + (i === active ? ' on' : ''), n); tabsEl.appendChild(t);
          t.style.marginRight = '4px';
          if (onPick) t.addEventListener('click', () => onPick(i));
          return t;
        });
      },
      tab(i) { return tabs[i]; },
      // views: { label: {ax,cor,sag} } (one or two rows); legend: 'jet' | 'bwr' | 'gamma'
      set(opts) {
        if (opts.title) ttl.textContent = opts.title;
        tabs.forEach((t, i) => t.classList.toggle('on', i === opts.tab));
        cells.innerHTML = '';
        const sets = opts.sets;
        ['ax', 'cor', 'sag'].forEach((v) => {
          const c = h('div', 'ec-view-cell' + (sets.length > 1 ? ' two' : ''));
          c.appendChild(h('span', 'lab', { ax: 'Axial', cor: 'Coronal', sag: 'Sagittal' }[v]));
          sets.forEach((s, k) => {
            const im = h('img'); im.src = 'data/' + s.img[v].file; im.alt = ''; im.draggable = false;
            if (sets.length > 1) { im.title = s.label; }
            c.appendChild(im);
            if (sets.length > 1 && v === 'ax') { const l = h('span', 'lab', s.label); l.style.top = k ? '51%' : '4px'; l.style.left = 'auto'; l.style.right = '6px'; c.appendChild(l); }
          });
          cells.appendChild(c);
        });
        bar.style.background = opts.legend === 'bwr' ? BWR : opts.legend === 'gamma' ? GAM : JET;
        lgt.textContent = opts.legendText || '';
        txt.innerHTML = '';
        txt.appendChild(document.createTextNode(opts.text || ''));
        if (opts.sub) txt.appendChild(h('small', null, opts.sub));
      },
    };
  }

  DM.eclui = { h, eclipsePanel, viewer };
})(typeof window !== 'undefined' ? window : globalThis);
