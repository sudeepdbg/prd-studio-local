/* ================================================================== */
/*  JSON SCHEMAS for structured LLM output                              */
/* ================================================================== */

import { HEADER_FIELDS } from "./constants.js";

/** Schema for the parser: one entry per field id with text/status/evidence. */
export const parseSchema = (ids) => ({
  type: "object",
  required: ["answers"],
  properties: {
    answers: {
      type: "object",
      required: ids,
      properties: Object.fromEntries(
        ids.map((id) => [
          id,
          {
            type: "object",
            required: ["text", "status", "evidence"],
            properties: {
              text: { type: "string" },
              status: { type: "string", enum: ["filled", "partial", "missing"] },
              evidence: { type: "string" },
            },
          },
        ])
      ),
    },
  },
});

/** Schema for header extraction. */
export const headerSchema = {
  type: "object",
  required: ["header"],
  properties: {
    header: {
      type: "object",
      required: HEADER_FIELDS.map(([k]) => k),
      properties: Object.fromEntries(
        HEADER_FIELDS.map(([k]) => [k, { type: "string" }])
      ),
    },
  },
};

/** Schema for gap filling: a flat map of id -> text. */
export const fillSchema = (ids) => ({
  type: "object",
  required: ["answers"],
  properties: {
    answers: {
      type: "object",
      required: ids,
      properties: Object.fromEntries(
        ids.map((id) => [id, { type: "string" }])
      ),
    },
  },
});

/** Schema for the PRD review: score + summary + findings[]. */
export const reviewSchema = {
  type: "object",
  required: ["score", "summary", "findings"],
  properties: {
    score: { type: "number" },
    summary: { type: "string" },
    findings: {
      type: "array",
      items: {
        type: "object",
        required: ["field", "severity", "issue", "fix"],
        properties: {
          field: { type: "string" },
          severity: { type: "string", enum: ["high", "medium", "low"] },
          issue: { type: "string" },
          fix: { type: "string" },
        },
      },
    },
  },
};

/** Schema for the single-field improvement: just a text string. */
export const improveSchema = {
  type: "object",
  required: ["text"],
  properties: { text: { type: "string" } },
};
