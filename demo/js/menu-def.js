(function (root) {
  const S = { separator: true };
  const L = (label, extra) => Object.assign({ label, action: 'screen' }, extra);
  const D = (label) => ({ label, disabled: true });
  const Q = (label, id) => L(label, { action: 'live:iq-' + id });   // Image QA live window
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
      L('Offset Output', { action: 'live:offset' }), L('EPID Output Constancy / Wedge Factor'), S,
      L('3D EPID PDD Reconstruction', { action: 'live:epipdd' }),
    ] },
    { label: 'Device QA', items: sepJoin([
      'MyQA Daily QA', 'BeamCheck(Raydose)', 'Beamcheckplus', 'Trajectory log QA', 'DosiCare Trajectory Analyzer',
    ]) },
    // Image QA: every item opens its self-playing window (js/windows/imgqa.js, grabs baked by bake/bake_imgqa.py).
    // PTW Electron Density / RUBY run on a synthetic phantom (no PTW image exists) and say so on screen.
    { label: 'Image QA', items: [
      { label: 'CT', items: [
        { label: 'ACR CT Phantom Analysis', items: [
          Q('Module 1 (CT Number)', 'acr1'), Q('Module 2 (Low Contrast)', 'acr2'), Q('Module 3 (Uniformity)', 'acr3'), Q('Module 4 (Resolution)', 'acr4'),
        ] },
        Q('CT Water Phantom Analysis', 'ctwater'),
        { label: 'CATPHAN Analysis', items: [
          Q('Materials (CTP404)', 'ctp404'), Q('Uniformity (CTP486)', 'ctp486'), Q('Low Contrast (CTP515)', 'ctp515'), Q('Resolution (CTP528)', 'ctp528'),
        ] },
        Q('XVI CATPHAN Analysis', 'xvi'),
        Q('Siemens OBI Analysis', 'siemens'),
        { label: 'Electron Density Analysis', items: [
          Q('PTW Electron Density Phantom', 'ptwed'), Q('PTW RUBY Electron Density Insert', 'ptwruby'),
          Q('Gammex 467 Phantom', 'gammex'), Q('CIRS 062 Phantom', 'cirs062'), Q('Tomotherapy Cheese Materials Phantom', 'cheese'),
          Q('Tomotherapy Cheese Resolution Phantom', 'cheeseres'), Q('Tomotherapy Cheese Noise and Uniformity Phantom', 'cheesenu'),
        ] },
        Q('GE Phantom Analysis', 'ge'),
        Q('Leeds Dental Phantom', 'leeds'),
      ] },
      { label: 'EPID', items: [
        Q('PTW EPID QC Phantom', 'ptwepid'), Q('QC-3 EPID Phantom', 'qc3'), Q('Las Vegas EPID Phantom', 'lasvegas'), Q('RIT EPID Phantom', 'ritepid'),
      ] },
      { label: 'kV Imaging', items: [
        Q('IBA Primus L Phantom', 'primusl'), Q('PTW NORMI 4 Phantom', 'normi4'), Q('Leeds TOR18 Phantom', 'tor18'), Q('QCkV-1 Phantom', 'qckv1'),
      ] },
      { label: 'Isocube Phantom', items: [
        Q('Isocube Test 1: kV-MV Coincidence', 'iso1'), Q('Isocube Test 2: CBCT', 'iso2'), Q('Isocube Test 3: kV Collimation', 'iso3'),
        Q('Isocube Test 4: MV Rad.- Light Coincidence', 'iso4'), Q('Isocube 6 DOF Couch Test', 'iso6dof'),
      ] },
      { label: 'PentaGuide Phantom', items: [
        Q('PentaGuide Test 1: DRR-MV-kV Coincidence', 'pg1'), Q('PentaGuide Test 2: CBCT', 'pg2'),
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
    // About: the original's clickable feature list (js/windows/about.js, baked from main.py by bake/bake_about.py)
    { label: 'Help', items: [L('About', { action: 'live:about' }), S, L('Demo Status')] },
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
