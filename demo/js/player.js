(function (root) {
  class Player {
    constructor({ steps, render, onChange }) {
      this.steps = steps;
      this.render = render;
      this.onChange = onChange || (() => {});
      this.index = -1;
      this.playing = false;
      this.busy = null;          // { token, promise }
      this.destroyed = false;
      this._session = 0;         // bumped by pause(); stale play loops exit
    }
    get state() { return { index: this.index, playing: this.playing, busy: !!this.busy }; }
    _emit() { this.onChange(this.state); }
    _run(i) {
      const token = { cancelled: false };
      let finished = false;      // true if the step settled before busy was assigned (sync throw)
      const promise = (async () => {
        let failed = false;
        try {
          try { await this.steps[i].run(token); }
          catch (e) { if (!(e && e.cancelled)) { failed = true; console.error(e); } }
          if (this.destroyed) return;
          if (failed) { this.pause(); return; }  // stop playback; play() loop must not retry
          if (token.cancelled) this.render(i);
          if (this.busy && this.busy.token === token) this.busy = null;
          this.index = i;
          this._emit();
        } finally {
          finished = true;
          if (this.busy && this.busy.token === token) { this.busy = null; if (!this.destroyed) this._emit(); }
        }
      })();
      if (!finished) { this.busy = { token, promise }; this._emit(); }
      return promise;
    }
    async _settle() {
      if (this.busy) { this.busy.token.cancelled = true; await this.busy.promise; }
    }
    async play() {
      if (this.playing) return;
      this.playing = true;
      const sid = ++this._session;
      this._emit();
      await this._settle();
      while (this.playing && !this.destroyed && this._session === sid && this.index < this.steps.length - 1) await this._run(this.index + 1);
      if (this._session === sid) this.playing = false;
      this._emit();
    }
    pause() {
      this.playing = false;
      this._session += 1;
      if (this.busy) this.busy.token.cancelled = true;
      this._emit();
    }
    toggle() { return this.playing ? this.pause() : this.play(); }
    async next() {
      if (this.busy) { this.pause(); await this._settle(); return; }
      if (this.index < this.steps.length - 1) await this._run(this.index + 1);
    }
    async prev() {
      this.pause();
      await this._settle();
      this.index = Math.max(-1, this.index - 1);
      this.render(this.index);
      this._emit();
    }
    async reset() {
      this.pause();
      await this._settle();
      this.index = -1;
      this.render(-1);
      this._emit();
    }
    destroy() { this.destroyed = true; this.playing = false; if (this.busy) this.busy.token.cancelled = true; this.onChange = () => {}; }
  }
  if (typeof module === 'object' && module.exports) module.exports = { Player };
  else { root.DM = root.DM || {}; root.DM.Player = Player; }
})(typeof window !== 'undefined' ? window : globalThis);
