/* =============================================================================
 * FlowPilot AI — 파이프라인 결과 데이터 (에이전트 → 프로토타입 UI 연결용)
 * -----------------------------------------------------------------------------
 * 이 파일은 orchestrator가 plan→route→schedule→budget→document 를 실행한 뒤,
 * 각 단계 result.md 의 표 내용을 UI가 바로 렌더할 수 있는 형태로 모아 놓은 것이다.
 * 프로토타입 HTML은 <script src="flowpilot-data.js"> 로 이 파일을 읽어
 * window.FLOWPILOT_DATA 를 렌더한다. (file:// 에서 fetch 가 막히므로 JS 파일로 주입)
 *
 * 필드 설명·허용값은 flowpilot-data.schema.md 참조.
 * 아래 값은 예시(OO재단 어촌계·해녀 리모델링 지원사업 제주 현장심사)로 채운 것이다.
 * ========================================================================== */
window.FLOWPILOT_DATA = {
  // 이 데이터를 만든 시점·근거 (선택)
  meta: {
    generatedAt: "2026-08-12",
    source: "orchestrator (plan→route→schedule→budget→document)",
    note: "각 단계 result.md 를 구조화한 값. 지도 API 미연동 구간의 이동시간은 추정치."
  },

  // ── 1. plan (기획/데이터) ──────────────────────────────────────────────
  //  plan/result.md 의 "구조화된 출장 정보"에서 발췌
  plan: {
    state: "ok",                 // ok | request | reject  (schema 참조)
    label: "통과",               // 화면에 표시할 상태 문구
    reason: "필수 항목(목적·일정·인원·예산)과 목적지 식별 정보 모두 확인됨",
    projectName: "현장업무 운영 프로젝트",
    taskType: "현장 방문 출장",
    region: "제주",
    period: { start: "2026-05-14", end: "2026-05-15", nights: 1, days: 2 },
    purpose: "OO재단 어촌계 및 해녀 리모델링 지원사업 - 제주 소재 신청 시설 현장심사 및 견적산출",
    peopleTotal: 8,
    personnel: [
      { org: "따뜻한동행",   count: 2, members: "송oo 팀장, 주OO 대리" },
      { org: "건축사사무소", count: 4, members: "양oo 대표, 김oo 부장, 제주 현지 시공업체 2인" },
      { org: "수협재단",     count: 2, members: "김00 사무국장, 박00 과장" }
    ],
    budgetLimit: 1900000,
    expenseCategory: "사업비-공간복지지원-공간복지 수협-모니터링 및 심사비",
    author: "주OO",
    background: ""               // 배경·참고사항 (검증 없이 문서로 전달)
  },

  // ── 2. route (장소/경로 = 프로토타입의 Place 단계) ─────────────────────
  //  route/result.md 의 "최적 방문 순서 및 동선"
  route: {
    state: "ok",                 // ok | reject
    label: "통과",
    reason: "방문 가능 기간 내 전 지점 도착 가능, 반려 사유 없음",
    visits: [
      { no: 1, day: 1, type: "해녀",   name: "귀덕1리 어촌계",              address: "제주시 한림읍 귀덕9길 8, 2층",        moveFromPrev: "-",       arrive: "09:00", excluded: false },
      { no: 2, day: 1, type: "어촌계", name: "상모 어촌계(산이수동 해녀탈의장)", address: "서귀포시 대정읍 형제해안로 313",     moveFromPrev: "약 30분", arrive: "09:30", excluded: false },
      { no: 3, day: 1, type: "어촌계", name: "위미2리 어촌계",              address: "서귀포시 남원읍 위미리 791-1",        moveFromPrev: "약 40분", arrive: "10:10", excluded: false },
      { no: 4, day: 2, type: "어촌계", name: "신산리 어촌계 중부탈의장",     address: "서귀포시 성산읍 환해장성로 84",       moveFromPrev: "약 30분", arrive: "09:00", excluded: false },
      { no: 5, day: 2, type: "어촌계", name: "행원육상양식단지협의회",       address: "제주시 구좌읍 해맞이해안로 680-7",     moveFromPrev: "약 25분", arrive: "09:30", excluded: false },
      { no: 6, day: null, type: "해녀", name: "수협재단 모집 중 장소",        address: "주소 미정",                          moveFromPrev: "동선 제외", arrive: "-",     excluded: true, excludeReason: "주소 미정" }
    ]
  },

  // ── 3. schedule (일정) ────────────────────────────────────────────────
  //  schedule/result.md 의 1·2일차 일정표. rows 순서 = 화면 타임라인 순서
  schedule: {
    state: "warn",               // ok | warn | adjust | fail
    label: "경고",
    reason: "상모 어촌계 체류 40분 대비 확인 항목 5건으로 시간 부족 우려",
    rows: [
      { date: "2026-05-14(목)", time: "09:00-10:00", place: "귀덕1리 어촌계",              move: "정보 없음(당일 첫 방문지)", dwell: "60분", work: "이중 창호 및 바닥 개보수, 노후 출입문 교체 현장조사",                          state: "ok" },
      { date: "",               time: "10:30-11:10", place: "상모 어촌계(산이수동 해녀탈의장)", move: "차량이동 30분",           dwell: "40분", work: "타일 교체, 탈의장 페인트칠, 전기배선 보수, 도배, LED등·양수기모터 교체 현장조사(5개 항목)", state: "warn" },
      { date: "",               time: "11:50-12:20", place: "위미2리 어촌계",              move: "차량이동 40분",           dwell: "30분", work: "출입문 교체 및 화장실 보수, 벽면 균열 보수 현장조사",                              state: "ok" },
      { date: "2026-05-15(금)", time: "09:00-09:30", place: "신산리 어촌계 중부탈의장",     move: "차량이동 30분",           dwell: "30분", work: "천장 보수, 탈의장 개선 현장조사",                                              state: "ok" },
      { date: "",               time: "09:55-10:25", place: "행원육상양식단지협의회",       move: "차량이동 25분",           dwell: "30분", work: "외벽 부식 방지용 페인트 및 판넬 일부 교체 현장조사",                              state: "ok" }
    ]
  },

  // ── 4. budget (경비) ─────────────────────────────────────────────────
  //  budget/result.md 의 예상 경비표 + 예산 대비 판정
  budget: {
    state: "ok",                 // ok(가능) | fail(초과) | cannot(계산 불가)
    label: "가능",
    reason: "총 경비 1,700,000원이 예산 상한 1,900,000원 이내(200,000원 여유)",
    rows: [
      { name: "교통비",           amount: 600000, formula: "(100,000×2×2) + (100,000×2)" },
      { name: "숙박비",           amount: 200000, formula: "100,000×2×1" },
      { name: "기타(식사·다과)",   amount: 900000, formula: "(15,000×8×5) + (7,500×8×5)" }
    ],
    total: 1700000,
    budgetLimit: 1900000
  },

  // ── 5. document (문서) ───────────────────────────────────────────────
  //  document/result.md — 최종 품의서 메타. 본문 표는 위 schedule/budget 를 재사용
  document: {
    state: "ok",                 // ok | fail
    label: "통과",
    title: "OO재단 어촌계·해녀 리모델링 지원사업 제주 현장심사",
    author: "주OO",
    createdAt: "2026-08-12",
    hotel: "제주 애월읍 애월해안로 400-9",
    note: "수협재단 모집 중 장소(연번 6)는 주소 미정으로 이번 일정에서 제외됨"
  }
};
