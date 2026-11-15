/* Plan View right panel: Plan Tree tab.
   The Plan View is a capture (screens/plan_view_body.png, 1707 x 890) whose right panel shows DVH View.
   Clicking Plan Tree on it lays the original Plan Tree panel (captured from DosiMachine with the same
   sample plan, same pixel scale: the tabs sit at the same x) over that panel. Clicking an MLC row selects
   it and opens the Beam's Eye View / MLC window of that field, as main.py on_plan_tree_click -> open_bev.
   The BEV windows are captures of bev_window.py right after it opens (CP 1). */
(function (root) {
  'use strict';
  const DM = root.DM = root.DM || {};
  const PV_W = 1707, PV_H = 890;
  const PANEL = { x: 1247, y: 0, w: 460, h: 668 };           // right notebook on the capture
  const TABS = [[0, 96], [96, 202], [202, 272], [272, 338]];  // Detailed Text, Analysis Table, DVH View, Plan Tree
  const TAB_H = 27;
  const ROW_H = 22, TREE_TOP = 27, TREE_W = 420;              // ttk.Treeview rowheight 22 (main.py:15653)
  const MLC_ROWS = [                                          // rows 10 and 12 of the tree
    { row: 9, img: 'screens/plan_tree_panel_mlc1.png', shot: 'screens/bev_2g180c0.png', key: 'Plan Tree > MLC 2 G180 C0' },
    { row: 11, img: 'screens/plan_tree_panel_mlc2.png', shot: 'screens/bev_field1.png', key: 'Plan Tree > MLC Field 1' },
  ];
  const PANEL_IMG = 'screens/plan_tree_panel.png';

  const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
  const pct = (v, of) => (v / of * 100) + '%';
  const place = (e, x, y, w, h, W, H) => Object.assign(e.style, { left: pct(x, W), top: pct(y, H), width: pct(w, W), height: pct(h, H) });
  const toast = () => { if (DM.shell && DM.shell.toast) DM.shell.toast(); };

  function openBev(m, origin) {
    const data = root.DM_DATA = root.DM_DATA || {};
    data.screens = data.screens || {};
    data.screens[m.key] = [{ file: m.shot, tab: null }];
    if (!(DM.win && DM.win.openScreen && DM.win.openScreen(m.key, origin, "Beam's Eye View / MLC"))) toast();
  }

  function attach(planView) {
    if (!planView || planView.querySelector('.pv-tree')) return;
    // hit area over the capture's own Plan Tree tab
    const hit = el('div', 'pv-tree-hit');
    place(hit, PANEL.x + TABS[3][0], 0, TABS[3][1] - TABS[3][0], TAB_H, PV_W, PV_H);

    const pane = el('div', 'pv-tree');
    place(pane, PANEL.x, PANEL.y, PANEL.w, PANEL.h, PV_W, PV_H);
    const img = el('img'); img.src = PANEL_IMG; img.alt = ''; img.draggable = false;
    pane.appendChild(img);
    const show = (on) => { pane.classList.toggle('on', on); if (on) img.src = PANEL_IMG; };
    hit.addEventListener('click', () => show(true));

    TABS.forEach(([x0, x1], i) => {
      if (i === 3) return;                                     // Plan Tree is the open tab
      const t = el('div', 'pv-tree-hit');
      place(t, x0, 0, x1 - x0, TAB_H, PANEL.w, PANEL.h);
      t.addEventListener('click', () => { if (i === 2) show(false); else toast(); });
      pane.appendChild(t);
    });
    MLC_ROWS.forEach((m) => {
      const r = el('div', 'pv-tree-hit');
      place(r, 0, TREE_TOP + m.row * ROW_H, TREE_W, ROW_H, PANEL.w, PANEL.h);
      r.addEventListener('click', () => { img.src = m.img; openBev(m, r.getBoundingClientRect()); });
      pane.appendChild(r);
    });
    planView.append(hit, pane);
  }

  DM.plantree = { attach };
  if (typeof document !== 'undefined' && document.querySelector) attach(document.querySelector('.dm-planview'));
})(typeof window !== 'undefined' ? window : globalThis);
