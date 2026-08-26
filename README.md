# 딸깍 서비스 (E1I4)

## 무엇을 해주나요

- 출장 목적, 일정(필수 방문지), 인원, 예산을 넣으면, plan(정보 확인) → route(동선) → schedule(일정표) → budget(경비 검토) → document(품의서) 5단계를 순서대로 실행해 출장 품의서 한 벌을 만들어 줍니다.
- 어느 단계에서든 반려·요청·경고·조정필요가 나오면 자동으로 다음 단계로 넘어가지 않고, 사용자 확인을 받은 뒤에만 이어갑니다.

## 준비물

- Claude Code (VS Code 확장)
- 이 폴더를 통째로 받아 VS Code에서 열기
- (화면 UI로 실행할 경우) `.env.example`을 `.env`로 복사하고 `ANTHROPIC_API_KEY` 채우기

## 실행 순서

### 1) Claude Code로 실행

1. VS Code에서 이 폴더를 열고 Claude Code를 켠다
2. 입력창에 "orchestrator로 [출장 정보]를 넣어서 출장 준비 진행해줘" 라고 시키면서 출장 목적, 일정, 필수 방문지, 인원, 예산을 함께 전달한다
3. 각 단계 결과에 사용자 확인이 필요하면 요청대로 확인·보완한다 → 모든 단계를 통과하면 `document` 폴더에 품의서가 생긴다

### 2) 화면(딸깍 서비스.html)으로 실행

1. `node orchestrator/call-agent --serve` 로 서버를 켠다 (기본 8788 포트)
2. `딸깍 서비스.html`을 열고 폼에 출장 정보를 입력한 뒤 실행 버튼을 누른다

### 3) 데모/녹화용 — API 토큰 없이 실행

`ANTHROPIC_API_KEY` 없이(비용 없이) 화면 동작만 그대로 보여주고 싶을 때 `call-agent` 대신 아래를 켠다.

1. `node orchestrator/mock-server.js --serve` (동일하게 기본 8788 포트, `.env`/API 키 불필요)
2. `딸깍 서비스.html`을 평소처럼 열고 사용한다 — 5단계 진행 애니메이션·결과 화면이 실제 서버와 똑같이 동작하지만, 결과는 AI 판단이 아니라 폼 입력값을 그대로 계산한 근사치다 (`buildFallbackData()`와 동일한 계산 로직)

> 참고: 실제 AI가 계산한 진짜 결과가 필요하면(근사치 말고), `.env`의 `USE_LOCAL_CLAUDE=1`로 로컬에 로그인된 Claude Code 구독을 대신 쓰는 방법도 있다(API 토큰 소진 시 우회용으로 이미 추가되어 있음).

## 폴더 구성

| 폴더 | 역할 |
| --- | --- |
| `.claude/agents/` | orchestrator, plan, route, schedule, budget, document 각 에이전트 지시문 |
| `orchestrator/` | 전체 진행 상황표, 화면-서버 연결용 `call-agent` 스크립트 |
| `plan/`, `route/`, `schedule/`, `budget/`, `document/` | 각 단계가 생성한 결과(`result.md`)가 실행 후 여기에 쌓인다 |

## 막힐 때

- 결과가 안 생기면: "orchestrator로 다시 실행해줘" 라고 시켜본다
- 특정 단계만 이상하면: 그 단계 에이전트(예: budget)만 따로 불러 확인한다
