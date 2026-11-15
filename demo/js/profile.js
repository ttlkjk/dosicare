/* Profile helpers: one row / one column of the baked field grid, and PNG-pixel to grid-cell mapping. */
(function (root) {
  const axis = (n, step) => Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * step);
  function row(grid, y) {
    const r = Math.max(0, Math.min(grid.h - 1, Math.round(y)));
    return { x_mm: axis(grid.w, grid.mm_per_px), v: grid.data.slice(r * grid.w, (r + 1) * grid.w) };
  }
  function col(grid, x) {
    const c = Math.max(0, Math.min(grid.w - 1, Math.round(x)));
    const v = [];
    for (let r = 0; r < grid.h; r += 1) v.push(grid.data[r * grid.w + c]);
    return { x_mm: axis(grid.h, grid.mm_per_px), v };
  }
  function toGrid(grid, png, px, py) {
    const clamp = (v, n) => Math.max(0, Math.min(n - 1, Math.floor(v)));
    return { gx: clamp((px / png.w) * grid.w, grid.w), gy: clamp((py / png.h) * grid.h, grid.h) };
  }
  /* Linear interpolation of v at position t on a rising x axis. */
  function at(x, v, t) {
    if (t <= x[0]) return v[0];
    for (let i = 1; i < x.length; i += 1) {
      if (t <= x[i]) return v[i - 1] + (v[i] - v[i - 1]) * (t - x[i - 1]) / (x[i] - x[i - 1]);
    }
    return v[v.length - 1];
  }

  /* Field analysis of one profile, "*Varian" protocol (the one DosiMachine's beam-data table shows).
     Field edges = 50 % of the profile maximum; the evaluation region = central 80 % of that width.
     Flatness = (Dmax - Dmin) / (Dmax + Dmin) x 100 in the region.
     Symmetry = max |D(c + d) - D(c - d)| / D(c) x 100 in the region, mirrored about the field centre c,
     with D(c) the mean over c +- 5 mm (the field sample has a small marker dot on the axis).
     Returns null when the profile holds no whole field (peak below minPeak, or an edge outside the image). */
  function analyze(x, v, minPeak) {
    let peak = -Infinity;
    for (let i = 0; i < v.length; i += 1) if (v[i] > peak) peak = v[i];
    if (!(peak > 0) || peak < (minPeak || 0)) return null;
    const half = peak / 2;
    let li = -1, ri = -1;
    for (let i = 1; i < v.length; i += 1) if (v[i - 1] < half && v[i] >= half) { li = i; break; }
    for (let i = v.length - 1; i > 0; i -= 1) if (v[i] < half && v[i - 1] >= half) { ri = i; break; }
    if (li < 0 || ri < 0 || ri <= li) return null;
    const cross = (a, b) => x[a] + (half - v[a]) * (x[b] - x[a]) / (v[b] - v[a]);
    const left = cross(li - 1, li), right = cross(ri - 1, ri);
    const width = right - left, center = (left + right) / 2;
    const lo = center - 0.4 * width, hi = center + 0.4 * width;
    let mx = -Infinity, mn = Infinity, sum = 0, n = 0;
    for (let i = 0; i < x.length; i += 1) {
      if (x[i] >= lo && x[i] <= hi) { if (v[i] > mx) mx = v[i]; if (v[i] < mn) mn = v[i]; }
      if (Math.abs(x[i] - center) <= 5) { sum += v[i]; n += 1; }
    }
    const dc = n ? sum / n : at(x, v, center);
    const step = Math.abs(x[1] - x[0]) || 1;
    let sym = 0;
    for (let d = 0; d <= 0.4 * width; d += step) sym = Math.max(sym, Math.abs(at(x, v, center + d) - at(x, v, center - d)));
    return {
      left, right, width, center, lo, hi,
      flatness: mx + mn > 0 ? (mx - mn) / (mx + mn) * 100 : 0,
      symmetry: dc > 0 ? sym / dc * 100 : 0,
    };
  }

  const api = { row, col, toGrid, analyze };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.DM = root.DM || {}; root.DM.profile = api; }
})(typeof window !== 'undefined' ? window : globalThis);
