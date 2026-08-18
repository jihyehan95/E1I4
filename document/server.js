"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { callAgent } = require("./call-agent");

const PORT = process.env.PORT || 5173;
const SCREEN_PATH = path.join(__dirname, "screen.html");

const server = http.createServer((req, res) => {
  if (req.method === "GET" && (req.url === "/" || req.url === "/screen.html")) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(fs.readFileSync(SCREEN_PATH, "utf8"));
    return;
  }

  if (req.method === "POST" && req.url === "/call-agent") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", async () => {
      try {
        const { data, template } = JSON.parse(body || "{}");
        const result = await callAgent(data || "", template || "");
        res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
        res.end(result);
      } catch (err) {
        res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
        res.end(err.message);
      }
    });
    return;
  }

  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  res.end("Not Found");
});

server.listen(PORT, () => {
  console.log(`document 화면 서버 실행 중: http://localhost:${PORT}`);
});
