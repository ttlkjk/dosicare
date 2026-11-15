/* Plan View bottom pane: the "Calculation Models" sub-view (main.py setup_calc_models_frame).
   The Plan View is a capture (screens/plan_view_body.png, 1707 x 890) whose bottom pane shows the Fields tab.
   Clicking Calculation Models on it (or on the Plan Check sub-view's tab row, shell.js) lays this replica over the
   bottom pane: the model table (4 rows as in the original) and the ECLIPSE CALCULATION card. Its
   "로그 선량 재구성..." opens the Eclipse log dose reconstruction window (js/windows/logrecon.js), like
   main.py open_log_recon. The other card buttons need Eclipse and only show the demo toast.
   Not in the original: the thin blue box (.dm-clickable) on 로그 선량 재구성... and the working tabs (presenter cue,
   the same one every clickable button in the demo has). */
(function (root) {
  'use strict';
  const DM = root.DM = root.DM || {};
  const PV_W = 1707, PV_H = 890, PANE = { x: 0, y: 671, w: 1247, h: 219 };
  const HIT = { x: 503, y: 673, w: 130, h: 22 };              // the capture's own Calculation Models tab
  const TABS = ['Fields', 'Dose', 'Dose Statistics', 'Plan Objectives', 'Optimization Objectives', 'Calculation Models', 'Plan Check'];
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const pct = (v, of) => (v / of * 100) + '%';
  const toast = (m) => { if (DM.shell && DM.shell.toast) DM.shell.toast(m); };
  let pane = null;

  function show(on) { if (pane) pane.classList.toggle('on', on); }

  function attach(planView) {
    if (!planView || planView.querySelector('.pv-cm')) return;
    const hit = el('div', 'pv-cm-hit dm-clickable');
    Object.assign(hit.style, { left: pct(HIT.x, PV_W), top: pct(HIT.y, PV_H), width: pct(HIT.w, PV_W), height: pct(HIT.h, PV_H) });
    hit.addEventListener('click', () => { const pc = planView.querySelector('.pv-pc'); if (pc) pc.classList.remove('on'); show(true); });

    pane = el('div', 'pv-cm');
    const tabs = el('div', 'pv-pc-tabs');
    TABS.forEach((t) => {
      const b = el('div', 'pv-pc-tab' + (t === 'Calculation Models' ? ' on' : t === 'Fields' || t === 'Plan Check' ? ' dm-clickable' : ''), t);
      b.addEventListener('click', () => {
        if (t === 'Fields') show(false);
        else if (t === 'Plan Check') { show(false); const h = planView.querySelector('.pv-pc-hit'); if (h) h.click(); }
        else if (t !== 'Calculation Models') toast();
      });
      tabs.appendChild(b);
    });
    const prof = el('div', 'pv-pc-tab prof', 'Dose Profiles'); prof.addEventListener('click', () => toast());
    tabs.appendChild(prof);

    const bodyEl = el('div', 'pv-cm-body');
    const tbl = el('div', 'pv-cm-tbl');
    const row = (cls, cells) => {
      const r = el('div', 'pv-cm-tr' + (cls ? ' ' + cls : ''));
      ['task', 'name', 'ver', 'grid', 'mod'].forEach((k, i) => { const c = el('span', k); if (cells[i] instanceof Node) c.appendChild(cells[i]); else c.textContent = cells[i]; r.appendChild(c); });
      tbl.appendChild(r);
    };
    const combo = (txt, w) => { const c = el('div', 'pv-cm-combo', txt); if (w) c.style.width = w + 'px'; return c; };
    row('h', ['Calculation Task', 'Model Name', 'Version', 'Grid Size [mm]', 'Modality']);
    row('', ['Volume Dose', combo('Anisotropic Analytical Algorithm (AAA)'), '15.6.06', combo('2.5', 70), 'Photons']);
    row('alt', ['Portal Dose', 'Portal Dose Image Prediction (PDIP)', '15.6.06', '1.0', 'Photons']);
    row('', ['Machine Model', 'TrueBeam TB-01 configuration', '2.4.1', 'N/A', 'General']);
    row('alt', ['MLC Parameters', 'Dose Dynamic MLC Configuration', '1.2.0', 'N/A', 'Photons']);
    tbl.querySelectorAll('.pv-cm-combo').forEach((c) => c.addEventListener('click', () => toast()));
    tbl.querySelectorAll('.pv-cm-tr .grid .pv-cm-combo').forEach((c) => { c.parentNode.style.display = 'flex'; c.parentNode.style.justifyContent = 'center'; });

    const card = el('div', 'pv-cm-card');
    const runB = el('div', 'run', 'Eclipse에서 계산');
    runB.addEventListener('click', () => toast('Eclipse가 연결된 PC에서만 동작합니다 · 시연: 로그 선량 재구성...'));
    const r2 = el('div', 'row2');
    const models = el('span', null, '모델 목록'); models.addEventListener('click', () => toast('Eclipse가 연결된 PC에서만 동작합니다'));
    const recon = el('span', 'acc dm-clickable', '로그 선량 재구성...');
    recon.addEventListener('click', () => { if (!(DM.win && DM.win.openLive && DM.win.openLive('logrecon', recon.getBoundingClientRect()))) toast(); });
    r2.append(models, recon);
    const reload = el('div', 'reload', 'Reload plan data from disk'); reload.addEventListener('click', () => toast());
    const desc = el('div', 'desc', 'Recalculates the loaded plan in Eclipse (ESAPI bridge) with the model and grid selected on the left and shows the result as the Recon dose. The bridge is set up under File > Configuration > Eclipse 연동.');
    card.append(el('h6', null, 'ECLIPSE CALCULATION'), runB, r2, reload, desc);
    bodyEl.append(tbl, card);
    pane.append(tabs, bodyEl);
    planView.append(hit, pane);

    const fit = () => {
      const sx = planView.clientWidth / PV_W, sy = planView.clientHeight / PV_H;
      pane.style.left = (PANE.x * sx) + 'px'; pane.style.top = (PANE.y * sy) + 'px';
      pane.style.transform = 'scale(' + sx + ',' + sy + ')';
    };
    if (root.ResizeObserver) new ResizeObserver(fit).observe(planView);
    fit();
  }

  DM.calcmodels = { attach, show };
  if (typeof document !== 'undefined' && document.querySelector) attach(document.querySelector('.dm-planview'));
})(typeof window !== 'undefined' ? window : globalThis);
