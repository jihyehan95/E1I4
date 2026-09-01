#!/usr/bin/env node
// 데모/녹화용 로컬 모의 서버 — call-agent(--serve)와 완전히 같은 주소·프로토콜(POST /run,
// POST /parse-template, NDJSON 스트림)로 동작하지만 Anthropic API를 전혀 호출하지 않는다.
// ANTHROPIC_API_KEY, .env 모두 필요 없다 — API 토큰을 다 썼을 때 데모 영상 촬영용으로 쓴다.
//
// 사용법: node orchestrator/mock-server.js --serve [port]   (기본 8788, call-agent와 동일 포트)
// 딸깍 서비스.html 은 그대로 두고, 이 서버만 call-agent 대신 켜면 화면은 평소와 똑같이 동작한다
// (단계별 진행 애니메이션도 재생됨). 계산 로직은 딸깍 서비스.html의 buildFallbackData()/
// buildFallbackDataFromCustomForm()(서버 꺼져 있을 때 화면이 쓰는 폴백)와 동일하게 맞췄다 —
// 폼 입력값을 그대로 반영하므로 매번 다른 값을 넣어도 그에 맞는 결과가 나온다.

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ENV_PATH = path.join(ROOT, ".env");

// call-agent와 동일한 화면 서빙 허용목록 — 데모용으로 mock-server만 켜도 화면이 같은 주소에서 뜬다.
const STATIC_FILES = {
  "/": "ddalkkak_ai_landing.html",
  "/index.html": "ddalkkak_ai_landing.html",
  "/ddalkkak_ai_landing.html": "ddalkkak_ai_landing.html",
  "/딸깍 서비스.html": "딸깍 서비스.html",
  "/로고.jpg": "로고.jpg",
  "/flowpilot-data.js": "flowpilot-data.js",
};
const STATIC_CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".png": "image/png",
};

// 지도 스크립트용 클라이언트 ID는 공개용 값이라(NCP 콘솔에서 도메인으로 제한) .env에 있으면
// 그대로 내려준다 — 있으면 mock-server를 켠 채로도 지도가 실제로 뜬다. 없으면 call-agent와
// 동일하게 "" 를 내려줘서 화면이 정확한 "키 없음" 안내를 보여주게 한다.
function readNaverClientId(envPath) {
  if (!fs.existsSync(envPath)) return "";
  const line = fs.readFileSync(envPath, "utf8").split("\n").find((l) => l.startsWith("NAVER_MAP_CLIENT_ID="));
  return line ? line.slice("NAVER_MAP_CLIENT_ID=".length).trim() : "";
}

// call-agent는 네이버 Geocoding(유료 키 필요)으로 장소 검색을 대신하지만, mock-server는 키가 없어도
// 자동완성이 동작하도록 옛 방식인 무료 Nominatim을 서버에서 대신 호출해준다(브라우저 직접 호출은
// file:// CORS 문제가 있어 프록시로 감싼다). 응답 모양(lat/lon/display_name)은 실서버와 동일하다.
function nominatimSearch(query) {
  return new Promise((resolve) => {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=ko&q=${encodeURIComponent(query)}`;
    const req = https.get(url, { headers: { "User-Agent": "ddalkkak-mock-server-demo/1.0" } }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(body)); } catch { resolve([]); }
      });
    });
    req.on("error", () => resolve([]));
  });
}

function formatDate(value) {
  if (!value) return "미정";
  const d = new Date(value + "T00:00:00");
  if (Number.isNaN(d.getTime())) return value;
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.(${weekdays[d.getDay()]})`;
}

// 문서 제목은 프로젝트명이 아니라 "목적"에서 핵심 문구를 뽑아 만든다(첫 줄만 쓰고 뒤에 "계획"을 붙임).
function deriveTitleFromPurpose(purpose) {
  const text = (purpose || "").trim().split(/\n/)[0].trim();
  if (!text) return "";
  const short = text.length > 30 ? text.slice(0, 30).trim() + "…" : text;
  return `${short} 계획`;
}

function daysBetween(start, end) {
  if (!start || !end) return 0;
  const d1 = new Date(start + "T00:00:00");
  const d2 = new Date(end + "T00:00:00");
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return 0;
  return Math.max(0, Math.round((d2 - d1) / 86400000));
}

function parseDwellMinutes(text) {
  if (!text) return null;
  const h = text.match(/(\d+)\s*시간/);
  const m = text.match(/(\d+)\s*분/);
  if (!h && !m) return null;
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
}

function parseVisits(text) {
  return (text || "")
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean)
    .map((line, idx) => {
      let rest = line;
      let task = "", dwell = "";
      const extraMatch = rest.match(/\[([^\]]*)\]\s*$/);
      if (extraMatch) {
        rest = rest.slice(0, extraMatch.index).trim();
        extraMatch[1].split(",").map((x) => x.trim()).forEach((part) => {
          if (part.startsWith("할 일:")) task = part.replace(/^할 일:\s*/, "");
          else if (part.startsWith("체류시간:")) dwell = part.replace(/^체류시간:\s*/, "");
        });
      }

      let date = "", time = "";
      const dtMatch = rest.match(/\(([^)]*)\)\s*$/);
      if (dtMatch) {
        rest = rest.slice(0, dtMatch.index).trim();
        dtMatch[1].trim().split(/\s+/).forEach((tok) => {
          if (/^\d{4}-\d{2}-\d{2}$/.test(tok)) date = tok;
          else if (/^\d{1,2}:\d{2}$/.test(tok)) time = tok;
        });
      }

      let name = rest;
      let address = "";
      if (rest.includes(" - ")) {
        const parts = rest.split(" - ");
        name = parts.shift().trim();
        address = parts.join(" - ").trim();
      }
      return {
        no: idx + 1,
        type: "현장",
        name,
        address: address || "주소 미입력",
        work: task || "현장 확인 및 업무 수행",
        date, time, dwell,
      };
    });
}

function parseConditions(text) {
  const result = { hotel: "", lunch: "", extra: [] };
  (text || "").split("\n").map((x) => x.trim()).filter(Boolean).forEach((line) => {
    if (line.startsWith("숙소:")) result.hotel = line.replace(/^숙소:\s*/, "");
    else if (line.startsWith("점심:")) result.lunch = line.replace(/^점심:\s*/, "");
    else result.extra.push(line);
  });
  return result;
}

function buildBudgetRowsFromRule(rule, people, nights, days) {
  const p = Math.max(0, Number(people) || 0);
  const n = Math.max(0, Number(nights) || 0);
  const d = Math.max(0, Number(days) || 0);
  const rows = [];
  const push = (name, amount, formula) => {
    rows.push({ name, ruleAmount: amount, ruleFormula: formula, estimatedAmount: amount, estimatedFormula: "로컬 모의 서버 — 기준금액과 동일하게 표시" });
  };
  if (rule.lodging && n) push("숙박비", rule.lodging * p * n, `${Number(rule.lodging).toLocaleString()}원×${p}명×${n}박(설정값)`);
  if (rule.meal && d) push("식비", rule.meal * p * d, `${Number(rule.meal).toLocaleString()}원×${p}명×${d}일(설정값, 1일 1회 근사)`);
  if (rule.snack && d) push("다과비", rule.snack * p * d, `${Number(rule.snack).toLocaleString()}원×${p}명×${d}일(설정값, 1일 1회 근사)`);
  push("교통비", 0, `${rule.transport || "실비"} — 실제 영수증 기준이라 자동 계산 안 됨`);
  return rows;
}

function buildCostCandidates(rule) {
  const candidates = [];
  if (rule.lodging) candidates.push({ category: "숙박", name: "경비 기준 내 숙소(후보 미탐색)", unit: "1인 1박", unitPrice: Number(rule.lodging) || 0, note: "로컬 모의 서버 — 경비 기준 설정값 그대로 사용" });
  if (rule.meal) candidates.push({ category: "식비", name: "경비 기준 내 식당(후보 미탐색)", unit: "1인 1식", unitPrice: Number(rule.meal) || 0, note: "로컬 모의 서버 — 경비 기준 설정값 그대로 사용" });
  candidates.push({ category: "교통", name: rule.transport || "실비 교통편", unit: "왕복", unitPrice: 0, note: "실비 정산 — 자동 계산 안 됨" });
  return candidates;
}

function buildData(form) {
  const budgetRule = form.budgetRule || {};

  if (form.customForm) {
    const answers = (form.customFormAnswers || []).filter((a) => a.value && a.value.trim());
    const purpose = answers.length ? answers.map((a) => `${a.label}: ${a.value}`).join("\n") : "입력한 항목이 없습니다.";
    const author = form.author || "미정";
    const budgetRows = buildBudgetRowsFromRule(budgetRule, 0, 0, 0);
    const ruleTotal = budgetRows.reduce((s, r) => s + r.ruleAmount, 0);
    const estimatedTotal = budgetRows.reduce((s, r) => s + r.estimatedAmount, 0);
    return {
      plan: {
        state: "ok", label: "완료", reason: "로컬 모의 서버 — 자사 양식에 입력한 값을 자동 분류 없이 그대로 표시합니다.",
        projectName: "자사 양식 제출 건", taskType: "자사 양식", region: "",
        period: { start: "", end: "", nights: 0, days: 0 },
        purpose, peopleTotal: 0, personnel: [], budgetLimit: 0, expenseCategory: "", author, background: form.customFormFreeText || "",
      },
      route: { state: "ok", label: "완료", reason: "", visits: [], costCandidates: [] },
      schedule: { state: "ok", label: "완료", reason: "", rows: [] },
      budget: {
        state: "ok", label: "완료", reason: "로컬 모의 서버 — 경비 기준 설정만으로 계산한 근사치입니다(자사 양식 항목은 반영되지 않음).",
        rows: budgetRows, ruleTotal, estimatedTotal, budgetLimit: 0,
      },
      document: {
        state: "ok", label: "완료", title: "자사 양식 제출 건", author, createdAt: new Date().toISOString().slice(0, 10),
        hotel: "", note: "입력한 항목은 위 '출장개요 · 목적'에 그대로 나열했습니다.",
      },
    };
  }

  const taskType = form.taskType || "현장 방문";
  const region = form.region || "미정";
  const startDate = form.startDate || "";
  const endDate = form.endDate || "";
  const people = Number(form.people || 0);
  const attendees = form.attendees || "";
  const budget = Number(String(form.budget || "0").replace(/,/g, ""));
  const purpose = form.purpose || "업무 목적 미입력";
  const author = form.author || "미정";
  const projectName = form.projectName || "현장업무 운영 프로젝트";

  const visits = parseVisits(form.visits);
  const conditions = parseConditions(form.conditions);

  const routeVisits = [];
  const scheduleRows = [];
  let hour = 9, minute = 0;
  let lastPrintedDate = "";
  const pad = (n) => String(n).padStart(2, "0");

  const visitDates = [...new Set(visits.map((v) => v.date || startDate).filter(Boolean))].sort();
  const dayIndexByDate = new Map(visitDates.map((d, i) => [d, i + 1]));

  visits.forEach((v, i) => {
    const visitDate = v.date || startDate;
    if (v.time && /^\d{1,2}:\d{2}$/.test(v.time)) {
      const [h, m] = v.time.split(":").map(Number);
      hour = h; minute = m;
    } else if (i > 0) {
      minute += 30;
      if (minute >= 60) { hour += Math.floor(minute / 60); minute %= 60; }
    }

    const moveFromPrev = i === 0 ? "-" : (v.time ? "차량이동(요청 시간 기준)" : "차량이동 약 30분(추정)");
    routeVisits.push({
      no: v.no, day: dayIndexByDate.get(visitDate) || 1, type: v.type, name: v.name, address: v.address,
      moveFromPrev, arrive: `${pad(hour)}:${pad(minute)}`, excluded: false, excludeReason: "",
    });

    const startH = pad(hour), startM = pad(minute);
    let endHour = hour, endMinute = minute + (parseDwellMinutes(v.dwell) ?? 40);
    if (endMinute >= 60) { endHour += Math.floor(endMinute / 60); endMinute %= 60; }

    const dateLabel = formatDate(visitDate);
    scheduleRows.push({
      date: dateLabel !== lastPrintedDate ? dateLabel : "",
      time: `${startH}:${startM}-${pad(endHour)}:${pad(endMinute)}`,
      place: v.name, work: v.work, move: moveFromPrev, dwell: v.dwell || "40분(추정)", state: "ok",
    });
    lastPrintedDate = dateLabel;
    hour = endHour; minute = endMinute;
  });

  if (!visits.length) {
    scheduleRows.push({ date: formatDate(startDate), time: "09:00-10:00", place: "업무 시작 및 현장 이동", work: "", move: "-", dwell: "", state: "ok" });
  }
  if (conditions.lunch) {
    scheduleRows.push({ date: "", time: conditions.lunch, place: "점심식사", work: "", move: "-", dwell: "", state: "ok" });
  }

  const nights = daysBetween(startDate, endDate);
  const days = startDate && endDate ? nights + 1 : 0;
  const budgetRows = buildBudgetRowsFromRule(budgetRule, people, nights, days);
  const ruleTotal = budgetRows.reduce((s, r) => s + r.ruleAmount, 0);
  const estimatedTotal = budgetRows.reduce((s, r) => s + r.estimatedAmount, 0);

  return {
    plan: {
      state: "ok", label: "완료", reason: "로컬 모의 서버 — 폼 입력만으로 만든 데모용 결과입니다 (실제 API 호출 없음).",
      projectName, taskType, region,
      period: { start: startDate, end: endDate, nights, days },
      purpose, peopleTotal: people, personnel: [], attendees, budgetLimit: budget, expenseCategory: "", author, background: "",
    },
    route: { state: "ok", label: "완료", reason: "", visits: routeVisits, costCandidates: buildCostCandidates(budgetRule) },
    schedule: { state: "ok", label: "완료", reason: "", rows: scheduleRows },
    budget: {
      state: "ok", label: "완료", reason: "경비 기준 설정(인당 한도)으로 계산한 근사치입니다. 교통비는 실비라 자동 계산에서 빠졌어요.",
      rows: budgetRows, ruleTotal, estimatedTotal, budgetLimit: budget,
    },
    document: {
      state: "ok", label: "완료", title: deriveTitleFromPurpose(purpose) || `${region} ${taskType} 계획`, author, createdAt: new Date().toISOString().slice(0, 10),
      hotel: conditions.hotel, note: conditions.extra.length ? conditions.extra.join(" · ") : "",
    },
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randomDelay = () => 500 + Math.floor(Math.random() * 700);

async function runMockPipeline(form, onEvent) {
  const stages = ["plan", "route", "schedule", "budget", "document"];
  for (const stage of stages) {
    onEvent({ type: "stage_start", stage });
    await sleep(randomDelay());
    onEvent({ type: "stage_done", stage, state: "ok" });
  }
  const data = buildData(form);
  data.meta = {
    generatedAt: new Date().toISOString().slice(0, 10),
    source: "orchestrator/mock-server (데모용 — 실제 API 호출 없이 폼 입력만으로 생성)",
    note: "5단계 모두 통과 (로컬 모의 서버)",
  };
  return { data, hardStopped: null };
}

function runServer(port) {
  const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "GET" && STATIC_FILES[decodeURIComponent(new URL(req.url, "http://localhost").pathname)]) {
      const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      const filePath = path.join(ROOT, STATIC_FILES[pathname]);
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Not found");
          return;
        }
        const ext = path.extname(filePath);
        res.writeHead(200, { "Content-Type": STATIC_CONTENT_TYPES[ext] || "application/octet-stream" });
        res.end(data);
      });
      return;
    }

    if (req.method === "GET" && req.url.startsWith("/config")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ naverMapClientId: readNaverClientId(ENV_PATH) }));
      return;
    }

    if (req.method === "GET" && req.url.startsWith("/api/geocode")) {
      const query = new URL(req.url, "http://localhost").searchParams.get("q") || "";
      const list = query.trim() ? await nominatimSearch(query.trim()) : [];
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(list));
      return;
    }

    if (req.method === "POST" && req.url.startsWith("/parse-template")) {
      let body = "";
      req.setEncoding("utf8");
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        let fileName = "";
        try { fileName = (JSON.parse(body) || {}).fileName || ""; } catch {}
        console.log(`[mock-server] 양식 분석(모의): ${fileName}`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          fields: [
            { id: "purpose", label: "출장 목적", hint: "", type: "textarea" },
            { id: "date", label: "기간", hint: "YYYY-MM-DD ~ YYYY-MM-DD", type: "text" },
            { id: "budget", label: "예산", hint: "숫자만 입력", type: "number" },
          ],
          confidence: "low",
          note: "로컬 모의 서버라 실제 문서를 읽지 않고 예시 항목만 채웠습니다. 자유 입력란에 직접 보완해 주세요.",
        }));
      });
      return;
    }

    if (req.method !== "POST" || !req.url.startsWith("/run")) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "POST /run, POST /parse-template, GET /config, GET /api/geocode 만 받습니다." }));
      return;
    }

    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      res.writeHead(200, { "Content-Type": "application/x-ndjson" });
      try {
        const form = JSON.parse(body);
        console.log(`[mock-server] 실행 시작(모의): ${form.region || ""} / ${form.taskType || ""}`);
        const result = await runMockPipeline(form, (event) => {
          res.write(JSON.stringify(event) + "\n");
        });
        console.log("[mock-server] 5단계 모두 완료(모의)");
        res.write(JSON.stringify({ type: "result", ...result }) + "\n");
        res.end();
      } catch (error) {
        console.error("[mock-server]", error.message);
        res.write(JSON.stringify({ type: "error", error: error.message }) + "\n");
        res.end();
      }
    });
  });

  server.listen(port, () => {
    console.log(`[mock-server] http://localhost:${port}/run 에서 요청을 기다리고 있습니다. (데모용 — API 호출 없음)`);
  });
}

const serveIndex = process.argv.indexOf("--serve");
if (serveIndex !== -1) {
  const port = Number(process.argv[serveIndex + 1]) || 8788;
  runServer(port);
} else {
  console.error("사용법: node orchestrator/mock-server.js --serve [port]");
  process.exit(1);
}
