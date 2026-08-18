"use strict";

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.join(REPO_ROOT, ".env");
const AGENT_MD_PATH = path.join(REPO_ROOT, ".claude", "agents", "document.md");
const MODEL = "claude-sonnet-5";

function readApiKey() {
  const raw = fs.readFileSync(ENV_PATH, "utf8");
  const match = raw.match(/^ANTHROPIC_API_KEY=(.*)$/m);
  const key = match && match[1].trim();
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY가 .env에 비어 있습니다.");
  }
  return key;
}

function readRolePrompt() {
  const raw = fs.readFileSync(AGENT_MD_PATH, "utf8");
  return raw.replace(/^---[\s\S]*?---\s*/, "").trim();
}

async function callAgent(inputText) {
  const apiKey = readApiKey();
  const systemPrompt = readRolePrompt();

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: inputText }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API 오류 (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.content.map((block) => block.text || "").join("\n").trim();
}

async function main() {
  const input = fs.readFileSync(0, "utf8");
  if (!input.trim()) {
    console.error("받은 글이 없습니다. 표준입력으로 처리할 글을 전달하세요.");
    process.exit(1);
  }
  const result = await callAgent(input);
  process.stdout.write(result + "\n");
}

module.exports = { callAgent };

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
