/* DosiMachine replica - Machine QA > Offset Output ("EPID Offset Calculator - PRO", epid_offset_calculator.py).
   Layout follows OffsetApp: header (title, subtitle, PDF Report), "DICOM 영상 지정" frame with one file row per
   gantry angle and the run button, then the result text box.
   The walkthrough (Space / auto-run) picks the four files one by one, then presses
   "▶ 설정한 영상 분석 시작"; the result text is the original's own (bake/bake_offset.py -> data/offset.js).
   Data: SYNTHETIC images made by bake_offset.py (no measured 20 x 20 set at four gantry angles exists among the
   sample data), so the table values come from made-up images - the calculation on them is the original's.
   Not in the original: the simplified file dialog and the slow scroll down to the tables after the run.
   PDF Report is not part of the demo. */
(function (root) {
  const DM = root.DM = root.DM || {};
  DM.windows = DM.windows || {};

  const W = 900, H = 750;
  const ANGLES = ['0', '90', '180', '270'];

  function h(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function mount(body) {
    const D = root.DM_DATA && root.DM_DATA.offset;
    body.classList.add('of-root');
    if (!D) { body.appendChild(h('div', null, 'Offset 데이터가 없습니다 (bake_offset.py).')); return { destroy() {} }; }
    let destroyed = false;
    const toast = () => DM.shell.toast('데모에서는 동작하지 않습니다');

    let player = null;
    const go = async () => {
      if (!player || destroyed) return;
      if (player.state.playing) { player.pause(); return; }
      if (player.index >= player.steps.length - 1) await player.reset();
      player.play();
    };

    /* ---------------- header ---------------- */
    const head = h('div', 'of-head');
    const pdf = h('div', 'of-pdf', 'PDF Report 📄'); pdf.addEventListener('click', toast);
    head.append(h('div', 'of-title', 'EPID Offset Analysis'), h('div', 'of-sub', '| 20x20 필드 DICOM 정밀 분석기'), pdf);

    /* ---------------- files frame ---------------- */
    const files = h('div', 'of-files');
    files.append(h('div', 'of-legend', ' DICOM 영상 지정 '),
      h('div', 'of-info', '각 Gantry 각도에 해당하는 DICOM 영상 파일을 개별적으로 지정해주세요. (0도는 필수입니다)'));
    const grid = h('div', 'of-grid');
    const ents = {}, btns = {};
    ANGLES.forEach((a) => {
      const e = h('div', 'of-ent', '');
      const b = h('div', 'of-btn', '파일 선택 📂'); b.addEventListener('click', go);
      grid.append(h('div', 'of-lab', 'Gantry ' + a + '°'), e, b);
      ents[a] = e; btns[a] = b;
    });
    const run = h('div', 'of-run', '▶ 설정한 영상 분석 시작'); run.addEventListener('click', go);
    files.append(grid, run);

    /* ---------------- result text ---------------- */
    const out = h('div', 'of-out');
    const text = h('div', 'of-text');
    out.appendChild(text);
    body.append(head, files, out);

    /* ---------------- file dialog (styles: css/epipdd.css .ep-dlg) ---------------- */
    let modal = null;
    const wait = (ms, token) => DM.anim.wait(ms, token);
    function press(b, token) {
      b.classList.add('of-press');
      return wait(240, token).finally(() => b.classList.remove('of-press'));
    }
    function fileDialog(angle, token) {
      return new Promise((resolve, reject) => {
        const veil = h('div', 'ep-veil');
        const w = 520, hh = 44 + ANGLES.length * 20 + 2 + 104;
        const box = h('div', 'ep-dlg');
        box.style.cssText = 'left:' + Math.round((W - w) / 2) + 'px;top:' + Math.round((H - hh) / 2) + 'px;width:' + w + 'px;height:' + hh + 'px;';
        box.appendChild(h('div', 'ep-dlg-bar', 'Gantry ' + angle + '도 DICOM 파일 선택'));
        const list = h('div', 'ep-files');
        ANGLES.forEach((a) => list.appendChild(h('div', a === angle ? 'sel' : '', D.names[a])));
        list.style.height = ANGLES.length * 20 + 'px';
        box.appendChild(list);
        const y = hh - 98;
        const lab = h('div', null, '파일 이름(N):'); lab.style.cssText = 'position:absolute;left:16px;top:' + (y + 2) + 'px;line-height:22px;';
        const f = h('div', 'ep-field'); f.style.cssText += 'left:112px;right:20px;top:' + y + 'px;'; f.appendChild(h('span', null, D.names[angle]));
        const t = h('div', 'ep-field ro', 'DICOM 파일 (*.dcm;*.ima)'); t.style.cssText += 'left:112px;right:20px;top:' + (y + 32) + 'px;';
        const ok = h('div', 'ep-dlg-btn pri', '열기(O)'); ok.style.cssText += 'right:116px;bottom:12px;';
        const cancel = h('div', 'ep-dlg-btn', '취소'); cancel.style.cssText += 'right:20px;bottom:12px;';
        box.append(lab, f, t, ok, cancel);
        veil.appendChild(box);
        body.appendChild(veil);
        let over = false;
        const done = async (cancelled) => {
          if (over) return; over = true;
          if (!cancelled) { ok.classList.add('ep-press'); await new Promise((r) => setTimeout(r, 180)); }
          veil.remove(); modal = null;
          if (cancelled) reject(DM.anim.CANCEL); else resolve();
        };
        ok.addEventListener('click', () => done(false));
        cancel.addEventListener('click', () => done(true));
        modal = { close: () => done(true) };
        wait(850, token).then(() => done(false), () => done(true));
      });
    }

    /* ---------------- walkthrough ---------------- */
    function scrollTo(target, ms, token) {
      const from = text.scrollTop;
      return DM.anim.tween(ms, (t) => { text.scrollTop = from + (target - from) * DM.anim.ease(t); }, token);
    }
    const tableTop = () => {
      const i = D.result.indexOf('  ■');
      return i < 0 ? 0 : Math.max(0, D.result.slice(0, i).split('\n').length - 2) * 17;
    };
    const steps = [
      { name: 'files', async run(token) {
        for (const a of ANGLES) {
          await press(btns[a], token);
          await fileDialog(a, token);
          ents[a].textContent = D.paths[a]; ents[a].classList.add('of-new');
          await wait(350, token);
          ents[a].classList.remove('of-new');
        }
        await wait(300, token);
      } },
      { name: 'run', async run(token) {
        await press(run, token);
        text.textContent = D.busy;
        await wait(900, token);
        text.textContent = D.result;
        text.scrollTop = 0;
        await wait(1500, token);
        await scrollTo(tableTop(), 1600, token);
        await wait(2500, token);
        await scrollTo(text.scrollHeight, 1600, token);
        await wait(600, token);
      } },
    ];
    function setFor(k) {
      if (modal) modal.close();
      ANGLES.forEach((a) => { ents[a].textContent = k >= 0 ? D.paths[a] : ''; ents[a].classList.remove('of-new'); });
      text.textContent = k >= 1 ? D.result : D.welcome;
      text.scrollTop = 0;
    }
    player = new DM.Player({ steps, render(k) { if (!destroyed) setFor(k); } });
    setFor(-1);

    return {
      player: { toggle: go, next: () => player.next(), prev: () => player.prev() },
      destroy() { destroyed = true; if (modal) modal.close(); player.destroy(); },
    };
  }

  DM.windows.offset = { title: 'EPID Offset Calculator - PRO', width: W, height: H, theme: 'offset', mount };
})(typeof window !== 'undefined' ? window : globalThis);
