/* ================================================================== */
/*  PERSISTENCE  — localStorage wrapper with versioning + migrations    */
/* ================================================================== */

import { TUNABLES, SECTIONS } from "./constants.js";

const SCHEMA_VERSION = 3;

/**
 * Read a JSON value from localStorage. Returns null if missing or
 * unparseable. Sync (localStorage is sync; the async signature is
 * kept for compatibility with the original interface).
 */
async function getJSON(key) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? null : JSON.parse(v);
  } catch {
    return null;
  }
}

async function setJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Migrate an older saved state to the current schema.
 * v1 -> v2: nothing structural changed (we just bumped the key).
 * v2 -> v3: add explicit `schemaVersion`, prune stale AI fields when
 *           includesAI is false.
 */
function migrate(raw) {
  if (!raw || typeof raw !== "object") return null;
  const v = raw.schemaVersion || 2;
  if (v >= SCHEMA_VERSION) return raw;

  let next = { ...raw };

  // v2 -> v3: when the product is not an AI product, drop answers that
  // belong to the AI-only section so stale suggestions don't linger.
  if (v < 3 && next.includesAI === false && next.answers && typeof next.answers === "object") {
    const aiIds = new Set(
      SECTIONS.filter((s) => s.aiOnly).flatMap((s) => s.fields.map(([id]) => id))
    );
    const answers = {};
    for (const [id, a] of Object.entries(next.answers)) {
      if (!aiIds.has(id)) answers[id] = a;
    }
    next = { ...next, answers };
  }

  // Future migrations chain here.
  return { ...next, schemaVersion: SCHEMA_VERSION };
}

/** Load the active project state, migrating if needed. */
export async function loadProject() {
  const raw = await getJSON(TUNABLES.STORAGE_KEY);
  return migrate(raw);
}

/** Save the active project state (debouncing handled by the caller). */
export async function saveProject(state) {
  return setJSON(TUNABLES.STORAGE_KEY, { ...state, schemaVersion: SCHEMA_VERSION });
}

/** Load all saved versions of the active project. */
export const loadVersions = () => getJSON(TUNABLES.VERSIONS_KEY);
export const saveVersions = (v) => setJSON(TUNABLES.VERSIONS_KEY, v);

/* ---------- Multi-project support -------------------------------------- */
// The store keeps a separate list of project metadata (id, name, ts)
// so the user can switch between projects. The active project's full
// state still lives under STORAGE_KEY; switching projects swaps it.

export async function listProjects() {
  const list = (await getJSON(TUNABLES.PROJECTS_KEY)) || [];
  return Array.isArray(list) ? list : [];
}

export async function saveProjectMeta(meta) {
  const list = await listProjects();
  const i = list.findIndex((p) => p.id === meta.id);
  if (i >= 0) list[i] = { ...list[i], ...meta };
  else list.push(meta);
  return setJSON(TUNABLES.PROJECTS_KEY, list);
}

export async function deleteProject(id) {
  const list = await listProjects();
  return setJSON(TUNABLES.PROJECTS_KEY, list.filter((p) => p.id !== id));
}

/** Wipe the active project state (does not touch other projects). */
export function clearActive() {
  try {
    localStorage.removeItem(TUNABLES.STORAGE_KEY);
    localStorage.removeItem(TUNABLES.VERSIONS_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Export the active project as a JSON string for download. */
export async function exportProjectJSON(state, versions) {
  const payload = {
    kind: "prd-studio-project",
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    state: { ...state, schemaVersion: SCHEMA_VERSION },
    versions: versions || [],
  };
  return JSON.stringify(payload, null, 2);
}

/** Validate + parse an imported JSON string. Throws on malformed input. */
export async function importProjectJSON(text) {
  let p;
  try {
    p = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  if (!p || p.kind !== "prd-studio-project" || !p.state) {
    throw new Error("That file is not a PRD Studio project export.");
  }
  return migrate(p.state);
}
