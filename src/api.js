/* ================================================================== */
/*  LLM API CLIENT                                                      */
/*  Wraps /api/llm with:                                                */
/*    - AbortSignal forwarding for cancellation                        */
/*    - Timeout enforcement                                             */
/*    - Optional retry on transient failures                           */
/*    - In-flight request dedup (same payload => same promise)         */
/* ================================================================== */

import { TUNABLES } from "./constants.js";
import { parseJSON, isConnectionError, sleep } from "./utils.js";

const textOf = (blocks) => blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n");

/**
 * Low-level call to /api/llm. Returns an array of content blocks
 * (matching the original shape: [{ type: "text", text }]).
 *
 * Cancellation: forward the caller's AbortSignal. If the request is
 * aborted by the caller, we throw Error("Cancelled"). If aborted by
 * the timeout, we throw Error("Timed out after Ns").
 */
export async function askFull({
  system,
  content,
  schema,
  signal,
  timeoutMs = TUNABLES.LLM_TIMEOUT_MS,
  maxTokens = TUNABLES.LLM_MAX_TOKENS,
}) {
  const user = (Array.isArray(content) ? content : [{ type: "text", text: String(content) }])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n\n");

  const ctrl = new AbortController();
  let timedOut = false;
  const onAbort = () => ctrl.abort();
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener("abort", onAbort);
  }
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, timeoutMs);

  try {
    const res = await fetch("/api/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system, user, schema, maxTokens }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      let m = "";
      try { m = (await res.json())?.error || ""; } catch { /* ignore */ }
      throw new Error(m || `Model server error ${res.status}`);
    }
    const j = await res.json();
    return [{ type: "text", text: j.text || "" }];
  } catch (e) {
    if (e.name === "AbortError") {
      throw new Error(timedOut ? `Timed out after ${Math.round(timeoutMs / 1000)}s` : "Cancelled");
    }
    throw e;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}

/** Plain-text variant: returns the model's text directly. */
export const ask = async (args) => textOf(await askFull(args));

/**
 * JSON variant with optional retry. Each attempt re-parses the model
 * output; "Cancelled" is re-thrown immediately (don't retry cancels).
 */
export async function askJSON(args, tries = 2) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return parseJSON(await ask(args));
    } catch (e) {
      last = e;
      if (e.message === "Cancelled") throw e;
    }
  }
  throw last;
}

/**
 * Retry wrapper: re-runs `fn` up to `retries+1` times if the failure
 * looks transient (timeout or connection error). Cancellation is
 * never retried.
 */
export async function withRetry(fn, { retries = TUNABLES.LLM_RETRIES, backoffMs = 800 } = {}) {
  let last;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn(i);
    } catch (e) {
      last = e;
      if (e.message === "Cancelled") throw e;
      const transient = /Timed out|Cannot reach Ollama|Model call failed/i.test(e.message) || isConnectionError(e);
      if (!transient || i === retries) throw e;
      await sleep(backoffMs * (i + 1));
    }
  }
  throw last;
}

/* ---------- Request deduplication ---------------------------------------- */
// Two components asking for the same thing at the same time should share
// one network call. We key on a stable JSON serialization of the args.

const inflight = new Map();

const keyOf = (args) => {
  try {
    return JSON.stringify({
      system: args.system || "",
      user: Array.isArray(args.content)
        ? args.content.map((b) => b.text || "").join("\n\n")
        : String(args.content || ""),
      schema: args.schema || null,
      maxTokens: args.maxTokens || TUNABLES.LLM_MAX_TOKENS,
    });
  } catch {
    return null;
  }
};

/**
 * Wrap a shared promise so that THIS caller's signal/timeout can reject
 * its own await without disturbing the shared request or other waiters.
 * The underlying request keeps running for everyone else; only this
 * caller's view of it is cancelled.
 */
function perCaller(shared, { signal, timeoutMs = TUNABLES.LLM_TIMEOUT_MS }) {
  if (!signal && !timeoutMs) return shared;
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (fn) => (v) => { if (!settled) { settled = true; cleanup(); fn(v); } };
    const onAbort = () => done(reject)(new Error("Cancelled"));
    const timer = timeoutMs
      ? setTimeout(() => done(reject)(new Error(`Timed out after ${Math.round(timeoutMs / 1000)}s`)), timeoutMs)
      : null;
    function cleanup() {
      if (timer) clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onAbort);
    }
    if (signal) {
      if (signal.aborted) return done(reject)(new Error("Cancelled"));
      signal.addEventListener("abort", onAbort);
    }
    shared.then(done(resolve), done(reject));
  });
}

/**
 * askFull + dedup: if an identical request is already in flight, share
 * one network call. The shared request is launched WITHOUT any single
 * caller's signal, so one caller cancelling never aborts the request
 * for the others. Each caller's own signal/timeout is applied locally
 * via perCaller(), so cancellation and timeouts remain per-caller.
 */
export async function askFullDedup(args) {
  const key = keyOf(args);
  if (!key) return askFull(args);
  let shared = inflight.get(key);
  if (!shared) {
    // Strip per-caller concerns from the shared request.
    const { signal, timeoutMs, ...shareable } = args;
    shared = askFull(shareable).finally(() => inflight.delete(key));
    inflight.set(key, shared);
  }
  return perCaller(shared, { signal: args.signal, timeoutMs: args.timeoutMs });
}

/** ask + dedup. */
export const askDedup = async (args) => textOf(await askFullDedup(args));

/** askJSON + dedup. */
export async function askJSONDedup(args, tries = 2) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return parseJSON(await askDedup(args));
    } catch (e) {
      last = e;
      if (e.message === "Cancelled") throw e;
    }
  }
  throw last;
}
