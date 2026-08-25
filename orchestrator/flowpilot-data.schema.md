# FlowPilot 데이터 규격 (flowpilot-data.js)

에이전트 파이프라인(plan→route→schedule→budget→document)의 결과를 프로토타입 UI가 렌더할 수 있게 잇는 **단일 데이터 규격**이다.

- **누가 만드나:** `orchestrator` 가 5개 단계를 실행한 뒤, 각 단계 `result.md` 를 구조화해 이 파일 하나로 합친다.
- **누가 읽나:** 프로토타입 HTML이 `<script src="flowpilot-data.js">` 로 불러 `window.FLOWPILOT_DATA` 를 렌더한다.
- **왜 JS 파일인가:** `file://` 로 여는 정적 HTML은 로컬 파일을 `fetch()` 로 못 읽는다. `<script src>` 는 되므로 전역 변수로 주입한다.
- **원칙:** `result.md`(사람이 읽는 문서)는 그대로 두고, 이 파일은 그 표를 **기계가 읽는 형태로 복제**한 것. 값을 새로 지어내지 않는다.

---

## 최상위 구조

```js
window.FLOWPILOT_DATA = {
  meta:     { ... },   // 선택: 생성 시점·근거
  plan:     { ... },   // 1단계
  route:    { ... },   // 2단계 (프로토타입의 Place 단계)
  schedule: { ... },   // 3단계
  budget:   { ... },   // 4단계
  document: { ... }    // 5단계
};
```

각 단계 객체는 공통으로 **`state`(기계용 상태) + `label`(화면 문구) + `reason`(한 줄 이유)** 를 가진다.

---

## 공통 상태값 `state`

UI의 오피스 단계 배지(대기/실행중/…) 색과 orchestrator의 "멈춤" 판단에 쓰는 정규화 값이다. 각 에이전트의 표현(통과/가능/정상/조정필요/경고/반려…)을 아래로 매핑한다.

| `state` | 의미 | 원본 표현 예 | UI 색(제안) | orchestrator 동작 |
| --- | --- | --- | --- | --- |
| `ok`      | 정상 통과       | 통과, 가능, 정상       | 초록 | 다음 단계로 진행 |
| `warn`    | 경고(진행은 가능) | 경고                  | 노랑 | **멈추고 사용자 확인** |
| `adjust`  | 조정 필요       | 조정필요               | 노랑 | **멈추고 사용자 확인** |
| `request` | 정보 부족·요청   | 요청, 기획 정보 부족    | 파랑 | **멈추고 추가 입력 요청** |
| `reject` / `fail` / `cannot` | 반려·불가 | 반려, 초과, 생성 불가 | 빨강 | **멈추고 사용자 확인** |
| `pending` | 아직 실행 전     | 대기                  | 회색 | (초기 상태) |

> `label` 은 그 단계 원본 문구를 그대로 쓴다(예: budget 은 `"가능"`/`"초과"`). `state` 는 위 표의 정규화 값.

---

## 1. `plan` — 기획/데이터

| 필드 | 타입 | 설명 | 출처(plan/result.md) |
| --- | --- | --- | --- |
| `state` / `label` / `reason` | string | 공통 상태 | 항목별 확인 결과표 종합 |
| `projectName` | string | 기관/사업 주체명 | 구조화 정보 |
| `taskType` | string | 업무 유형(현장 방문 출장 등) | 입력 |
| `region` | string | 지역 | 2-2 |
| `period` | `{start,end,nights,days}` | 기간(YYYY-MM-DD) | 2-2 |
| `purpose` | string | 출장 목적 | 2-1 |
| `peopleTotal` | number | 총 인원 | 2-3 |
| `personnel` | `[{org,count,members}]` | 소속별 인원 구성 | 2-3 |
| `budgetLimit` | number | 예산 상한(원) | 2-4 |
| `expenseCategory` | string | 지출항목·사업 분류 | 2-4 |
| `author` | string | 작성자 | 입력 |
| `background` | string | 배경·참고사항(선택, 검증 없이 문서로 전달) | 2-... |

## 2. `route` — 장소/경로 (= 프로토타입 Place 단계)

`plan`의 GeoCoding·후보 + `route`의 순서 최적화 결과를 합쳐 담는다. Place를 route로 대응하기로 했으므로 **방문지 목록 + 동선 순서**를 여기에 둔다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `state` / `label` / `reason` | string | 공통 상태(주소 확인 불가·도착 불가 시 `reject`) |
| `visits` | `[visit]` | 방문지 목록(동선 순서대로 정렬) |
| `costCandidates` | `[costCandidate]` | 이 출장에 필요한 교통편·숙박·식당 후보와 예상 단가. `budget` 단계가 "예상 사용 금액" 계산에 그대로 쓴다 |

`costCandidate` 객체:

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `category` | string | 구분(`"교통"` / `"숙박"` / `"식비"`) |
| `name` | string | 후보명 |
| `unit` | string | 단가 기준(예 `"1인 왕복"`, `"1박"`, `"1인 1식"`) |
| `unitPrice` | number | 단가(원). 통상 시세로 추정했으면 `note`에 "(추정)" 표시 |
| `note` | string | 비고(선택) |

`visit` 객체:

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `no` | number | 순번 |
| `day` | number \| null | 방문 일차(1,2…). 동선 제외면 `null` |
| `type` | string | 구분(어촌계/해녀 등) |
| `name` | string | 대상지명 |
| `address` | string | 소재지. 미확정이면 `"주소 미정"` |
| `moveFromPrev` | string | 직전 지점→현재 이동시간(추정치 문구 그대로). 예 `"약 30분"` |
| `arrive` | string | 도착 예정 시각 `"HH:MM"` |
| `excluded` | boolean | 동선 제외 여부 |
| `excludeReason` | string | 제외 사유(선택, `excluded:true` 일 때) |
| `lat` / `lng` | number (선택) | 위도/경도. call-agent가 Naver Geocoding으로 직접 확인해 이름으로 매칭해 붙인 실측값 — LLM 취합 결과가 아니다. 못 찾았으면 필드 자체가 없다(지도에서 그 핀은 생략) |

## 3. `schedule` — 일정

`rows` 배열의 **순서 = 화면 타임라인 순서**. 날짜가 바뀌는 첫 행에만 `date` 를 채우고 이어지는 행은 `""`(빈 문자열)로 둔다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `state` / `label` / `reason` | string | 일정표 전체 상태(한 행이라도 `warn`/`adjust`면 상위도 그 상태) |
| `rows` | `[row]` | 일정 행 |

`row` 객체:

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `date` | string | 일자. 이어지는 행은 `""` |
| `time` | string | `"HH:MM-HH:MM"` |
| `place` | string | 장소명 |
| `move` | string | 이동수단·소요시간 |
| `dwell` | string | 체류시간(예 `"40분"`) |
| `work` | string | 해야 할 일 |
| `state` | string | 행 단위 상태(`ok`/`warn`/`adjust`) — 셀 배지에 사용 |

## 4. `budget` — 경비

계산은 두 갈래다: **기준금액**(경비 기준 설정 — 인당 한도 규정으로 계산)과 **예상 사용 금액**(`route.costCandidates`로 계산한 실제 예상 비용). 예산 대비 판정은 예상 사용 금액 기준으로 한다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `state` / `label` / `reason` | string | `ok`(가능)/`fail`(초과)/`cannot`(계산 불가) — 예상 사용 금액 기준 |
| `rows` | `[{name,ruleAmount,ruleFormula,estimatedAmount,estimatedFormula}]` | 항목별 기준금액·예상 사용 금액(원)과 각각의 산출식 |
| `ruleTotal` | number | 기준금액 합계(원) |
| `estimatedTotal` | number | 예상 사용 금액 합계(원) — 예산 대비 판정에 쓰는 값 |
| `budgetLimit` | number | 예산 상한(원) — 대비 판정용 |

## 5. `document` — 문서

본문의 일정·경비 표는 위 `schedule`/`budget` 를 재사용하고, 여기서는 **문서 메타**만 둔다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `state` / `label` | string | 공통 상태 |
| `title` | string | 문서 제목 |
| `author` | string | 작성자 |
| `createdAt` | string | 작성일(YYYY-MM-DD) |
| `hotel` | string | 숙소(선택) |
| `hotelLat` / `hotelLng` | number (선택) | 숙소 위도/경도. call-agent가 `hotel` 값을 Naver Geocoding으로 직접 확인한 실측값 — 못 찾았으면 필드 자체가 없다 |
| `note` | string | 하단 참고(제외 목적지 등) |

---

## UI 매핑 요약 (프로토타입 5단계 ↔ 데이터)

| 오피스 단계 | id | 읽는 데이터 | 배지 상태 근거 |
| --- | --- | --- | --- |
| 기획 담당 (Planner) | `a1` | `plan` | `plan.state` |
| 리서치 담당 (Place)  | `a2` | `route` | `route.state` |
| 일정 담당 (Schedule) | `a3` | `schedule` | `schedule.state` |
| 경비 담당 (Cost)     | `a4` | `budget` | `budget.state` |
| 문서 담당 (Document) | `a5` | `document` | `document.state` |

최종 Preview(계획서)는 `plan`(개요) + `route`(대상지) + `schedule`(상세일정) + `budget`(예산) + `document`(제목·작성자)를 합쳐 렌더한다.
