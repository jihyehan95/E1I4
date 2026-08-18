// 네이버 지도 API(Geocoding, Directions)가 실제로 붙는지 검증하는 1회성 스크립트.
// 사용법: node scripts/verify-naver-maps.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadEnv(envPath) {
  const env = {};
  const text = readFileSync(envPath, "utf-8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return env;
}

const env = loadEnv(path.join(rootDir, ".env"));
const clientId = env.NAVER_MAP_CLIENT_ID;
const clientSecret = env.NAVER_MAP_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error("NAVER_MAP_CLIENT_ID / NAVER_MAP_CLIENT_SECRET이 .env에 비어 있습니다.");
  process.exit(1);
}

const headers = {
  "X-NCP-APIGW-API-KEY-ID": clientId,
  "X-NCP-APIGW-API-KEY": clientSecret,
};

// plan/result.md 2-5에 나온 실제 주소 (연번 1, 2)
const sampleAddresses = [
  { label: "연번1 상모 어촌계", address: "서귀포시 대정읍 형제해안로 313" },
  { label: "연번2 위미2리 어촌계", address: "서귀포시 남원읍 위미리 791-1" },
];

async function geocode(address) {
  const url = `https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(address)}`;
  const res = await fetch(url, { headers });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function directions(start, goal) {
  const url = `https://naveropenapi.apigw.ntruss.com/map-direction-15/v1/driving?start=${start}&goal=${goal}`;
  const res = await fetch(url, { headers });
  const raw = await res.text();
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    body = raw;
  }
  return { status: res.status, body };
}

const results = [];
console.log("=== 1. Geocoding 검증 ===");
const coords = [];
for (const { label, address } of sampleAddresses) {
  const { status, body } = await geocode(address);
  const point = body?.addresses?.[0];
  if (status === 200 && point) {
    console.log(`OK  ${label} (${address}) -> lng=${point.x}, lat=${point.y}`);
    coords.push({ label, x: point.x, y: point.y });
  } else {
    console.log(`FAIL ${label} (${address}) -> status=${status}`, JSON.stringify(body));
  }
  results.push({ label, address, status, ok: status === 200 && !!point });
}

console.log("\n=== 2. Directions(경로조회) 검증 ===");
if (coords.length >= 2) {
  const [a, b] = coords;
  const start = `${a.x},${a.y}`;
  const goal = `${b.x},${b.y}`;
  const { status, body } = await directions(start, goal);
  if (status === 200 && body?.route) {
    const summary = body.route.traoptimal?.[0]?.summary;
    console.log(`OK  ${a.label} -> ${b.label} : 거리=${summary?.distance}m, 소요시간=${summary?.duration}ms`);
  } else {
    console.log(`FAIL ${a.label} -> ${b.label} -> status=${status}`, JSON.stringify(body));
    console.log("(Directions 상품이 NCP 콘솔에서 아직 활성화 전이면 401/403이 정상적으로 뜹니다.)");
  }
} else {
  console.log("SKIP - Geocoding이 실패해서 좌표가 없어 Directions를 테스트할 좌표가 없습니다.");
}

const failed = results.filter((r) => !r.ok);
if (failed.length > 0) {
  console.log(`\n요약: Geocoding ${results.length - failed.length}/${results.length}건 성공`);
  process.exit(1);
} else {
  console.log(`\n요약: Geocoding ${results.length}/${results.length}건 성공`);
}
