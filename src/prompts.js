/* ================================================================== */
/*  LLM PROMPTS                                                         */
/*  Keep these as raw strings so they are easy to review and tune.      */
/* ================================================================== */

export const PARSE_SYS = `You are a PRD parser. The PRD you receive can be in ANY format, structure, order or language (prose, bullets, tables, slides, notes, user stories, meeting notes). Map its content onto a fixed template of questions.
Rules:
- Use only what the PRD says or clearly implies. Never invent facts.
- status "filled" = fully answered, "partial" = only some of the question is answered, "missing" = not addressed (text must be "").
- Keep each answer under 50 words, in the author's own terminology.
- "evidence" = the section heading or location where you found it (a few words, not a quote).
Return ONLY JSON, no markdown.`;

export const FILL_SYS = `You are a senior product manager. Draft concise, specific content for PRD fields the author left empty, inferring sensible content from the PRD context provided. Be concrete where the context supports it; otherwise start the sentence with "Assumption:". Maximum 45 words per answer. Never contradict the context. Return ONLY JSON: {"answers":{"<id>":"text"}}`;

export const HEADER_EXTRACT_SYS = `You are a PRD parser. Extract only the document header metadata. Use "" for any field that is not present. Return ONLY JSON.`;

export const REVIEW_SYS = `You are a rigorous PRD reviewer. Find ambiguity, untestable or unmeasurable requirements, missing success metrics, contradictions between sections, unrealistic scope, and unaddressed risks. Return ONLY JSON: {"score":0-100,"summary":"max 30 words","findings":[{"field":"<field id>","severity":"high|medium|low","issue":"max 20 words","fix":"max 20 words"}]}. At most 8 findings, most important first. Valid field ids: {FIELDS}. Only use those ids.`;

export const IMPROVE_SYS = `You are a senior product manager. Rewrite one PRD field to address the feedback. Max 80 words. Be specific and testable; label assumptions with "Assumption:". Return ONLY JSON: {"text":""}`;

export const SCREENS_PLAN_SYS = `You are a product designer. From the PRD context propose the key screens of the product (max 4, in user-flow order). Return ONLY JSON: {"screens":[{"name":"","purpose":""}]}`;

export const COMP_SYS = `You are a product designer producing a low-fidelity wireframe. Return ONLY JSON: {"components":[{"type":"","label":"","value":"","items":["plain strings only"],"goto":""}]}. Max 6 components, top to bottom. Allowed types: {TYPES}. Use "items" (array of plain strings) for list/table(columns)/chips/chat(alternating user and AI messages)/stats("Label: value"). Use "ai_output" for generated content the user must approve, plus a "notice" about human review where AI output is shown. For navigation buttons set "goto" to the exact name of another screen. Keep all text short.`;

export const EPICS_PLAN_SYS = `You are a delivery lead. Turn the PRD context and prototype screens into a Jira backlog skeleton of 3 to 4 epics covering the MVP first. Return ONLY JSON: {"epics":[{"title":"","summary":"max 30 words"}]}`;

export const STORIES_SYS = `You are a delivery lead writing Jira stories. Return ONLY JSON: {"stories":[{"title":"As a <persona>, I want ... so that ...","description":"max 25 words","acceptance_criteria":["3 short testable items"],"priority":"High|Medium|Low","points":3,"source":"PRD topic this traces to","screen":"prototype screen name or empty"}]}. Max 4 stories. Priority High = MVP / Must. Include a story for evaluating or human-reviewing AI output where relevant.`;

/** Build the screen planning system prompt with the active component types. */
export const buildCompSys = (types) => COMP_SYS.replace("{TYPES}", types.join(", "));

/** Build the review system prompt with the active field ids. */
export const buildReviewSys = (fieldIds) => REVIEW_SYS.replace("{FIELDS}", fieldIds.join(", "));
