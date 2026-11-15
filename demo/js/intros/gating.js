/* Lecture-only first tab of Machine QA > Gating QA: how the QA is set up and measured.
   The original program has no such page; the wording and the drawing are a short version of its own HELP window
   (DosiMachine/GatingQA/help_window.py: "어떻게 재는가", draw_setup). Sample numbers (270°, 13.33 fps, 127 s,
   12 pulses) are the ones shown in the captures of the other tabs. */
(function (root) {
  const DM = root.DM = root.DM || {};

  // Lateral beam seen from the foot of the couch (same layout as draw_setup in the HELP window).
  const SETUP_SVG = `
<svg viewBox="0 0 580 300" class="gq-svg" text-anchor="middle" role="img" aria-label="Gating QA 셋업 그림">
  <defs>
    <marker id="gqAp" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#6C3FA0"/></marker>
    <marker id="gqAb" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#1A5276"/></marker>
    <marker id="gqAg" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#1B7F3B"/></marker>
  </defs>
  <rect x="170" y="14" width="160" height="36" rx="3" fill="#ece3f5" stroke="#6C3FA0" stroke-width="2"/>
  <text x="250" y="37" class="t" fill="#6C3FA0">호흡 센서 (RGSC 카메라)</text>
  <line x1="290" y1="50" x2="298" y2="100" stroke="#6C3FA0" stroke-dasharray="3 3" marker-end="url(#gqAp)"/>
  <text x="342" y="29" class="b" fill="#6C3FA0" text-anchor="start">호흡 파형</text>
  <text x="342" y="45" class="t" fill="#6b7b8a" text-anchor="start">= 시킨 설정</text>

  <polygon points="122,142 452,118 452,208 122,184" fill="#fdf6d8" stroke="#e0cf80"/>
  <rect x="14" y="132" width="108" height="62" rx="3" fill="#d6e4f0" stroke="#1A5276" stroke-width="2"/>
  <text x="68" y="157" class="t" fill="#1A5276">치료기 헤드</text>
  <text x="68" y="178" class="b" fill="#1A5276">갠트리 90°/270°</text>
  <text x="186" y="113" class="t" fill="#a08a2a">방사선 →</text>

  <rect x="232" y="114" width="140" height="62" rx="3" fill="#eef2f5" stroke="#6b7b8a" stroke-width="2"/>
  <text x="302" y="170" class="t" fill="#6b7b8a">호흡 팬텀</text>
  <rect x="272" y="104" width="60" height="10" fill="#6C3FA0"/>
  <text x="266" y="100" class="t" fill="#6C3FA0" text-anchor="end">표면 블록</text>
  <g class="gq-move">
    <circle cx="294" cy="142" r="6" fill="#1B7F3B"/>
  </g>
  <line x1="310" y1="153" x2="310" y2="131" stroke="#1B7F3B" stroke-width="1.5" marker-start="url(#gqAg)" marker-end="url(#gqAg)"/>
  <text x="317" y="146" class="t" fill="#1B7F3B" text-anchor="start">마커(BB)</text>

  <rect x="176" y="176" width="252" height="10" fill="#cfd6dc" stroke="#6b7b8a"/>
  <text x="250" y="201" class="t" fill="#6b7b8a">치료 침대</text>

  <rect x="456" y="108" width="96" height="106" rx="3" fill="#d6e4f0" stroke="#1A5276" stroke-width="2"/>
  <text x="504" y="155" class="b" fill="#1A5276">EPID</text>
  <text x="504" y="173" class="t" fill="#1A5276">(평판 검출기)</text>
  <line x1="504" y1="216" x2="504" y2="236" stroke="#1A5276" marker-end="url(#gqAb)"/>
  <text x="504" y="252" class="b" fill="#1A5276">EPID cine 영상</text>
  <text x="504" y="268" class="t" fill="#6b7b8a">= 실제로 일어난 일</text>

  <line x1="68" y1="196" x2="68" y2="228" stroke="#1B7F3B" stroke-dasharray="3 3" marker-end="url(#gqAg)"/>
  <rect x="10" y="232" width="128" height="40" rx="3" fill="#e8f0e8" stroke="#1B7F3B" stroke-width="2"/>
  <text x="74" y="248" class="b" fill="#1B7F3B">Trajectory log</text>
  <text x="74" y="264" class="t" fill="#6b7b8a">= 하려고 한 일</text>

  <text x="290" y="293" class="t" fill="#1b2b3a">옆에서 쏘기 때문에 호흡의 위아래 움직임이 EPID 영상에 그대로 보인다</text>
</svg>`;

  const STEPS = [
    ['셋업', [
      ['호흡 팬텀을 침대에 놓는다', '안의 <b>마커(쇠구슬)</b>와 위의 <b>표면 블록</b>이 사람 호흡처럼 함께 위아래로 움직인다.'],
      ['호흡 센서가 블록을 본다', 'RGSC 카메라가 블록 높이로 호흡을 읽고, 정한 구간(게이트 창)에서만 빔을 허락한다.'],
      ['갠트리를 옆(90° 또는 270°)으로', 'EPID는 빔에 수직인 면만 본다. 0°에서 쏘면 위아래 움직임이 영상에 안 보여 위치 판정을 할 수 없다.'],
    ]],
    ['측정', [
      ['게이팅을 켜고 조사하면서 EPID를 연속 촬영(cine)', '초당 약 13장. 빔이 켜진 프레임만 밝게 찍힌다. 예제: 270°, 127초, 빔 펄스 12개.'],
      ['기록 3가지를 모은다', '<b>EPID cine</b>(실제로 나온 빔과 마커 위치) · <b>Trajectory log</b>(기계가 20 ms마다 남긴 빔 멈춤/내보냄) · <b>호흡 파형</b>(.vxp 또는 Offline Review .txt, 선택).'],
      ['프로그램에 넣고 RUN ANALYSIS', '세 기록은 시계가 서로 달라서 프로그램이 빔 구간·마커 움직임으로 시간을 맞춘 뒤 4가지를 판정한다.'],
    ]],
  ];

  const CHECKS = [
    ['1', '조사시간 차', '로그의 빔 길이 vs EPID의 빔 길이'],
    ['2', '시간차 변동', '매 호흡 같은 타이밍으로 켜고 끄나'],
    ['3', '위치 재현성', '빔이 켜지고 꺼진 순간 마커 높이'],
    ['4', '전체 지연', '게이트 명령 → 실제 조사 (호흡 파형 필요)'],
  ];

  function mount(box) {
    let n = 0;
    const steps = STEPS.map(([head, items]) => `
      <section class="gq-group">
        <h3>${head}</h3>
        <ol>${items.map(([t, d]) => `<li><span class="gq-num">${++n}</span><div><b class="gq-t">${t}</b><p>${d}</p></div></li>`).join('')}</ol>
      </section>`).join('');
    box.innerHTML = `
      <div class="gq-intro">
        <header class="gq-head">
          <h2>Gating QA - 셋업과 측정</h2>
          <p>호흡에 맞춰 빔을 켜고 끄는 기능이 제때, 제자리에서 작동하는지 본다.
             <span class="gq-key">"기계가 하려고 한 일 · 실제로 나온 빔 · 그때 표적 위치"</span>를 맞춰 본다.</p>
        </header>
        <div class="gq-body">
          <figure class="gq-fig">${SETUP_SVG}</figure>
          <div class="gq-steps">${steps}</div>
        </div>
        <div class="gq-checks">
          <span class="gq-checks-lbl">판정 4가지 →</span>
          ${CHECKS.map(([k, t, d]) => `<div class="gq-chk"><span class="gq-chk-n">${k}</span><div><b>${t}</b><small>${d}</small></div></div>`).join('')}
        </div>
        <p class="gq-note">강의용 설명 페이지 (원본 프로그램 HELP 내용을 줄인 것). 다음 탭부터 원본 화면 캡처.</p>
      </div>`;
  }

  DM.intros = DM.intros || {};
  DM.intros.gating = mount;
})(typeof window !== 'undefined' ? window : globalThis);
