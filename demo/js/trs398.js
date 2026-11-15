(function (root) {
  // TRS-398 Rev.1 Table 45 (a, b of Eq. 34) - copied from DosiMachine Calibration_TRS398.py KQ_REV1_FITS
  const KQ_REV1_FITS = {
    'PR-06C': [1.06833, -0.08262], A12: [1.09783, -0.09544], CC13: [1.11441, -0.10260],
    'FC65-G': [1.09752, -0.09642], 'FC65-P': [1.12374, -0.10784], 2571: [1.08918, -0.09222],
    30010: [1.12594, -0.10740], 30011: [1.10850, -0.10107], 30012: [1.12442, -0.10415],
    30013: [1.18273, -0.13256],
  };
  const TPR_MIN = 0.56, TPR_MAX = 0.82;              // Rev.1 Table 16
  const CAVITY_LENGTH_CM = { 2571: 2.41, 30010: 2.30, 30012: 2.30, 30013: 2.30, CC13: 0.58, 'FC65-G': 2.30, 'FC65-P': 2.30 };
  // TRS-398 Table 4.VII, pulsed beams - same as DosiMachine KS_FITS
  const KS_FITS = [[2.0, [2.337, -3.636, 2.299]], [2.5, [1.474, -1.587, 1.114]], [3.0, [1.198, -0.875, 0.677]],
                   [3.5, [1.080, -0.542, 0.463]], [4.0, [1.022, -0.363, 0.341]], [5.0, [0.975, -0.188, 0.214]]];

  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const kqRev1 = (chamber, tpr) => {
    const [a, b] = KQ_REV1_FITS[chamber];
    return (1 + Math.exp((a - 0.57) / b)) / (1 + Math.exp((a - tpr) / b));
  };
  const kvolGeneric = (tpr, lengthCm, sddCm) => 1 + (0.0062 * tpr - 0.0036) * Math.pow(100 / sddCm, 2) * lengthCm * lengthCm;

  function calculate(x) {
    if (!x.mRef || !x.mRef.length) throw new Error('기준 전압 읽음값을 하나 이상 넣어 주세요.');
    const mRef = mean(x.mRef);
    if (mRef === 0) throw new Error('기준 전압 읽음값 평균이 0입니다.');
    if (!(x.vRed > 0 && x.vRed < x.vRef)) throw new Error('낮은 전압(V2)은 0보다 크고 V1보다 작아야 합니다.');
    if (!(x.chamber in KQ_REV1_FITS)) throw new Error(`챔버 '${x.chamber}'는 TRS-398 Rev.1 kQ 표에 없습니다.`);
    if (!(x.tpr >= TPR_MIN && x.tpr <= TPR_MAX)) throw new Error(`TPR20,10 = ${x.tpr}는 Rev.1 표 범위(${TPR_MIN}~${TPR_MAX}) 밖입니다.`);

    const c_tp = ((273.15 + x.temp) / (273.15 + x.calTemp)) * (x.calPress / x.press);
    const c_pol = x.mOpp && x.mOpp.length ? (Math.abs(mRef) + Math.abs(mean(x.mOpp))) / (2 * Math.abs(mRef)) : 1.0;

    let c_ir = 1.0;
    if (x.mRed && x.mRed.length) {
      const ratioV = x.vRef / x.vRed;
      const mRed = mean(x.mRed);
      if (mRed === 0) throw new Error('낮은 전압 읽음값 평균이 0입니다.');
      const ratioM = Math.abs(mRef) / Math.abs(mRed);
      const fit = KS_FITS.find(([rv]) => Math.abs(ratioV - rv) < 0.15);
      if (!fit) throw new Error(`V1/V2 = ${ratioV.toFixed(2)}는 TRS-398 표 4.VII(2.0, 2.5, 3.0, 3.5, 4.0, 5.0)에 없습니다.`);
      const [a0, a1, a2] = fit[1];
      c_ir = ratioM > 1.0 ? a0 + a1 * ratioM + a2 * ratioM * ratioM : 1.0;
    }

    let m_q = Math.abs(mRef) * c_tp * c_pol * c_ir * x.kelec;
    const kq = kqRev1(x.chamber, x.tpr);
    let k_vol = 1.0;
    if (x.energy.includes('FFF')) {
      const length = CAVITY_LENGTH_CM[x.chamber];
      if (length === undefined) throw new Error(`Rev.1 표 4에 '${x.chamber}'의 공동 길이가 없어 k_vol을 계산할 수 없습니다.`);
      const sdd = x.setup === 'SSD' ? 100 + x.depth : 100;
      k_vol = kvolGeneric(x.tpr, length, sdd);
    }
    m_q *= k_vol;

    const dose_mu_zref = (m_q / x.mu) * x.ndw * kq;
    let dose_mu_zmax = null;
    if (x.setup === 'SSD') dose_mu_zmax = dose_mu_zref / (x.pdd / 100);
    else if (x.tmr) dose_mu_zmax = dose_mu_zref / x.tmr;

    let error_pct = null;
    if (dose_mu_zmax !== null) {
      const targetGy = x.mu * x.target * 0.01;
      error_pct = ((dose_mu_zmax * x.mu - targetGy) / targetGy) * 100;
    }
    return { c_tp, c_pol, c_ir, kq, k_vol, m_ref: mRef, m_q, dose_mu_zref, dose_mu_zmax, error_pct };
  }

  const api = {
    calculate,
    CHAMBERS: Object.keys(KQ_REV1_FITS),
    ENERGIES: ['6MV', '6FFF', '10MV', '10FFF', '15MV'],
    VOLTAGE_PAIRS: [[300, 150], [300, 100], [400, 100], [500, 100]],
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.DM = root.DM || {}; root.DM.trs398 = api; }
})(typeof window !== 'undefined' ? window : globalThis);
