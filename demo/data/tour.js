/* Auto Tour script - not part of the original program. Chapter -> scene -> line; a line is a caption (`say`) and at
   most one action (`do`). js/tour.js plays it, js/tour-core.js validate() checks it (tests/tour-script.test.js).
   A scene starts on an empty stage (menus, windows and dialogs closed) unless it has keep: true and is reached by
   playing through the scene before it. Line ids are unique: the voice file of a line is assets/tour/<id>.mp3 (bake/make_tour_audio.py); a line's
   optional `speak` is what the voice reads instead of `say` (letters the voice would read badly).
   Captions say only what the demo shows. Do not write the DICOM file extension in a caption (bake/check_privacy.py).
   Chapters with scenes: [] are listed in the picker as "준비 중". `step: n` plays a self-playing window up to its
   step n and `step: 'end'` to its end (js/tour.js ACT.step); `view` presses a main-window view tab. A scene with
   `view` makes sure that view tab is showing before it starts (so jumping into it with prev/next works). */
window.DM_DATA = window.DM_DATA || {};
window.DM_DATA.tour = { chapters: [
  { id: 'why', title: 'Why DosiMachine', desc: '어떤 프로그램인지 8가지로 소개', minutes: 3, scenes: [
    { id: 'why-open', lines: [
      { id: 'why-open-1', say: 'DosiMachine이 어떤 프로그램인지 먼저 소개합니다. 첫 화면의 Why DosiMachine 버튼을 누릅니다.', do: { press: '.dm-why-badge' } },
      { id: 'why-open-2', say: '치료 장비의 QA 영상과 측정 장비의 파일을 한 프로그램에서 읽어 분석합니다.' },
      { id: 'why-open-3', say: 'Machine QA 13가지, Image QA 35가지, Device QA 도구 5가지가 들어 있습니다.', do: { point: '.why-stats' } },
    ] },
    { id: 'why-1', keep: true, lines: [
      { id: 'why-1-1', say: '첫째, 측정 데이터 통합입니다. 측정 장비가 저장한 파일을 형식 그대로 읽습니다.', do: { why: 1 } },
      { id: 'why-1-2', say: '장비 회사가 달라도 한 화면에서 비교하고 분석합니다.' },
    ] },
    { id: 'why-2', keep: true, lines: [
      { id: 'why-2-1', say: '둘째, Machine QA입니다. 영상 측정을 모두 EPID로 합니다. 필름이 필요 없습니다.', do: { why: 2 } },
      { id: 'why-2-2', say: '판정은 TG-142 허용치로 하고, 못 잰 값은 합격으로 치지 않고 따로 표시합니다.', speak: '판정은 티지 142 허용치로 하고, 못 잰 값은 합격으로 치지 않고 따로 표시합니다.' },
    ] },
    { id: 'why-3', keep: true, lines: [
      { id: 'why-3-1', say: '셋째, Eclipse의 플랜과 선량을 불러오고, 측정 장비의 데이터베이스를 바로 읽습니다.', do: { why: 3 } },
      { id: 'why-3-2', say: '로그 폴더에 새 파일이 생기면 알아서 읽어 들입니다.' },
    ] },
    { id: 'why-4', keep: true, lines: [
      { id: 'why-4-1', say: '넷째, Eclipse 스크립팅입니다. Eclipse 안에서 스크립트 한 번으로 QA 리포트를 만듭니다.', do: { why: 4 } },
    ] },
    { id: 'why-5', keep: true, lines: [
      { id: 'why-5-1', say: '다섯째, 쌓인 리포트 폴더를 AI에게 물어볼 수 있습니다.', do: { why: 5 } },
      { id: 'why-5-2', say: 'AI의 답은 참고용입니다. 판정은 원본 리포트와 대조해서 내립니다.' },
    ] },
    { id: 'why-6', keep: true, lines: [
      { id: 'why-6-1', say: '여섯째, QA 창마다 PDF 리포트를 남기고, 그 값을 월간 점검표 칸에 넣어 줍니다.', do: { why: 6 } },
      { id: 'why-6-2', say: 'Excel 점검표에는 칸마다 출처 PDF 링크가 남습니다.' },
    ] },
    { id: 'why-7', keep: true, lines: [
      { id: 'why-7-1', say: '일곱째, 3D 볼륨 Patient QA입니다. 같은 엔진, 같은 경로로 계산해 다른 오차를 없앱니다.', do: { why: 7 } },
      { id: 'why-7-2', say: '그러면 남는 차이는 3D 볼륨 변화에 따른 선량 변화뿐입니다.' },
    ] },
    { id: 'why-8', keep: true, lines: [
      { id: 'why-8-1', say: '여덟째, 장비별 허용치를 한 번 정하면 모든 QA 창의 기본값이 됩니다.', do: { why: 8 } },
      { id: 'why-8-2', say: '기관마다 다른 문서 양식도 PDF 출력 양식에 반영합니다.' },
    ] },
    { id: 'why-sum', keep: true, lines: [
      { id: 'why-sum-1', say: '정리하면, 흩어진 데이터를 한곳에 모으고, 정확하게 분석하고, 문서로 정리합니다.', do: { why: 9 } },
      { id: 'why-sum-2', say: '이어지는 Tour에서 하나씩 실제 화면으로 보여 드립니다.', do: { close: true } },
    ] },
  ] },

  { id: 'file', title: '파일 열기 · Data Handling · RTPS', desc: '여러 회사의 측정 파일을 그대로 열기', minutes: 3, scenes: [
    { id: 'file-open', lines: [
      { id: 'file-open-1', say: '측정 파일을 여는 것부터 봅니다. File 메뉴를 엽니다.', do: { menu: 'File' } },
      { id: 'file-open-2', say: 'Open을 누르면 파일을 고르는 창이 뜹니다.', do: { click: 'File > Open' } },
      { id: 'file-open-3', say: '아래 목록을 펼치면 읽을 수 있는 파일 종류가 보입니다.', do: { filter: true } },
      { id: 'file-open-4', say: 'DICOM 영상, TIFF, 그리고 IBA · PTW · Sun Nuclear 측정 파일까지 확장자 10가지입니다.' },
      { id: 'file-open-5', say: '목록을 닫고, 파일을 하나씩 열어 보겠습니다.', do: { filter: true } },
    ] },
    { id: 'file-asc', lines: [
      { id: 'file-asc-1', say: '도구 모음의 열기 버튼으로도 같은 창이 열립니다. 먼저 IBA의 asc 파일입니다.', speak: '도구 모음의 열기 버튼으로도 같은 창이 열립니다. 먼저 아이비에이의 에이에스씨 파일입니다.', do: { press: '.dm-toolbar .dm-tb-icon' } },
      { id: 'file-asc-2', say: '파일을 고르고 열기를 누릅니다.', do: { openFile: '6MV Profile.asc' } },
      { id: 'file-asc-3', say: '프로파일 8개가 한 번에 열렸습니다. 변환 없이 파일 그대로 읽습니다.', do: { point: '.dm-profpane' } },
      { id: 'file-asc-4', say: '열린 곡선은 오른쪽 Loaded Profiles 목록에 정리됩니다.', do: { point: '.dm-right' } },
    ] },
    { id: 'file-opab', lines: [
      { id: 'file-opab-1', say: '다음은 IBA myQA Accept의 opab 파일입니다.', speak: '다음은 아이비에이 마이큐에이 억셉트의 오팹 파일입니다.', do: { press: '.dm-toolbar .dm-tb-icon' } },
      { id: 'file-opab-2', say: '전자선 PDD 측정 파일을 엽니다.', do: { openFile: 'Electron_6 Cone_PDD.opab' } },
      { id: 'file-opab-3', say: '곡선 6개가 열렸습니다.', do: { point: '.dm-profpane' } },
    ] },
    { id: 'file-mcc', lines: [
      { id: 'file-mcc-1', say: 'PTW의 mcc 파일입니다.', speak: '피티더블유의 엠씨씨 파일입니다.', do: { press: '.dm-toolbar .dm-tb-icon' } },
      { id: 'file-mcc-2', say: '6 MV PDD 측정 파일을 엽니다.', do: { openFile: 'X06 OPEN 10X10 PDD WAT.mcc' } },
      { id: 'file-mcc-3', say: 'PDD 곡선 하나가 열렸습니다.', do: { point: '.dm-profpane' } },
    ] },
    { id: 'file-snc', lines: [
      { id: 'file-snc-1', say: 'Sun Nuclear의 snctxt 파일입니다.', speak: '선 뉴클리어의 에스엔씨 텍스트 파일입니다.', do: { press: '.dm-toolbar .dm-tb-icon' } },
      { id: 'file-snc-2', say: '3D SCANNER가 내보낸 파일을 그대로 엽니다.', do: { openFile: 'Photons.snctxt' } },
      { id: 'file-snc-3', say: '한 파일에 든 곡선 27개(PDD 3개, 프로파일 24개)가 모두 열렸습니다.', do: { point: '.dm-profpane' } },
    ] },
    { id: 'file-csv', lines: [
      { id: 'file-csv-1', say: '쉼표로 구분된 csv 값 파일도 엽니다.', speak: '쉼표로 구분된 씨에스브이 값 파일도 엽니다.', do: { press: '.dm-toolbar .dm-tb-icon' } },
      { id: 'file-csv-2', say: '6 MV 빔 데이터 파일을 엽니다.', do: { openFile: '6MV Beam Data.csv' } },
      { id: 'file-csv-3', say: '곡선 8개가 열렸습니다.', do: { point: '.dm-profpane' } },
    ] },
    { id: 'file-dcm', lines: [
      { id: 'file-dcm-1', say: '마지막으로 DICOM 영상입니다.', do: { press: '.dm-toolbar .dm-tb-icon' } },
      { id: 'file-dcm-2', say: '조사야 영상 파일을 엽니다.', do: { openFile: 'RI_field_sample.dcm' } },
      { id: 'file-dcm-3', say: '영상이 열렸습니다. 장비 회사가 달라도 한 프로그램에서 엽니다.' },
    ] },
    { id: 'dh-menu', lines: [
      { id: 'dh-menu-1', say: 'Data Handling 메뉴에는 연 곡선을 다듬는 기능이 모여 있습니다.', do: { menu: 'Data Handling' } },
      { id: 'dh-menu-2', say: '매끄럽게 하기, 이온화-선량 변환 등입니다. 여기부터 뜨는 창은 원본 프로그램의 캡처 화면입니다.' },
    ] },
    { id: 'dh-smooth', lines: [
      { id: 'dh-smooth-1', say: 'Smoothing은 측정 곡선의 잔떨림을 매끄럽게 다듬습니다.', do: { click: 'Data Handling > Smoothing...' } },
    ] },
    { id: 'dh-ion', lines: [
      { id: 'dh-ion-1', say: 'Ionization to Dose는 이온화 곡선을 선량 곡선으로 바꿉니다.', do: { click: 'Data Handling > Ionization to Dose...' } },
    ] },
    { id: 'dh-cax', lines: [
      { id: 'dh-cax-1', say: 'CAX Correction은 프로파일의 중심을 0에 맞춥니다.', do: { click: 'Data Handling > CAX Correction...' } },
    ] },
    { id: 'rtps-transfer', lines: [
      { id: 'rtps-transfer-1', say: 'RTPS 메뉴의 Transfer Data는 측정 데이터를 치료계획 장비로 넘길 파일로 저장합니다.', do: { click: 'RTPS > Transfer Data...' } },
      { id: 'rtps-transfer-2', say: '왼쪽에서 Eclipse 등 8가지 중 하나를 고릅니다. 어느 것을 골라도 같은 IBA ASCII 파일로 저장합니다.' },
    ] },
    { id: 'rtps-setup', lines: [
      { id: 'rtps-setup-1', say: 'RTPS Setup에서는 변환한 파일을 저장할 폴더와, 목록에 보일 RTPS 종류를 정합니다.', do: { click: 'RTPS > RTPS Setup...' } },
      { id: 'rtps-setup-2', say: '파일 열기와 데이터 다루기는 여기까지입니다.' },
    ] },
  ] },

  { id: 'mqa', title: 'Machine QA', desc: '장비 정확도 분석 13가지', minutes: 5, scenes: [
    { id: 'mqa-menu', lines: [
      { id: 'mqa-menu-1', say: 'Machine QA 메뉴에는 장비 정확도를 확인하는 기능 13가지가 있습니다.', do: { menu: 'Machine QA' } },
      { id: 'mqa-menu-2', say: '스스로 도는 창은 분석을 끝까지 돌리고, 나머지는 화면을 짧게 봅니다.' },
    ] },
    { id: 'mqa-wl', lines: [
      { id: 'mqa-wl-1', say: 'Winston-Lutz 분석입니다. EPID 영상으로 볼과 조사야 중심의 차이를 봅니다.', do: { click: 'Machine QA > Winston-Lutz Analysis' } },
      { id: 'mqa-wl-2', say: '영상마다 결과를 표에 채우고, 작은 영상 위에 중심을 표시합니다.', do: { step: 1 } },
      { id: 'mqa-wl-3', say: '각도별 차이를 막대 그래프로 보여 줍니다.', do: { step: 2 } },
      { id: 'mqa-wl-4', say: '통계 지표를 계산합니다.', do: { step: 3 } },
      { id: 'mqa-wl-5', say: '허용치와 비교해 최종 판정을 냅니다.', do: { step: 4 } },
    ] },
    { id: 'mqa-star', lines: [
      { id: 'mqa-star-1', say: 'Starshot 분석입니다. 여러 각도의 빔이 한 점에서 만나는지 봅니다.', do: { click: 'Machine QA > Starshot Analysis' } },
      { id: 'mqa-star-2', say: '여러 장의 영상을 하나로 합칩니다.', do: { step: 1 } },
      { id: 'mqa-star-3', say: '원을 따라 세기를 읽어 빔의 위치를 찾습니다.', do: { step: 2 } },
      { id: 'mqa-star-4', say: '영상 위에 빔 선과 각도를 그립니다.', do: { step: 3 } },
      { id: 'mqa-star-5', say: '빔 선이 지나는 가장 작은 원을 찾습니다.', do: { step: 4 } },
      { id: 'mqa-star-6', say: '결과 표와 판정이 나옵니다.', do: { step: 5 } },
    ] },
    { id: 'mqa-pf', lines: [
      { id: 'mqa-pf-1', say: 'Picket Fence 분석입니다. MLC 리프가 정해진 위치에 서는지 봅니다.', do: { click: 'Machine QA > Picket Fence Analysis' } },
      { id: 'mqa-pf-2', say: '영상에서 피켓 선을 찾습니다.', do: { step: 1 } },
      { id: 'mqa-pf-3', say: '리프 위치를 위에서 아래로 그립니다.', do: { step: 2 } },
      { id: 'mqa-pf-4', say: '리프마다 오차를 막대로 보여 줍니다.', do: { step: 3 } },
      { id: 'mqa-pf-5', say: '요약 숫자와 최종 결과가 나옵니다.', do: { step: 4 } },
    ] },
    { id: 'mqa-trs', lines: [
      { id: 'mqa-trs-1', say: 'TRS-398 광자 선량 교정입니다. 측정값과 조건을 넣고 계산합니다.', speak: '티알에스 398 광자 선량 교정입니다. 측정값과 조건을 넣고 계산합니다.', do: { click: 'Machine QA > Calibration(TRS-398)' } },
      { id: 'mqa-trs-2', say: 'Calculate를 누르면 계산 과정과 결과가 한 줄씩 나옵니다.', do: { step: 'end' } },
    ] },
    { id: 'mqa-ele', lines: [
      { id: 'mqa-ele-1', say: '전자선 TRS-398 교정 화면입니다. 여기부터 여섯 개는 원본 프로그램의 캡처입니다.', speak: '전자선 티알에스 398 교정 화면입니다. 여기부터 여섯 개는 원본 프로그램의 캡처입니다.', do: { click: 'Machine QA > Electron TRS-398 Calibration' } },
    ] },
    { id: 'mqa-tg51', lines: [
      { id: 'mqa-tg51-1', say: 'TG-51 교정도 있습니다. 측정값을 넣고 계산하면 결과 요약이 나옵니다.', speak: '티지 51 교정도 있습니다. 측정값을 넣고 계산하면 결과 요약이 나옵니다.', do: { click: 'Machine QA > Calibration(TG-51)' } },
    ] },
    { id: 'mqa-field', lines: [
      { id: 'mqa-field-1', say: 'Field Analysis는 조사야 크기, 대칭도, 평탄도를 분석합니다.', do: { click: 'Machine QA > Field Analysis' } },
    ] },
    { id: 'mqa-log', lines: [
      { id: 'mqa-log-1', say: 'Machine Log Analysis는 장비 로그로 MLC와 갠트리 오차를 판정합니다.', do: { click: 'Machine QA > Machine Log Analysis' } },
    ] },
    { id: 'mqa-mpc', lines: [
      { id: 'mqa-mpc-1', say: 'MPC Analyzer는 Varian MPC 결과를 모아 항목별로 판정합니다.', do: { click: 'Machine QA > MPC Analyzer' } },
    ] },
    { id: 'mqa-gating', lines: [
      { id: 'mqa-gating-1', say: 'Gating QA는 EPID 영상과 로그로 게이팅의 시간과 위치를 확인합니다.', do: { click: 'Machine QA > Gating QA' } },
      { id: 'mqa-gating-2', say: '첫 탭은 셋업을 설명하려고 따로 만든 강의용 쪽입니다.' },
      { id: 'mqa-gating-3', say: '판정 요약 캡처에서 네 가지 항목의 결과를 한눈에 봅니다.', do: { tab: '판정 요약' } },
    ] },
    { id: 'mqa-offset', lines: [
      { id: 'mqa-offset-1', say: 'Offset Output은 갠트리 네 방향의 EPID 영상으로 출력 차이를 계산합니다.', do: { click: 'Machine QA > Offset Output' } },
      { id: 'mqa-offset-2', say: '각도마다 영상 파일을 지정합니다.', do: { step: 1 } },
      { id: 'mqa-offset-3', say: '분석을 시작하면 결과가 표로 나옵니다.', do: { step: 2 } },
    ] },
    { id: 'mqa-epidout', lines: [
      { id: 'mqa-epidout-1', say: 'EPID 출력 일정성입니다. 기준 영상과 비교해 출력 변화를 봅니다.', do: { click: 'Machine QA > EPID Output Constancy / Wedge Factor' } },
      { id: 'mqa-epidout-2', say: '열린 조사야 영상을 추가합니다.', do: { step: 1 } },
      { id: 'mqa-epidout-3', say: '아직 기준이 없어서, 판정 없이 값만 보여 줍니다.', do: { step: 2 } },
      { id: 'mqa-epidout-4', say: '이 영상을 기준으로 정합니다.', do: { step: 3 } },
      { id: 'mqa-epidout-5', say: '다시 분석하면 기준과 비교해 판정합니다.', do: { step: 4 } },
    ] },
    { id: 'mqa-epipdd', lines: [
      { id: 'mqa-epipdd-1', say: '3D EPID PDD 재구성입니다. 깊이별 EPID 영상으로 PDD를 만듭니다.', do: { click: 'Machine QA > 3D EPID PDD Reconstruction' } },
      { id: 'mqa-epipdd-2', say: '깊이별 영상을 고릅니다. 이 시연의 영상은 합성한 샘플입니다.', do: { step: 1 } },
      { id: 'mqa-epipdd-3', say: '비교할 기준 PDD 파일을 불러옵니다.', do: { step: 2 } },
      { id: 'mqa-epipdd-4', say: '3D로 재구성해 등선량 면을 그립니다.', do: { step: 3 } },
      { id: 'mqa-epipdd-5', say: 'PDD를 IBA ASCII 파일로 내보내면, 그 곡선이 메인 화면에 열립니다.', do: { step: 4 } },
      { id: 'mqa-epipdd-6', say: 'Machine QA는 여기까지입니다.' },
    ] },
  ] },

  { id: 'dqa', title: 'Device QA', desc: '측정 장비 5가지의 기록 읽기', minutes: 1, scenes: [
    { id: 'dqa-menu', lines: [
      { id: 'dqa-menu-1', say: 'Device QA는 측정 장비가 쌓은 기록을 읽어 추세와 표로 보여 줍니다.', do: { menu: 'Device QA' } },
      { id: 'dqa-menu-2', say: '다섯 화면 모두 원본 프로그램의 캡처입니다.' },
    ] },
    { id: 'dqa-myqa', lines: [
      { id: 'dqa-myqa-1', say: 'MyQA Daily QA는 IBA MyQA Daily의 데이터베이스를 읽습니다.', speak: '마이큐에이 데일리 큐에이는 아이비에이 마이큐에이 데일리의 데이터베이스를 읽습니다.', do: { click: 'Device QA > MyQA Daily QA' } },
      { id: 'dqa-myqa-2', say: '출력, 에너지, 평탄도, 대칭도의 기준 대비 편차를 날짜별로 그립니다.' },
    ] },
    { id: 'dqa-bc', lines: [
      { id: 'dqa-bc-1', say: 'BeamCheck(RayDose)도 데이터베이스를 읽어 같은 방식으로 추세를 봅니다.', speak: '빔체크 레이도즈도 데이터베이스를 읽어 같은 방식으로 추세를 봅니다.', do: { click: 'Device QA > BeamCheck(Raydose)' } },
    ] },
    { id: 'dqa-bcp', lines: [
      { id: 'dqa-bcp-1', say: 'Beamcheckplus는 장비가 저장한 JSON 파일을 읽습니다.', speak: '빔체크 플러스는 장비가 저장한 제이슨 파일을 읽습니다.', do: { click: 'Device QA > Beamcheckplus' } },
    ] },
    { id: 'dqa-tlog', lines: [
      { id: 'dqa-tlog-1', say: 'Trajectory log QA는 TrueBeam 로그 폴더를 읽어 MLC 오차의 추세를 봅니다.', do: { click: 'Device QA > Trajectory log QA' } },
    ] },
    { id: 'dqa-tla', lines: [
      { id: 'dqa-tla-1', say: 'DosiCare Trajectory Analyzer는 로그를 치료와 QA로 나눠 정리합니다.', do: { click: 'Device QA > DosiCare Trajectory Analyzer' } },
      { id: 'dqa-tla-2', say: 'MLC 오차, 갠트리 오차, 빔 홀드 횟수를 한 줄에 함께 보여 줍니다.' },
    ] },
  ] },

  { id: 'iqa', title: 'Image QA', desc: '영상 팬텀 분석 35가지 중 대표 5가지', minutes: 2, scenes: [
    { id: 'iqa-menu', lines: [
      { id: 'iqa-menu-1', say: 'Image QA에는 CT, EPID, kV, Isocube, PentaGuide 팬텀 분석 35가지가 있습니다.', speak: '이미지 큐에이에는 씨티, 이피드, 케이브이, 아이소큐브, 펜타가이드 팬텀 분석 35가지가 있습니다.', do: { menu: 'Image QA > CT' } },
      { id: 'iqa-menu-2', say: 'CT 팬텀만 20가지입니다. 묶음마다 하나씩 열어 보겠습니다.', do: { menu: 'Image QA > CT > CATPHAN Analysis' } },
    ] },
    { id: 'iqa-ctp', lines: [
      { id: 'iqa-ctp-1', say: 'CATPHAN의 CTP404 모듈입니다. 재질별 CT 값을 분석합니다.', speak: '캣팬의 씨티피 404 모듈입니다. 재질별 씨티 값을 분석합니다.', do: { click: 'Image QA > CT > CATPHAN Analysis > Materials (CTP404)' } },
      { id: 'iqa-ctp-2', say: '영상을 불러오고 자동 분석하면 결과가 나옵니다.', do: { step: 'end' } },
    ] },
    { id: 'iqa-lv', lines: [
      { id: 'iqa-lv-1', say: 'EPID 영상의 화질을 보는 Las Vegas 팬텀입니다.', do: { click: 'Image QA > EPID > Las Vegas EPID Phantom' } },
      { id: 'iqa-lv-2', say: '같은 순서로 불러오고, 분석하고, 결과를 봅니다.', do: { step: 'end' } },
    ] },
    { id: 'iqa-tor', lines: [
      { id: 'iqa-tor-1', say: 'kV 영상의 Leeds TOR18 팬텀입니다.', speak: '케이브이 영상의 리즈 티오알 18 팬텀입니다.', do: { click: 'Image QA > kV Imaging > Leeds TOR18 Phantom' } },
      { id: 'iqa-tor-2', say: '분석이 끝나면 결과를 바로 확인합니다.', do: { step: 'end' } },
    ] },
    { id: 'iqa-iso', lines: [
      { id: 'iqa-iso-1', say: 'Isocube 시험 1은 kV와 MV 영상의 중심이 맞는지 봅니다.', speak: '아이소큐브 시험 1은 케이브이와 엠브이 영상의 중심이 맞는지 봅니다.', do: { click: 'Image QA > Isocube Phantom > Isocube Test 1: kV-MV Coincidence' } },
      { id: 'iqa-iso-2', say: 'MV 영상과 kV 영상을 하나씩 불러와 분석합니다.', speak: '엠브이 영상과 케이브이 영상을 하나씩 불러와 분석합니다.', do: { step: 'end' } },
    ] },
    { id: 'iqa-pg', lines: [
      { id: 'iqa-pg-1', say: 'PentaGuide 시험 1은 DRR을 기준으로 MV와 kV 영상의 중심 차이를 봅니다.', speak: '펜타가이드 시험 1은 디알알을 기준으로 엠브이와 케이브이 영상의 중심 차이를 봅니다.', do: { click: 'Image QA > PentaGuide Phantom > PentaGuide Test 1: DRR-MV-kV Coincidence' } },
      { id: 'iqa-pg-2', say: '영상 세 장을 불러와 분석합니다. Image QA는 여기까지입니다.', do: { step: 'end' } },
    ] },
  ] },

  { id: 'plan', title: 'Plan View · Plan Check', desc: '플랜을 열어 보고 자동으로 점검', minutes: 2, scenes: [
    { id: 'plan-view', lines: [
      { id: 'plan-view-1', say: '치료계획을 보는 Plan View입니다.', do: { view: 'Plan View' } },
      { id: 'plan-view-2', say: 'CT 위에 선량 분포와 구조물이 겹쳐 보이고, 오른쪽에 DVH가 있습니다.', do: { point: '.dm-planview' } },
      { id: 'plan-view-3', say: '이 화면은 원본 프로그램의 캡처라서, 일부 탭만 눌립니다.' },
    ] },
    { id: 'plan-tree', view: 'Plan View', lines: [
      { id: 'plan-tree-1', say: 'Plan Tree 탭에는 플랜의 빔과 MLC가 나무 모양으로 정리됩니다.', do: { press: '.dm-planview > .pv-tree-hit' } },
      { id: 'plan-tree-2', say: "MLC 줄을 누르면 그 빔의 Beam's Eye View가 열립니다.", speak: '엠엘씨 줄을 누르면 그 빔의 빔즈 아이 뷰가 열립니다.', do: { press: '.pv-tree div.pv-tree-hit:nth-of-type(4)' } },
    ] },
    { id: 'plan-check', view: 'Plan View', lines: [
      { id: 'plan-check-1', say: '아래 Plan Check 탭에서는 플랜을 기준표로 자동 점검합니다.', do: { press: '.pv-pc-hit' } },
      { id: 'plan-check-2', say: 'Open Report Window를 누르면 점검 보고서 창이 열립니다.', do: { press: '.pv-pc-bar .b.acc' } },
      { id: 'plan-check-3', say: '창을 열면 점검이 이미 끝나 있습니다.', do: { step: 1 } },
      { id: 'plan-check-4', say: '선량 제약마다 목표값과 한계값, 두 단계로 판정합니다.', do: { step: 2 } },
      { id: 'plan-check-5', say: 'DVH 위에 제약 지점을 찍고, Eclipse가 내보낸 DVH와도 비교합니다.', do: { step: 4 } },
      { id: 'plan-check-6', say: '구조물의 작은 조각, 구멍, 빠진 슬라이스를 찾습니다.', do: { step: 5 } },
      { id: 'plan-check-7', say: '빔과 처방을 점검하고, 기관 기준은 표에서 바로 고칩니다.', do: { step: 7 } },
      { id: 'plan-check-8', say: '충돌 예측은 아직 개발 중인 기능입니다.', do: { step: 8 } },
      { id: 'plan-check-9', say: '버튼 한 번으로 A4 PDF 리포트를 만듭니다.', do: { step: 9 } },
    ] },
  ] },

  { id: 'eclipse', title: 'Eclipse 연동 선량', desc: '로그 선량 재구성, CBCT 조직변화 선량', minutes: 3, scenes: [
    { id: 'ecl-lr', lines: [
      { id: 'ecl-lr-1', say: 'Eclipse 로그 선량 재구성입니다. 장비 로그대로 선량을 다시 계산합니다.', do: { click: 'Tools > Eclipse 로그 선량 재구성' } },
      { id: 'ecl-lr-2', say: 'Plan View에 열린 플랜을 그대로 가져옵니다.', do: { step: 1 } },
      { id: 'ecl-lr-3', say: 'Trajectory 로그를 읽어 빔과 짝을 짓습니다.', do: { step: 2 } },
      { id: 'ecl-lr-4', say: '로그의 MLC와 조리개 위치로 Eclipse가 다시 계산합니다.', do: { step: 3 } },
      { id: 'ecl-lr-5', say: '계산된 3D 선량을 받아옵니다.', do: { step: 4 } },
      { id: 'ecl-lr-6', say: '같은 엔진으로 계산한 계획 선량과 비교하면 100 % 통과입니다.', do: { step: 5 } },
      { id: 'ecl-lr-7', say: '임상 선량과 비교하면 93.5 %입니다. 차이는 엔진 버전 때문입니다.', do: { step: 6 } },
      { id: 'ecl-lr-8', say: '로그, Eclipse 재계산, 3D 비교로 정리합니다.', do: { step: 7 } },
    ] },
    { id: 'ecl-cb', lines: [
      { id: 'ecl-cb-1', say: 'CBCT 조직변화 선량입니다. 오늘 몸의 모양으로 선량을 다시 계산합니다.', do: { click: 'Tools > CBCT 조직변화 선량' } },
      { id: 'ecl-cb-2', say: 'Eclipse SmartAdapt로 오늘 CBCT를 계획 CT에 맞춰 변형합니다.', speak: '이클립스 스마트어댑트로 오늘 씨비씨티를 계획 씨티에 맞춰 변형합니다.', do: { step: 1 } },
      { id: 'ecl-cb-3', say: '변형한 CT 폴더에 빠진 슬라이스가 없는지 검사합니다.', do: { step: 2 } },
      { id: 'ecl-cb-4', say: '변형한 CT를 Eclipse로 보냅니다.', do: { step: 3 } },
      { id: 'ecl-cb-5', say: '같은 플랜을 변형한 CT 위에서 다시 계산합니다.', do: { step: 4 } },
      { id: 'ecl-cb-6', say: '계획 선량과 오늘 몸의 선량을 3D로 비교합니다. 감마와 구조물 표는 아직 예시 숫자입니다.', do: { step: 5 } },
      { id: 'ecl-cb-7', say: '같은 플랜에 몸만 오늘 것으로 바꿔 계산한 결과입니다. 화면에 예시라고 표시됩니다.', do: { step: 6 } },
    ] },
  ] },

  { id: 'reports', title: 'Reports + 설정', desc: '보고서 6가지와 리포트 폴더 설정', minutes: 2, scenes: [
    { id: 'rep-menu', lines: [
      { id: 'rep-menu-1', say: 'Reports 메뉴에는 분석 결과를 문서로 만드는 기능이 모여 있습니다.', do: { menu: 'Reports' } },
      { id: 'rep-menu-2', say: '여기서 보는 화면은 원본 프로그램의 캡처입니다.' },
    ] },
    { id: 'rep-profile', lines: [
      { id: 'rep-profile-1', say: '프로파일 분석 결과를 PDF 리포트로 만듭니다.', do: { click: 'Reports > Profile Analyze & Report(PDF)' } },
    ] },
    { id: 'rep-photon', lines: [
      { id: 'rep-photon-1', say: '광자 PDD 리포트입니다. dmax, D100, D200 같은 값을 표로 정리합니다.', speak: '광자 피디디 리포트입니다. 디맥스, 디 백, 디 이백 같은 값을 표로 정리합니다.', do: { click: 'Reports > Photon PDD Report' } },
    ] },
    { id: 'rep-electron', lines: [
      { id: 'rep-electron-1', say: '전자선 PDD 리포트도 같은 방식으로 만듭니다.', do: { click: 'Reports > Electron PDD Report' } },
    ] },
    { id: 'rep-total', lines: [
      { id: 'rep-total-1', say: 'Total Report는 여러 QA 리포트를 골라 한 권으로 합칩니다.', do: { click: 'Reports > Total Report' } },
    ] },
    { id: 'rep-period', lines: [
      { id: 'rep-period-1', say: 'Period Report는 리포트를 보면서 한글 절차서의 칸을 자동으로 채웁니다.', do: { click: 'Reports > Period_Report_Window' } },
    ] },
    { id: 'rep-trend', lines: [
      { id: 'rep-trend-1', say: 'QA Trend & SPC는 결과를 관리도로 그려, 허용치 안의 변화도 미리 봅니다.', speak: '큐에이 트렌드 앤 에스피씨는 결과를 관리도로 그려, 허용치 안의 변화도 미리 봅니다.', do: { click: 'Reports > QA Trend & SPC' } },
    ] },
    { id: 'rep-config', lines: [
      { id: 'rep-config-1', say: '설정은 File 메뉴의 Configuration에 있습니다.', do: { click: 'File > Configuration' } },
      { id: 'rep-config-2', say: '리포트 폴더 설정에서 QA마다 리포트를 저장할 폴더를 정합니다.', do: { tab: '리포트 폴더 설정' } },
      { id: 'rep-config-3', say: '루트 폴더 하나를 정하면 아래 폴더들이 자동으로 채워집니다.' },
      { id: 'rep-config-4', say: '허용오차 관리에서 장비별 허용치를 정하면 각 QA 창의 기본값이 됩니다.', do: { tab: '허용오차 관리 (TG-142)' } },
    ] },
  ] },

  { id: 'ai', title: 'DosiReport · AI Consult', desc: '점검표 자동 채우기와 AI 월간 리포트', minutes: 2, scenes: [
    { id: 'ai-dr', lines: [
      { id: 'ai-dr-1', say: 'DosiReport는 리포트의 값을 월간 점검표 칸에 자동으로 넣습니다.', do: { click: 'Reports > DosiReport' } },
      { id: 'ai-dr-2', say: '먼저 월간 점검표 시트를 엽니다.', do: { step: 1 } },
      { id: 'ai-dr-3', say: 'DosiMachine 리포트가 모인 폴더를 엽니다.', do: { step: 2 } },
      { id: 'ai-dr-4', say: '리포트를 고르면 리포트 값과 점검표 칸이 자동으로 짝지어집니다.', do: { step: 3 } },
      { id: 'ai-dr-5', say: '원본 PDF를 열어 어느 값인지 눈으로 대조할 수 있습니다.', do: { step: 4 } },
      { id: 'ai-dr-6', say: '미리보기에 적용하면 값이 점검표 칸에 들어갑니다.', do: { step: 5 } },
      { id: 'ai-dr-7', say: '노란 칸이 리포트에서 들어온 값입니다. 손으로 옮겨 적지 않습니다.', do: { step: 6 } },
    ] },
    { id: 'ai-ac', lines: [
      { id: 'ai-ac-1', say: 'AI Consult는 쌓인 리포트를 AI가 읽고 월간 리포트를 만듭니다.', do: { click: 'Reports > AI Consult (지능형 장비 분석)' } },
      { id: 'ai-ac-2', say: '먼저 쓸 AI 엔진을 설정에서 고릅니다.', do: { step: 1 } },
      { id: 'ai-ac-3', say: '기간 리포트 메뉴에서 월간 리포트를 고릅니다.', do: { step: 3 } },
      { id: 'ai-ac-4', say: '기간을 정하고 만들기를 누릅니다.', do: { step: 4 } },
      { id: 'ai-ac-5', say: 'AI가 리포트 폴더를 읽습니다. 실제로는 몇 분 걸리고, 시연은 빠르게 보여 줍니다.', do: { step: 5 } },
      { id: 'ai-ac-6', say: '점검표에 넣을 값과 넣지 못한 이유를 담은 PDF가 만들어집니다.', do: { step: 6 } },
      { id: 'ai-ac-7', say: '만들어진 PDF를 열어 확인합니다. AI의 답은 참고용입니다.', do: { step: 7 } },
      { id: 'ai-ac-8', say: 'DosiMachine Tour는 여기까지입니다. 이제 메뉴를 직접 눌러 보세요.', do: { close: true } },
    ] },
  ] },
] };
