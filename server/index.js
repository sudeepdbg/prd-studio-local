import "dotenv/config";
import { createServer } from "./app.js";

const PORT = Number(process.env.PORT || 8787);
const MODEL = process.env.OLLAMA_MODEL || "phi3.5";
const JIRA_READY = Boolean(process.env.JIRA_BASE_URL && process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN);

createServer().listen(PORT, "127.0.0.1", () => {
  console.log(`PRD Studio API on http://127.0.0.1:${PORT}  |  model: ${MODEL}  |  Jira: ${JIRA_READY ? "configured" : "not configured"}`);
});
