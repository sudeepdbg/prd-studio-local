/* ================================================================== */
/*  PURE UTILITIES  — no React, no fetch, no localStorage.              */
/*  Unit-testable in isolation.                                         */
/* ================================================================== */

import { HEADER_FIELDS, SECTIONS, FIELDS, FOOTER, ANSWER_STATE } from "./constants.js";

/** Short random id, good enough for client-side keys. */
export const uid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 9));

/** Split an array into chunks of size n. */
export const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

/**
 * Run `fn` over every item with at most `n` workers in flight.
 * Returns an array of { ok, v } | { ok: false, e } aligned with the input.
 * Does not throw — failures are captured per-item.
 */
export const pool = async (items, n, fn) => {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      try {
        out[k] = { ok: true, v: await fn(items[k], k) };
      } catch (e) {
        out[k] = { ok: false, e };
      }
    }
  });
  await Promise.all(workers);
  return out;
};

/**
 * Coerce any LLM-produced value into a string. Walks common shapes
 * (text / label / content / message / title / name / value) and joins
 * arrays or object values with spaces.
 */
export const str = (v) => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    const pick = v.text ?? v.label ?? v.content ?? v.message ?? v.title ?? v.name ?? v.value;
    return pick != null ? str(pick) : Object.values(v).map(str).join(" ");
  }
  return String(v);
};

/** Coerce a value into an array of trimmed, non-empty strings. */
export const strs = (v) => {
  if (Array.isArray(v)) return v.map(str).map((s) => s).filter(Boolean);
  if (typeof v === "string" && v) return v.split("\n").map((s) => s.trim()).filter(Boolean);
  return [];
};

/**
 * Close a truncated JSON document at the last complete element.
 * Used to recover when a local model runs out of tokens mid-output.
 *
 * Strategy: walk the string tracking string-mode, object/array nesting.
 * Whenever the stack returns to a stable state we record the position.
 * At EOF we slice to the last stable position and append the matching
 * closers for whatever was still open at that point.
 */
export const repairJSON = (s) => {
  const stack = [];
  let inStr = false;
  let esc = false;
  let lastGood = -1;
  let goodStack = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") {
      stack.pop();
      lastGood = i;
      goodStack = [...stack];
    }
  }
  if (lastGood < 0) throw new Error("Unrepairable JSON");
  return (
    s.slice(0, lastGood + 1) +
    goodStack.reverse().map((c) => (c === "{" ? "}" : "]")).join("")
  );
};

/** Strip markdown code fences and parse the embedded JSON. */
export const parseJSON = (text) => {
  const clean = String(text || "").replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{");
  if (start < 0) throw new Error("The model did not return JSON");
  const end = clean.lastIndexOf("}");
  try {
    return JSON.parse(clean.slice(start, end + 1));
  } catch {
    return JSON.parse(repairJSON(clean.slice(start)));
  }
};

/** Sanitize a Jira label: trim, collapse spaces to hyphens, drop invalid chars. */
export const sanitizeLabel = (l) =>
  String(l || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .slice(0, 255);

/** Build the context string sent to the model with each answer trimmed. */
export const ctxOf = (header, answers) => {
  const h = HEADER_FIELDS.map(([k, l]) => (header[k] ? `${l}: ${header[k]}` : ""))
    .filter(Boolean)
    .join("\n");
  const body = FIELDS.filter((f) => answers[f.id]?.text)
    .map((f) => `[${f.section} / ${f.topic}] ${String(answers[f.id].text).slice(0, 400)}`)
    .join("\n");
  return `${h}\n${body}`.slice(0, 14000);
};

/** Map an answer object to a UI state: filled | partial | missing | ai. */
export const answerState = (a) => {
  if (!a || !a.text?.trim()) return ANSWER_STATE.MISSING;
  if (a.source === "ai") return ANSWER_STATE.AI;
  if (a.status === "partial") return ANSWER_STATE.PARTIAL;
  return ANSWER_STATE.FILLED;
};

/** Readiness score: filled=1, ai=0.5, partial=0.6, missing=0. */
export const readinessOf = (answers, activeFields) => {
  if (!Object.keys(answers).length) return 0;
  const w = { filled: 1, partial: 0.6, ai: 0.5, missing: 0 };
  const sum = activeFields.reduce((n, f) => n + (w[answerState(answers[f.id])] || 0), 0);
  return Math.round((100 * sum) / activeFields.length);
};

/** Per-state counts for the readiness bar. */
export const countsOf = (answers, activeFields) =>
  activeFields.reduce((m, f) => {
    const k = answerState(answers[f.id]);
    m[k] = (m[k] || 0) + 1;
    return m;
  }, {});

/* ================================================================== */
/*  EXPORT HELPERS                                                      */
/* ================================================================== */

export function toMarkdown(header, answers, includesAI) {
  const L = [`# Product Requirements Document: ${header.product || "Untitled"}`, ""];
  HEADER_FIELDS.forEach(([k, label]) => L.push(`- **${label}:** ${header[k] || "_not provided_"}`));
  SECTIONS.forEach((s, i) => {
    if (s.aiOnly && !includesAI) return;
    L.push("", `## ${i + 1}. ${s.name}`);
    s.fields.forEach(([id, topic]) => {
      const a = answers[id];
      const tag = a?.text && a.source === "ai" ? " _[AI suggested: unverified]_" : "";
      L.push("", `**${topic}**${tag}`, "", a?.text || "_Not yet answered_");
    });
  });
  L.push("", "---", FOOTER);
  return L.join("\n");
}

export function toBlankTemplate(includesAI) {
  const L = [
    "# Product Requirements Document: Generic Template",
    "",
    ...HEADER_FIELDS.map(([, l]) => `- **${l}:** `),
  ];
  SECTIONS.forEach((s, i) => {
    if (s.aiOnly && !includesAI) return;
    L.push("", `## ${i + 1}. ${s.name}`);
    s.fields.forEach(([, topic, q]) => L.push("", `**${topic}**`, `_${q}_`, "", ""));
  });
  L.push("---", FOOTER);
  return L.join("\n");
}

export const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export function jiraDescription(s) {
  const ac = (s.acceptance_criteria || []).filter(Boolean).map((a) => `- ${a}`).join("\n");
  const trace = [
    s.source ? `PRD source: ${s.source}` : "",
    s.screen ? `Prototype screen: ${s.screen}` : "",
    s.points ? `Estimate: ${s.points} pts` : "",
  ].filter(Boolean).join("\n");
  return `${s.description || ""}${ac ? `\n\nAcceptance criteria:\n${ac}` : ""}${trace ? `\n\n${trace}` : ""}\n\n${FOOTER}`;
}

export function toJiraCsv(epics) {
  const rows = [["Issue Id", "Parent", "Issue Type", "Summary", "Description", "Priority", "Labels"]];
  let n = 1;
  epics.filter((e) => e.include).forEach((e) => {
    const eid = n++;
    rows.push([eid, "", "Epic", e.title, `${e.summary || ""}\n\n${FOOTER}`, "", "ai-generated"]);
    e.stories.filter((s) => s.include).forEach((s) =>
      rows.push([n++, eid, "Story", s.title, jiraDescription(s), s.priority || "Medium", "ai-generated"])
    );
  });
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}

/** Read a File as base64 (kept for parity with the original code). */
export const toB64 = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1]);
    r.onerror = () => rej(new Error("Could not read file"));
    r.readAsDataURL(file);
  });

/** Format bytes as a human-readable string. */
export const formatBytes = (n) => {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(n) / Math.log(1024));
  return `${(n / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${u[i]}`;
};

/** Clamp a number into [lo, hi]. */
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** Promise-based delay. */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** True if an error looks like a network/connection failure. */
export const isConnectionError = (e) =>
  /ECONNREFUSED|fetch failed|network|NetworkError/i.test(String(e?.cause?.code || e?.message || ""));
