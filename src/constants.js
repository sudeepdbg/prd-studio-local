/* ================================================================== */
/*  PRD TEMPLATE + UI CONSTANTS                                         */
/*  Edit SECTIONS to change the template; the parser, review sheet,    */
/*  AI gap-filling and exports all follow from this data.               */
/* ================================================================== */

export const SECTIONS = [
  { id: "overview", name: "Overview & Context", fields: [
    ["problem", "Problem statement", "What problem are we solving, for whom, and why does it matter?"],
    ["background", "Background & context", "What history, data or research sits behind this initiative? Why now?"],
    ["vision", "Vision / value proposition", "What does success look like for users and the business, in one or two sentences?"],
  ]},
  { id: "goals", name: "Goals & Success Metrics", fields: [
    ["goals", "Goals & objectives", "What outcomes must this product achieve?"],
    ["nongoals", "Non-goals / out of scope", "What are we explicitly not doing in this release?"],
    ["metrics", "Success metrics (KPIs)", "Which metrics define success? Give baseline, target and how each is measured."],
  ]},
  { id: "users", name: "Users & Needs", fields: [
    ["personas", "Target users / personas", "Who are the primary and secondary users? What are their roles, goals and context?"],
    ["needs", "Needs & pain-points", "What friction, unmet needs or jobs-to-be-done do they have? Which are most frequent and severe?"],
    ["journey", "Current-state journey", "How do users accomplish this today, step by step, and where does it break down?"],
  ]},
  { id: "market", name: "Market & Competition", fields: [
    ["market", "Market context", "What is the market size, growth and key trends (tailwinds and headwinds)?"],
    ["competitors", "Competitors & alternatives", "Who else solves this problem, including manual workarounds? How do they compare?"],
    ["diff", "Differentiation", "Why will users choose this? What is the unfair advantage?"],
  ]},
  { id: "solution", name: "Solution", fields: [
    ["solution", "Solution overview", "What are we building? Describe it in plain language."],
    ["features", "Key features (prioritised)", "List the features and rank them Must / Should / Could / Won't."],
    ["stories", "User stories & use cases", "What are the main stories, written as 'As a ... I want ... so that ...'?"],
    ["flows", "Key user flows", "What are the primary end-to-end flows, including the happy path and key error paths?"],
  ]},
  { id: "reqs", name: "Requirements", fields: [
    ["functional", "Functional requirements", "What must the system do? Number each requirement and make it testable."],
    ["nonfunctional", "Non-functional requirements", "What are the performance, scalability, reliability, security, accessibility and localisation needs?"],
    ["data", "Data requirements", "What data is needed, where does it come from, and how are privacy, retention and consent handled?"],
    ["integrations", "Integrations & dependencies", "Which systems, APIs, teams or vendors does this depend on?"],
  ]},
  { id: "ai", name: "AI / ML Considerations", aiOnly: true, hint: "Only for products that include AI", fields: [
    ["aiuse", "AI use case & suitability", "Why is AI the right approach? Which task does it perform, and what are the non-AI alternatives?"],
    ["aimodel", "Model & approach", "What approach will be used (model, prompting, retrieval, fine-tuning, build vs. buy)?"],
    ["aidata", "Data sources & quality", "Which data feeds the AI, what is its quality, and do we have the rights to use it?"],
    ["aihuman", "Human oversight & guardrails", "Where does a human review or approve output? What are the fallbacks when the AI is wrong or unavailable?"],
    ["aieval", "Evaluation & acceptance thresholds", "How will quality be measured (test sets, metrics), and what thresholds must be met before launch?"],
    ["airisk", "Responsible AI risks", "What are the risks (inaccuracy, bias, privacy, security, misuse) and how are they mitigated?"],
  ]},
  { id: "ux", name: "Design & UX", fields: [
    ["screens", "Key screens & components", "Which screens or components are needed, and what does each one do?"],
    ["uxprin", "UX principles & accessibility", "What design principles, accessibility standards and content tone apply?"],
  ]},
  { id: "release", name: "Release & Operations", fields: [
    ["mvp", "MVP scope & phasing", "What is in the MVP, and what comes in later phases?"],
    ["timeline", "Timeline & milestones", "What are the key milestones, dates and owners?"],
    ["rollout", "Launch & rollout", "How will this be launched (pilot, staged rollout), supported and communicated?"],
    ["analytics", "Analytics & monitoring", "What will be tracked, and how will feedback loop back into the product?"],
  ]},
  { id: "risks", name: "Risks & Open Items", fields: [
    ["risks", "Risks & mitigations", "What could go wrong (delivery, adoption, legal, technical), and what is the plan for each?"],
    ["assumptions", "Assumptions", "What are we assuming to be true that has not yet been validated?"],
    ["questions", "Open questions", "What still needs an answer, who owns it, and by when?"],
  ]},
];

export const HEADER_FIELDS = [
  ["product", "Product / feature name"],
  ["owner", "Owner"],
  ["stakeholders", "Stakeholders"],
  ["industry", "Industry / domain"],
  ["status", "Status"],
  ["version", "Version"],
  ["date", "Date started"],
];

/** Flat lookup of every field with its parent section, precomputed once. */
export const FIELDS = SECTIONS.flatMap((s) =>
  s.fields.map(([id, topic, q]) => ({
    id, topic, q, section: s.name, sectionId: s.id, aiOnly: !!s.aiOnly,
  }))
);

export const activeFieldsOf = (includesAI) =>
  FIELDS.filter((f) => includesAI || !f.aiOnly);

export const FOOTER =
  "AI-generated draft (local model). Keep internal until a human has reviewed and verified the content.";

/** Component types supported by the wireframe renderer. */
export const TYPES = [
  "header", "text", "input", "textarea", "select", "button",
  "list", "card", "table", "chips", "stats", "image", "chat",
  "ai_output", "notice",
];

/* ---------- State machine constants (replaces bare string literals) ---------- */

export const STEP = Object.freeze({
  IMPORT: "import",
  REVIEW: "review",
  PROTO: "proto",
  JIRA: "jira",
});

export const ROLE = Object.freeze({
  VIEWER: "viewer",
  EDITOR: "editor",
  OWNER: "owner",
});

export const CONN_STATUS = Object.freeze({
  IDLE: "idle",
  CONNECTING: "connecting",
  OK: "ok",
  ERROR: "error",
});

export const JIRA_STATUS = Object.freeze({
  CREATING: "creating",
  DONE: "done",
  ERROR: "error",
});

export const FILTER = Object.freeze({
  ALL: "all",
  GAPS: "gaps",
  AI: "ai",
});

export const DEVICE = Object.freeze({
  DESKTOP: "desktop",
  MOBILE: "mobile",
});

export const ANSWER_STATE = Object.freeze({
  FILLED: "filled",
  PARTIAL: "partial",
  MISSING: "missing",
  AI: "ai",
});

export const PRIORITY = Object.freeze(["High", "Medium", "Low"]);

/* ---------- Tunables (kept in one place) ---------- */

export const TUNABLES = Object.freeze({
  // Chunk sizes for batched LLM calls
  PARSE_CHUNK: 5,
  FILL_CHUNK: 4,
  // Concurrency for in-client pools
  POOL_WORKERS: 3,
  POOL_WORKERS_PARSE: 4,
  // Network timeouts (ms)
  LLM_TIMEOUT_MS: 600_000,
  JIRA_TIMEOUT_MS: 30_000,
  HEALTH_TIMEOUT_MS: 2_500,
  // Persistence
  SAVE_DEBOUNCE_MS: 900,
  STORAGE_KEY: "prdstudio:v2",
  VERSIONS_KEY: "prdstudio:v2:versions",
  PROJECTS_KEY: "prdstudio:v2:projects",
  MAX_VERSIONS: 10,
  MAX_PASTED_PERSIST: 200_000,
  // Undo / redo
  UNDO_DEBOUNCE_MS: 700,
  UNDO_STACK_MAX: 60,
  // LLM token cap (per request) — server caps at 2000
  LLM_MAX_TOKENS: 1200,
  // Retry behaviour for transient LLM failures
  LLM_RETRIES: 1,
  // Hard limits for safe UX
  MAX_UPLOAD_BYTES: 25 * 1024 * 1024, // 25 MB
  MAX_SCREENS: 8,
  MAX_EPICS: 6,
  MAX_STORIES_PER_EPIC: 6,
});

export const SAMPLE = `Project: Reply Assist
Owner: Priya N. - started 3 Sept 2026

Why we're doing this
We run a subscription video-streaming service with ~4M paying subscribers. Our support team (B2C tickets, mostly billing and playback issues) is drowning: ticket volume grew 40% YoY. Competitors are shipping chatbots; our edge is a very large, well-tagged ticket history and a strong brand.

Who it's for
Tier-1 support agents (internal). Subscribers never see the AI directly in v1.

What hurts today
Agents spend ~6 minutes per ticket searching old tickets and macros. Billing disputes are the most frequent and the angriest. Agents also lose context when tickets are escalated. Today: ticket arrives -> agent reads -> searches knowledge base -> copies a macro -> edits -> sends.

Ideas we brainstormed
Auto-draft replies, ticket summarisation for escalations, a "similar tickets" side panel, tone coach, auto-tagging, a subscriber-facing chatbot.
Short-list: 1) draft replies for billing disputes, 2) escalation summaries, 3) similar tickets panel. Chatbot parked for later.

Notes: needs a human-in-the-loop approve step. Existing product = Agent Desk (web app). Target: cut handle time from 6 to 4 minutes.`;
