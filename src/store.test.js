import test from "node:test";
import assert from "node:assert/strict";

// localStorage shim so store.js can be imported under Node.
globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
  setItem(k, v) { this._m.set(k, String(v)); },
  removeItem(k) { this._m.delete(k); },
};

const { importProjectJSON } = await import("./store.js");

test("migrate prunes AI answers when includesAI is false", async () => {
  const payload = JSON.stringify({
    kind: "prd-studio-project",
    state: {
      schemaVersion: 2,
      includesAI: false,
      answers: {
        problem: { text: "keep me", status: "filled" },
        aiuse: { text: "drop me", status: "ai" },
        airisk: { text: "drop me too", status: "ai" },
      },
    },
  });
  const state = await importProjectJSON(payload);
  assert.equal(state.schemaVersion, 3);
  assert.ok(state.answers.problem, "non-AI field kept");
  assert.equal(state.answers.aiuse, undefined, "AI field pruned");
  assert.equal(state.answers.airisk, undefined, "AI field pruned");
});

test("migrate keeps AI answers when includesAI is true", async () => {
  const payload = JSON.stringify({
    kind: "prd-studio-project",
    state: { schemaVersion: 2, includesAI: true, answers: { aiuse: { text: "keep", status: "ai" } } },
  });
  const state = await importProjectJSON(payload);
  assert.ok(state.answers.aiuse, "AI field kept for AI products");
});

test("importProjectJSON rejects non-project files", async () => {
  await assert.rejects(() => importProjectJSON('{"kind":"something-else"}'));
  await assert.rejects(() => importProjectJSON("not json"));
});
