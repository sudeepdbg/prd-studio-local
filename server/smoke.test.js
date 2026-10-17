import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

// Mock Ollama + Jira, then exercise the real server routes end to end.
function mock(handler) {
  return new Promise((res) => { const s = http.createServer(handler); s.listen(0, "127.0.0.1", () => res(s)); });
}
const body = (req) => new Promise((r) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => r(d ? JSON.parse(d) : {})); });
const send = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };

test("llm, config and jira routes work against mocks", async () => {
  const ollama = await mock(async (req, res) => {
    if (req.url === "/api/tags") return send(res, 200, { models: [{ name: "phi3.5:latest" }] });
    if (req.url === "/api/chat") { await body(req); return send(res, 200, { message: { content: '{"answers":{"problem":{"text":"x","status":"filled","evidence":"intro"}}}' } }); }
    return send(res, 404, {});
  });
  const created = [];
  const jira = await mock(async (req, res) => {
    if (req.url.startsWith("/rest/api/3/project/")) return send(res, 200, { name: "Demo", issueTypes: [{ name: "Epic" }, { name: "Story" }, { name: "Sub-task", subtask: true }] });
    if (req.url === "/rest/api/3/issue") { const b = await body(req); created.push(b); return send(res, 201, { key: "DEMO-" + created.length }); }
    return send(res, 404, {});
  });
  const op = ollama.address().port, jp = jira.address().port;

  process.env.OLLAMA_URL = `http://127.0.0.1:${op}`;
  process.env.OLLAMA_MODEL = "phi3.5";
  process.env.JIRA_BASE_URL = `http://127.0.0.1:${jp}`;
  process.env.JIRA_EMAIL = "a@b.c";
  process.env.JIRA_API_TOKEN = "t";
  process.env.PORT = "0";
  const { createServer } = await import("./app.js");
  const app = createServer();
  const srv = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  const base = `http://127.0.0.1:${srv.address().port}`;
  const post = async (p, b) => (await fetch(base + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })).json();

  const cfg = await (await fetch(base + "/api/config")).json();
  assert.equal(cfg.ollamaUp, true);
  assert.equal(cfg.modelInstalled, true);
  assert.equal(cfg.jiraConfigured, true);

  // New /api/health endpoint
  const health = await (await fetch(base + "/api/health")).json();
  assert.equal(health.ok, true);
  assert.ok(typeof health.uptime === "number");

  // Unknown /api/* routes return JSON 404, not the SPA HTML
  const unknown = await fetch(base + "/api/no-such-route");
  assert.equal(unknown.status, 404);
  assert.equal(unknown.headers.get("content-type"), "application/json; charset=utf-8");
  const unknownBody = await unknown.json();
  assert.match(unknownBody.error, /Unknown API route/);

  // LLM input validation
  const bad = await post("/api/llm", { system: 123, user: "u" });
  assert.match(bad.error, /strings/);

  const llm = await post("/api/llm", { system: "s", user: "u", schema: { type: "object" } });
  assert.match(llm.text, /"problem"/);

  const conn = await post("/api/jira/connect", { projectKey: "DEMO" });
  assert.equal(conn.projectName, "Demo");
  assert.deepEqual(conn.issueTypes, ["Epic", "Story"]);

  // Invalid project keys are rejected before Jira is called
  const badKey = await post("/api/jira/connect", { projectKey: "1BAD" });
  assert.match(badKey.error, /invalid/i);

  const epic = await post("/api/jira/issue", { projectKey: "DEMO", type: "Epic", title: "E", description: "line\n- a\n- b", labels: ["ai generated"] });
  assert.equal(epic.key, "DEMO-1");
  assert.equal(created[0].fields.labels[0], "ai-generated");
  assert.equal(created[0].fields.description.content[1].type, "bulletList");

  await new Promise((r) => srv.close(r));
  await new Promise((r) => ollama.close(r));
  await new Promise((r) => jira.close(r));
});
