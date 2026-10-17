import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { toADF, docCharLimit, rejectedFields, isValidProjectKey, sanitizeJiraLabel, truncateOnWord } from "./lib.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;
const PORT = Number(env.PORT || 8787);
const OLLAMA_URL = (env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const MODEL = env.OLLAMA_MODEL || "phi3.5";
const NUM_CTX = Number(env.NUM_CTX || 8192);
const MAX_PARALLEL = Math.max(1, Number(env.MAX_PARALLEL || 1));
const JIRA_BASE = (env.JIRA_BASE_URL || "").replace(/\/$/, "");
const JIRA_READY = Boolean(JIRA_BASE && env.JIRA_EMAIL && env.JIRA_API_TOKEN);

// A 4MB body is generous for a local app; 1MB is plenty for PRD text + JSON.
const BODY_LIMIT = "1mb";

export function createServer() {
  const app = express();
  app.use(express.json({ limit: BODY_LIMIT }));

  /* ---------- simple queue so a laptop is never flooded ---------- */
  // The original implementation had a subtle bug: when a request was
  // queued (not immediately acquired), `release()` would call the next
  // waiter but never decrement `active`. The queue still worked because
  // each waiter resolved without going through `acquire` again, but the
  // counter was wrong. This version is explicit and correct.
  let active = 0;
  const waiters = [];
  const acquire = () => {
    if (active < MAX_PARALLEL) {
      active++;
      return Promise.resolve();
    }
    return new Promise((resolve) => waiters.push(resolve));
  };
  const release = () => {
    const next = waiters.shift();
    if (next) {
      // Hand the slot directly to the next waiter; active stays the same.
      next();
    } else {
      active = Math.max(0, active - 1);
    }
  };

  /* ---------- health ---------- */
  // Separate /api/health from /api/config so the UI can ping the server
  // without waiting on Ollama (which has a 2.5s timeout in /api/config).
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, port: PORT, uptime: process.uptime() });
  });

  /* ---------- config + model reachability ---------- */
  app.get("/api/config", async (_req, res) => {
    const out = {
      model: MODEL,
      numCtx: NUM_CTX,
      docLimit: docCharLimit(NUM_CTX),
      ollamaUp: false,
      modelInstalled: false,
      jiraConfigured: JIRA_READY,
    };
    try {
      const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2500) });
      if (r.ok) {
        out.ollamaUp = true;
        const j = await r.json();
        const names = (j.models || []).map((m) => m.name);
        out.modelInstalled = names.some(
          (n) => n === MODEL || n === `${MODEL}:latest` || n.split(":")[0] === MODEL
        );
      }
    } catch {
      /* Ollama not reachable */
    }
    res.json(out);
  });

  /* ---------- LLM proxy (Ollama native API) ---------- */
  app.post("/api/llm", async (req, res) => {
    const { system = "", user = "", maxTokens = 1000, schema = null } = req.body || {};

    // Basic input validation — refuse absurd payloads early.
    if (typeof system !== "string" || typeof user !== "string") {
      return res.status(400).json({ error: "system and user must be strings." });
    }
    if (system.length > 32_000 || user.length > 128_000) {
      return res.status(413).json({ error: "Prompt too large for the local model." });
    }

    const ctrl = new AbortController();
    res.on("close", () => { if (!res.writableFinished) ctrl.abort(); });
    await acquire();
    try {
      if (ctrl.signal.aborted) return;
      const r = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          model: MODEL,
          stream: false,
          format: schema || "json",
          keep_alive: "30m",
          options: {
            num_ctx: NUM_CTX,
            num_predict: Math.min(Number(maxTokens) || 1000, 2000),
            temperature: 0.2,
          },
          messages: [
            { role: "system", content: String(system) },
            { role: "user", content: String(user) },
          ],
        }),
      });
      if (!r.ok) {
        const body = await r.text();
        if (r.status === 404) {
          return res.status(404).json({
            error: `Model "${MODEL}" is not installed. Run: ollama pull ${MODEL}`,
          });
        }
        return res.status(502).json({
          error: `Ollama returned ${r.status}: ${body.slice(0, 200)}`,
        });
      }
      const data = await r.json();
      res.json({ text: data?.message?.content || "", model: MODEL });
    } catch (e) {
      if (ctrl.signal.aborted) return;
      const refused = /ECONNREFUSED|fetch failed/i.test(String(e?.cause?.code || e?.message));
      res.status(503).json({
        error: refused
          ? `Cannot reach Ollama at ${OLLAMA_URL}. Install it from ollama.com and make sure it is running.`
          : `Model call failed: ${e.message}`,
      });
    } finally {
      release();
    }
  });

  /* ---------- Jira Cloud REST ---------- */
  const jira = (p, opts = {}) =>
    fetch(`${JIRA_BASE}${p}`, {
      ...opts,
      signal: AbortSignal.timeout(30_000),
      headers: {
        Authorization: "Basic " + Buffer.from(`${env.JIRA_EMAIL}:${env.JIRA_API_TOKEN}`).toString("base64"),
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

  const notReady = (res) => res.status(400).json({
    error: "Jira is not configured. Set JIRA_BASE_URL, JIRA_EMAIL and JIRA_API_TOKEN in the .env file (get the token through your approved secrets process), then restart the server.",
  });

  app.post("/api/jira/connect", async (req, res) => {
    if (!JIRA_READY) return notReady(res);
    const key = String(req.body?.projectKey || "").trim().toUpperCase();
    if (!isValidProjectKey(key)) {
      return res.status(400).json({ error: "Project key looks invalid. Jira keys are 2-10 uppercase letters/digits starting with a letter." });
    }
    try {
      const r = await jira(`/rest/api/3/project/${key}?expand=issueTypes`);
      if (r.status === 401 || r.status === 403) {
        return res.status(401).json({ error: "Jira rejected the credentials or you lack access to this project." });
      }
      if (r.status === 404) return res.status(404).json({ error: `Project ${key} was not found.` });
      if (!r.ok) return res.status(502).json({ error: `Jira returned ${r.status}.` });
      const j = await r.json();
      res.json({
        siteUrl: JIRA_BASE,
        projectName: j.name,
        issueTypes: (j.issueTypes || []).filter((t) => !t.subtask).map((t) => t.name),
      });
    } catch (e) {
      res.status(502).json({ error: `Could not reach Jira: ${e.message}` });
    }
  });

  app.post("/api/jira/issue", async (req, res) => {
    if (!JIRA_READY) return notReady(res);
    const { projectKey, type, title, description, priority, parent, labels } = req.body || {};
    if (!projectKey || !type || !title) {
      return res.status(400).json({ error: "projectKey, type and title are required." });
    }
    if (!isValidProjectKey(projectKey)) {
      return res.status(400).json({ error: "Invalid projectKey." });
    }
    const fields = {
      project: { key: projectKey },
      issuetype: { name: String(type).slice(0, 100) },
      summary: truncateOnWord(String(title), 250),
      description: toADF(description),
      labels: (Array.isArray(labels) ? labels : []).map(sanitizeJiraLabel).filter(Boolean),
    };
    if (priority) fields.priority = { name: String(priority).slice(0, 60) };
    if (parent) fields.parent = { key: String(parent).slice(0, 50) };
    try {
      // Retry once, dropping any optional fields Jira rejected.
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await jira("/rest/api/3/issue", { method: "POST", body: JSON.stringify({ fields }) });
        const body = await r.json().catch(() => ({}));
        if (r.ok) return res.json({ key: body.key, id: body.id });
        const drop = rejectedFields(body);
        if (attempt === 0 && drop.length) {
          drop.forEach((k) => delete fields[k]);
          continue;
        }
        const msg = [...(body.errorMessages || []), ...Object.values(body.errors || {})]
          .join("; ") || `Jira returned ${r.status}`;
        return res.status(r.status === 401 ? 401 : 400).json({ error: msg.slice(0, 300) });
      }
    } catch (e) {
      res.status(502).json({ error: `Could not reach Jira: ${e.message}` });
    }
  });

  /* ---------- static front-end in production ---------- */
  // Only register the SPA fallback for non-/api routes so a wrong API
  // path returns a JSON 404 instead of the React HTML.
  const dist = path.join(__dirname, "..", "dist");
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
  }

  // 404 for any unmatched /api/* route — keeps API errors machine-readable.
  app.use("/api", (_req, res) => res.status(404).json({ error: "Unknown API route." }));

  return app;
}
