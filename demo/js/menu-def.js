(function (root) {
  const S = { separator: true };
  const L = (label, extra) => Object.assign({ label, action: 'screen' }, extra);
  const D = (label) => ({ label, disabled: true });
  const sepJoin = (labels) => labels.flatMap((l, i) => (i ? [S, L(l)] : [L(l)]));
  const menuDef = [
    { label: 'File', items: [
      L('Open', { action: 'open' }), L('Add Data'), L('Save As...'), S, L('Configuration'), S, L('Exit'),
    ] },
    { label: 'Edit', items: [
      L('Undo', { accel: 'Ctrl+Z' }), L('Redo', { accel: 'Ctrl+Y' }), S,
      L('Cut', { accel: 'Ctrl+X' }), L('Copy', { accel: 'Ctrl+C' }), S,
      L('Paste', { accel: 'Ctrl+V' }), L('Delete', { accel: 'Del' }), S,
      L('Select All', { accel: 'Ctrl+A' }),
    ] },
    { label: 'Tools', items: [
      L('Invert Color'), S, L('Dicom Composite'), S, L('Dicom Header Editor'), S,
      L('Gantry_Angle_Cal'), S, L('Collimator Angle Cal'), S, L('Image_Rotate'), S,
      L('Profile / PDD Comparison'), S, L('Save Profile to ASC'), S,
      D('RT Workspace'), L('Eclipse 로그 선량 재구성', { action: 'live:logrecon' }), L('CBCT 조직변화 선량', { action: 'live:cbct' }), S,
      L('Move PDD Data'),
    ] },
    { label: 'Machine QA', items: [
      L('Field Analysis'), S,
      L('Starshot Analysis', { action: 'live:starshot' }), S,
      L('Picket Fence Analysis', { action: 'live:pf' }), S,
      L('Winston-Lutz Analysis', { action: 'live:wl' }), S,
      L('Calibration(TRS-398)', { action: 'live:trs398' }), S,
      L('Electron TRS-398 Calibration'), S, L('Calibration(TG-51)'), S, L('Machine Log Analysis'), S,
      L('MPC Analyzer'), S, L('Gating QA'), S,
      L('Offset Output'), L('EPID Output Constancy / Wedge Factor'), S,
      L('3D EPID PDD Reconstruction'),
    ] },
    { label: 'Device QA', items: sepJoin([
      'MyQA Daily QA', 'BeamCheck(Raydose)', 'Beamcheckplus', 'Trajectory log QA', 'DosiCare Trajectory Analyzer',
    ]) },
    { label: 'Image QA', items: [
      { label: 'CT', items: [
        { label: 'ACR CT Phantom Analysis', items: [
          L('Module 1 (CT Number)'), L('Module 2 (Low Contrast)'), L('Module 3 (Uniformity)'), L('Module 4 (Resolution)'),
        ] },
        D('CT Water Phantom Analysis'),
        { label: 'CATPHAN Analysis', items: [
          L('Materials (CTP404)'), L('Uniformity (CTP486)'), L('Low Contrast (CTP515)'), L('Resolution (CTP528)'),
        ] },
        D('XVI CATPHAN Analysis'),
        D('Siemens OBI Analysis'),
        { label: 'Electron Density Analysis', items: [
          D('PTW Electron Density Phantom'), D('PTW RUBY Electron Density Insert'),
          L('Gammex 467 Phantom'), L('CIRS 062 Phantom'), L('Tomotherapy Cheese Materials Phantom'),
          L('Tomotherapy Cheese Resolution Phantom'), L('Tomotherapy Cheese Noise and Uniformity Phantom'),
        ] },
        D('GE Phantom Analysis'),
        D('Leeds Dental Phantom'),
      ] },
      { label: 'EPID', items: [
        L('PTW EPID QC Phantom'), D('QC-3 EPID Phantom'), L('Las Vegas EPID Phantom'), L('RIT EPID Phantom'),
      ] },
      { label: 'kV Imaging', items: [
        L('IBA Primus L Phantom'), D('PTW NORMI 4 Phantom'), L('Leeds TOR18 Phantom'), D('QCkV-1 Phantom'),
      ] },
      { label: 'Isocube Phantom', items: [
        D('Isocube Test 1: kV-MV Coincidence'), D('Isocube Test 2: CBCT'), D('Isocube Test 3: kV Collimation'),
        D('Isocube Test 4: MV Rad.- Light Coincidence'), D('Isocube 6 DOF Couch Test'),
      ] },
      { label: 'PentaGuide Phantom', items: [
        D('PentaGuide Test 1: DRR-MV-kV Coincidence'), D('PentaGuide Test 2: CBCT'),
      ] },
    ] },
    { label: 'Data Handling', items: [
      L('Smoothing...'), L('Ionization to Dose...'), L('Edit Curve...'), S,
      L('Toggle Crop'), S, L('Align Profiles'), S, L('Set Pixel Spacing'), S, L('Reset Smoothing'), S,
      L('Make Symmetric'), L('Move'), S, L('Resample...'), L('Rescale...'), S, L('CAX Correction...'),
    ] },
    { label: 'RTPS', items: sepJoin(['Transfer Data...', 'RTPS queue...', 'RTPS Setup...']) },
    { label: 'Reports', items: [
      L('Profile Analyze & Report(PDF)'), S, L('Auto PDD Report'), S,
      L('Photon PDD Report'), L('Electron PDD Report'), S, L('Total Report'), S,
      L('Period_Report_Window'), S, L('QA Trend & SPC'), S, L('DosiReport', { action: 'live:dosireport' }), S,
      L('AI Consult (지능형 장비 분석)', { action: 'live:consult' }),
    ] },
    // ESAPI: not in DosiMachine's own menu bar. Added for the lecture to demonstrate the Eclipse scripts (ESAPI)
    // written alongside it; each item opens a self-playing re-drawn window of one script.
    { label: 'ESAPI', items: [
      L('Portal Dosimetry QA Report (QAReportScript_v15)', { action: 'live:pdqa' }),
    ] },
    { label: 'Help', items: [L('About'), S, L('Demo Status')] },
  ];
  function menuPath(...labels) { return labels.join(' > '); }
  function menuLeaves() {
    const out = [];
    const walk = (items, prefix) => items.forEach((it) => {
      if (it.separator) return;
      if (it.items) walk(it.items, [...prefix, it.label]);
      else out.push({ path: menuPath(...prefix, it.label), item: it });
    });
    menuDef.forEach((m) => walk(m.items, [m.label]));
    return out;
  }
  const api = { menuDef, menuPath, menuLeaves };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.DM = root.DM || {}; Object.assign(root.DM, api); }
})(typeof window !== 'undefined' ? window : globalThis);
