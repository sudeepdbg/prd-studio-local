import test from "node:test";
import assert from "node:assert/strict";
import {
  toADF, docCharLimit, rejectedFields,
  isValidProjectKey, sanitizeJiraLabel, truncateOnWord,
} from "./lib.js";

test("toADF builds paragraphs and bullet lists", () => {
  const d = toADF("Intro line\n\nAcceptance criteria:\n- one\n- two\n\nEstimate: 3 pts");
  assert.equal(d.type, "doc");
  assert.deepEqual(
    d.content.map((c) => c.type),
    ["paragraph", "paragraph", "bulletList", "paragraph"]
  );
  assert.equal(d.content[2].content.length, 2);
});

test("toADF never returns an empty document", () => {
  assert.equal(toADF("").content.length, 1);
  assert.equal(toADF(null).content.length, 1);
  assert.equal(toADF(undefined).content.length, 1);
});

test("toADF renders numbered lists", () => {
  const d = toADF("Steps:\n1. first\n2. second\n3. third");
  assert.equal(d.content[1].type, "orderedList");
  assert.equal(d.content[1].content.length, 3);
  assert.equal(d.content[1].attrs.start, 1);
});

test("toADF renders inline bold, italic, code, and links", () => {
  const d = toADF("This is **bold** and *italic* and `code` and [docs](https://example.com)");
  const para = d.content[0];
  assert.equal(para.type, "paragraph");
  const marks = para.content.map((n) => n.marks?.[0]?.type).filter(Boolean);
  assert.deepEqual(marks, ["strong", "em", "code", "link"]);
  // Link text + href
  const linkNode = para.content.find((n) => n.marks?.[0]?.type === "link");
  assert.equal(linkNode.text, "docs");
  assert.equal(linkNode.marks[0].attrs.href, "https://example.com");
});

test("toADF mixes bullets and numbered lists", () => {
  const d = toADF("Plan:\n- a\n- b\n\n1. step one\n2. step two");
  assert.deepEqual(
    d.content.map((c) => c.type),
    ["paragraph", "bulletList", "orderedList"]
  );
});

test("docCharLimit scales with context and has a floor", () => {
  assert.ok(docCharLimit(8192) > 15000);
  assert.equal(docCharLimit(1000), 4000);
});

test("rejectedFields finds optional fields and dedupes", () => {
  assert.deepEqual(
    rejectedFields({ errors: { priority: "x", summary: "y" } }),
    ["priority"]
  );
  assert.deepEqual(rejectedFields(null), []);
  // Returns keys in insertion order
  assert.deepEqual(
    rejectedFields({ errors: { priority: "a", labels: "b", parent: "c" } }),
    ["priority", "labels", "parent"]
  );
});

test("isValidProjectKey accepts valid keys and rejects bad ones", () => {
  assert.equal(isValidProjectKey("PRD"), true);
  assert.equal(isValidProjectKey("AB"), true);
  assert.equal(isValidProjectKey("PROJECT123"), true);
  assert.equal(isValidProjectKey("A"), false); // too short
  assert.equal(isValidProjectKey("1AB"), false); // starts with digit
  assert.equal(isValidProjectKey("ab"), false); // lowercase
  assert.equal(isValidProjectKey("TOOLONGKEY1"), false); // >10 chars
  assert.equal(isValidProjectKey(""), false);
  assert.equal(isValidProjectKey(null), false);
});

test("sanitizeJiraLabel trims, replaces whitespace, drops invalid chars", () => {
  assert.equal(sanitizeJiraLabel("ai generated"), "ai-generated");
  assert.equal(sanitizeJiraLabel("  spaced  "), "spaced");
  // ! @ # are dropped; letters and digits are kept
  assert.equal(sanitizeJiraLabel("a!b@c#d"), "abcd");
  assert.equal(sanitizeJiraLabel(""), "");
  // Long label is capped at 255
  const long = "a".repeat(300);
  assert.equal(sanitizeJiraLabel(long).length, 255);
});

test("truncateOnWord cuts on a word boundary when possible", () => {
  assert.equal(truncateOnWord("hello world", 100), "hello world");
  assert.equal(truncateOnWord("hello world", 8).endsWith("…"), true);
  // No space near the cut => hard cut + ellipsis
  const r = truncateOnWord("abcdefghijklmnopqrstuvwxyz", 10);
  assert.equal(r.endsWith("…"), true);
  assert.ok(r.length <= 11);
});
