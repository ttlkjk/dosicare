/* Auto Tour - the parts without DOM: caption reading time, the scene runner and the script checks.
   Used by js/tour.js in the browser (DM.tourCore) and by the node tests. Not part of the original program.
   Spec: docs/superpowers/specs/2026-11-19-auto-tour-design.md */
(function (root) {
  const READ_BASE_MS = 1200, READ_PER_CHAR_MS = 70, READ_MAX_MS = 9000, MAX_CAPTION = 80;
  // actions a script line may carry in `do` (one per line); js/tour.js has one function per name
  const VIEWS = ['Image View', 'Profile View', 'Plan View'];   // the main window's view tabs (js/shell.js)
  const DO_KEYS = ['menu', 'click', 'tab', 'filter', 'openFile', 'press', 'point', 'why', 'close', 'step', 'view'];

  // how long a caption stays up when nothing else holds it (spaces are not counted)
  function readMs(text) {
    const n = String(text || '').replace(/\s/g, '').length;
    return n ? Math.min(READ_MAX_MS, READ_BASE_MS + READ_PER_CHAR_MS * n) : 0;
  }

  /* Plays scenes one after another. A scene always starts at its first line: pause + play, next and prev
     restart a scene, they never resume in the middle. Every play() gets a new session number; a run whose
     number is stale sees token.cancelled and stops. */
  class Runner {
    constructor({ scenes, runLine, reset, onState }) {
      this.scenes = scenes;
      this.runLine = runLine;
      this.reset = reset || (() => {});
      this.onState = onState || (() => {});
      this.index = 0;
      this.playing = false;
      this.done = false;
      this._session = 0;
    }
    get state() { return { index: this.index, count: this.scenes.length, playing: this.playing, done: this.done }; }
    _emit() { this.onState(this.state); }
    async play(from) {
      const my = ++this._session, self = this;
      const token = { get cancelled() { return self._session !== my; } };
      if (from != null) this.index = Math.max(0, Math.min(this.scenes.length - 1, from));
      this.playing = true; this.done = false;
      let jumped = true;                      // false once a scene is reached by playing through the one before
      for (;;) {
        const scene = this.scenes[this.index];
        this.reset(scene, jumped);
        this._emit();
        for (const line of scene.lines) {
          try { await this.runLine(line, token); }
          catch (e) { if (!(e && e.cancelled) && !token.cancelled) console.warn('tour: skipped line ' + line.id, e); }
          if (token.cancelled) return;
        }
        if (this.index >= this.scenes.length - 1) break;
        this.index += 1; jumped = false;
      }
      this.playing = false; this.done = true;
      this._emit();
    }
    pause() { if (!this.playing) return; this._session += 1; this.playing = false; this._emit(); }
    toggle() { return this.playing ? this.pause() : this.play(); }
    next() {
      if (this.index < this.scenes.length - 1) return this.play(this.index + 1);
      this._session += 1; this.playing = false; this.done = true; this._emit();
      return Promise.resolve();
    }
    prev() { return this.play(this.index - 1); }
    stop() { this._session += 1; this.playing = false; }
  }

  const playable = (chapters) => chapters.filter((c) => c.scenes && c.scenes.length);
  function nextChapter(chapters, id) {
    const p = playable(chapters), i = p.findIndex((c) => c.id === id);
    return i >= 0 && i < p.length - 1 ? p[i + 1] : null;
  }

  // known: { menus: Set of menu paths that have a submenu, openable: Set of leaf paths that open something, files: Set of names }
  function validate(tour, known) {
    const errs = [], chIds = new Set(), scIds = new Set(), lnIds = new Set();
    (tour.chapters || []).forEach((c) => {
      if (chIds.has(c.id)) errs.push('duplicate chapter id ' + c.id);
      chIds.add(c.id);
      if (!c.title) errs.push('chapter ' + c.id + ': no title');
      if (!c.desc) errs.push('chapter ' + c.id + ': no description');
      if (!(c.minutes > 0)) errs.push('chapter ' + c.id + ': minutes must be a positive number');
      (c.scenes || []).forEach((s) => {
        if (scIds.has(s.id)) errs.push('duplicate scene id ' + s.id);
        scIds.add(s.id);
        if (!s.lines || !s.lines.length) errs.push('scene ' + s.id + ': no lines');
        (s.lines || []).forEach((l) => {
          if (lnIds.has(l.id)) errs.push('duplicate line id ' + l.id);
          lnIds.add(l.id);
          if (!l.say) errs.push('line ' + l.id + ': no caption');
          else if (l.say.length > MAX_CAPTION) errs.push('line ' + l.id + ': caption longer than ' + MAX_CAPTION + ' characters');
          if (!l.do) return;
          const keys = Object.keys(l.do);
          if (keys.length !== 1) { errs.push('line ' + l.id + ': exactly one action expected'); return; }
          const k = keys[0], v = l.do[k];
          if (!DO_KEYS.includes(k)) errs.push('line ' + l.id + ': unknown action ' + k);
          else if (k === 'click' && !known.openable.has(v)) errs.push('line ' + l.id + ': click path does not open anything: ' + v);
          else if (k === 'menu' && !known.menus.has(v)) errs.push('line ' + l.id + ': menu path not found: ' + v);
          else if (k === 'openFile' && !known.files.has(v)) errs.push('line ' + l.id + ': file not in the Open dialog: ' + v);
          else if (k === 'view' && !VIEWS.includes(v)) errs.push('line ' + l.id + ': unknown view ' + v);
          else if (k === 'step' && v !== 'end' && !(Number.isInteger(v) && v > 0)) errs.push('line ' + l.id + ': step must be a positive number or end: ' + v);
        });
      });
    });
    return errs;
  }

  const api = { readMs, Runner, playable, nextChapter, validate, DO_KEYS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.DM = root.DM || {}; root.DM.tourCore = api; }
})(typeof window !== 'undefined' ? window : globalThis);
