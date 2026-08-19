/* =============================================================================
 * FlowPilot AI — 파이프라인 결과 데이터 (에이전트 → 프로토타입 UI 연결용)
 * -----------------------------------------------------------------------------
 * 이 파일은 orchestrator가 plan→route→schedule→budget→document 를 실행한 뒤,
 * 각 단계 result.md 의 표 내용을 UI가 바로 렌더할 수 있는 형태로 모아 놓은 것이다.
 * 프로토타입 HTML은 <script src="flowpilot-data.js"> 로 이 파일을 읽어
 * window.FLOWPILOT_DATA 를 렌더한다. (file:// 에서 fetch 가 막히므로 JS 파일로 주입)
 *
 * 필드 설명·허용값은 flowpilot-data.schema.md 참조.
 * 실전 운영으로 전환하면서 예시(제주 현장심사) 데이터는 제거했다.
 * null로 두면 화면은 이 값을 쓰지 않고 폼 입력 기반 폴백 또는 orchestrator의
 * 실제 호출 결과(window.FLOWPILOT_DATA를 거치지 않고 직접 렌더됨)를 사용한다.
 * ========================================================================== */
window.FLOWPILOT_DATA = null;
