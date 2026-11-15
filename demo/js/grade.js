(function (root) {
  function wl(measured, tols) {
    const statuses = [];
    for (const [metric, value] of Object.entries(measured)) {
      const tol = tols[metric];
      if (!tol || tol.enabled === false || value === null || value === undefined) continue;
      const v = tol.sides === 'two' ? Math.abs(value) : value;
      statuses.push(v > tol.fail ? 'FAIL' : 'PASS');
    }
    if (!statuses.length) return 'NOT GRADED';
    return statuses.includes('FAIL') ? 'FAIL' : 'PASS';
  }
  function pf(errors, tol) {
    let n = 0, pass = 0, max = 0;
    const failing = [];
    errors.forEach((row, p) => row.forEach((e, l) => {
      if (e === null || e === undefined) return;
      const a = Math.abs(e);
      n += 1;
      if (a <= tol) pass += 1; else failing.push([p, l]);
      if (a > max) max = a;
    }));
    return {
      status: n === 0 ? 'NOT GRADED' : (failing.length ? 'FAIL' : 'PASS'),
      max_abs: max,
      passing_pct: n ? (100 * pass) / n : 0,
      failing,
    };
  }
  function star(diameterMm, tolMm) { return diameterMm <= tolMm ? 'PASS' : 'FAIL'; }
  const api = { wl, pf, star };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.DM = root.DM || {}; root.DM.grade = api; }
})(typeof window !== 'undefined' ? window : globalThis);
