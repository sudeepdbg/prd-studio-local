// Pure helpers (unit-tested in lib.test.js).

/**
 * Convert simple Markdown-ish text into Atlassian Document Format.
 *
 * Supports:
 *   - paragraphs (blank-line separated)
 *   - bullet lists ("- " or "* ")
 *   - numbered lists ("1. ", "2. ")
 *   - **bold** and *italic* inline marks
 *   - `code` spans
 *   - [link text](url) -> text + " (url)"
 *
 * Anything else becomes a plain paragraph. The output is always a valid
 * ADF doc with at least one node, never empty.
 */
export function toADF(text) {
  const content = [];
  let bullets = [];
  let numbers = [];

  const flushBullets = () => {
    if (!bullets.length) return;
    content.push({
      type: "bulletList",
      content: bullets.map((b) => ({
        type: "listItem",
        content: [{ type: "paragraph", content: inlineToADF(b) }],
      })),
    });
    bullets = [];
  };

  const flushNumbers = () => {
    if (!numbers.length) return;
    content.push({
      type: "orderedList",
      attrs: { start: numbers[0].num },
      content: numbers.map((n) => ({
        type: "listItem",
        content: [{ type: "paragraph", content: inlineToADF(n.text) }],
      })),
    });
    numbers = [];
  };

  const flushLists = () => { flushBullets(); flushNumbers(); };

  for (const raw of String(text || "").split("\n")) {
    const line = raw.trim();
    if (!line) { flushLists(); continue; }

    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet && bullet[1]) { bullets.push(bullet[1]); continue; }

    const numbered = line.match(/^(\d+)\.\s+(.*)$/);
    if (numbered && numbered[2]) {
      numbers.push({ num: Number(numbered[1]), text: numbered[2] });
      continue;
    }

    flushLists();
    content.push({ type: "paragraph", content: inlineToADF(line) });
  }
  flushLists();

  if (!content.length) {
    content.push({ type: "paragraph", content: [{ type: "text", text: "-" }] });
  }
  return { type: "doc", version: 1, content };
}

/**
 * Parse inline markdown (**bold**, *italic*, `code`, [text](url)) into
 * ADF text marks. Plain text segments become unmarked text nodes.
 */
function inlineToADF(line) {
  const out = [];
  // Combined regex: matches **bold**, *italic*, `code`, or [text](url).
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) out.push({ type: "text", text: line.slice(last, m.index) });
    if (m[1] != null) {
      out.push({ type: "text", text: m[1], marks: [{ type: "strong" }] });
    } else if (m[2] != null) {
      out.push({ type: "text", text: m[2], marks: [{ type: "em" }] });
    } else if (m[3] != null) {
      out.push({ type: "text", text: m[3], marks: [{ type: "code" }] });
    } else if (m[4] != null && m[5] != null) {
      out.push({
        type: "text",
        text: m[4],
        marks: [{ type: "link", attrs: { href: m[5] } }],
      });
    }
    last = re.lastIndex;
  }
  if (last < line.length) out.push({ type: "text", text: line.slice(last) });
  return out.length ? out : [{ type: "text", text: line }];
}

/**
 * Context budget -> max characters of source document we can safely send.
 *
 * The model's context window is shared between the prompt template, the
 * source document, and the generated answer. We reserve ~2800 tokens
 * for prompt+answer and convert the remainder to characters.
 *
 * Heuristic: English text averages ~3.5 chars/token, CJK ~1.5 chars/token.
 * We use a blended average of 3.0 to stay safe for mixed-language PRDs.
 * Floor: 4000 chars so very small context windows still work.
 */
export function docCharLimit(numCtx) {
  const reserved = 2800;
  const charsPerToken = 3.0;
  return Math.max(4000, Math.floor((numCtx - reserved) * charsPerToken));
}

/**
 * Which optional fields did Jira reject? Used to retry without them.
 * Returns a deduplicated, ordered list of field names.
 */
export function rejectedFields(body) {
  const errs = body && typeof body === "object" ? body.errors || {} : {};
  const drop = new Set(["priority", "parent", "labels"]);
  return Object.keys(errs).filter((k) => drop.has(k));
}

/**
 * Validate a Jira project key. Jira Cloud keys are 2-10 uppercase
 * alphanumeric characters, starting with a letter.
 */
export function isValidProjectKey(key) {
  return /^[A-Z][A-Z0-9]{1,9}$/.test(String(key || ""));
}

/**
 * Sanitize a Jira label: trim, replace whitespace with hyphens, drop
 * characters Jira rejects (anything but [A-Za-z0-9-_]), cap at 255.
 */
export function sanitizeJiraLabel(label) {
  return String(label || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9-_]/g, "")
    .slice(0, 255);
}

/**
 * Truncate a string to n chars, ending on a word boundary when possible.
 */
export function truncateOnWord(s, n) {
  const str = String(s || "");
  if (str.length <= n) return str;
  const cut = str.slice(0, n);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > n * 0.7 ? cut.slice(0, lastSpace) : cut).trim() + "…";
}
