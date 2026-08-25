#!/usr/bin/env node
// plan 에이전트를 orchestrator 없이 단독으로 실행해보는 테스트 스크립트.
// 자사양식(customForm) 입력 경로와, 실측 좌표 우선 규칙이 제대로 동작하는지 확인하는 용도.
// 사용법: node plan/test-customform.js

const fs = require("fs");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");

const ROOT = path.join(__dirname, "..");
const ENV_PATH = path.join(ROOT, ".env");
const PLAN_MD_PATH = path.join(ROOT, ".claude", "agents", "plan.md");
const MODEL = "claude-sonnet-5";

function readApiKey() {
  const line = fs
    .readFileSync(ENV_PATH, "utf8")
    .split("\n")
    .find((l) => l.startsWith("ANTHROPIC_API_KEY="));
  if (!line) throw new Error(".env에 ANTHROPIC_API_KEY 줄이 없습니다.");
  const value = line.slice("ANTHROPIC_API_KEY=".length).trim();
  if (!value) throw new Error(".env의 ANTHROPIC_API_KEY 값이 비어 있습니다.");
  return value;
}

function readRoleInstruction() {
  const raw = fs.readFileSync(PLAN_MD_PATH, "utf8");
  const parts = raw.split(/^---\s*$/m);
  if (parts.length < 3) throw new Error(`${PLAN_MD_PATH}에서 역할 지시문 본문을 찾지 못했습니다.`);
  return parts.slice(2).join("---").trim();
}

// orchestrator/call-agent의 buildPlanInput(자사양식 경로)와 같은 모양의 샘플 입력.
// 행선지1은 실측 좌표(Naver Geocoding 결과 흉내)를 함께 주고, 행선지2는 지역명만 줘서
// "실측 좌표는 그대로, 없는 목적지만 추정" 규칙이 실제로 갈리는지 확인한다.
const SAMPLE_INPUT = `## 자사 양식 입력 내용 (사용자가 회사 자체 양식에 채운 값 그대로)

출장 목적: 부산 지사 방문 및 하반기 협업 논의
행선지1: 부산 지사 (부산광역시 해운대구 센텀중앙로 90, 실측 좌표 35.1691,129.1306 — Naver Geocoding 결과)
행선지2: 협력사 미팅 (부산 강서구 소재, 정확한 주소 미정)
출장일자: 2026-09-10 ~ 2026-09-12
총 인원: 3명
예산 상한: 1,800,000원

## 출장비 규정 (화면 경비 기준 설정값, 그대로 적용)

식비 인당 30,000원 이내, 다과비 인당 10,000원 이내, 숙박비 인당 120,000원 이내, 교통비 실비

## 추가 설명

이전 협업 프로젝트 후속 미팅

## 작성자

고상진`;

async function main() {
  const apiKey = readApiKey();
  const client = new Anthropic({ apiKey });
  const system = readRoleInstruction();

  console.log("=== plan 에이전트에 보내는 입력 (자사양식 샘플) ===\n");
  console.log(SAMPLE_INPUT);
  console.log("\n=== 응답 ===\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system,
    messages: [{ role: "user", content: SAMPLE_INPUT }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  console.log(text);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
