# PRD Studio (local)

> Turn any PRD into a structured document, an editable click-through prototype,
> and a Jira backlog — running **entirely on your own machine** with a local
> LLM. No data leaves your computer.

<p>
  <a href="https://github.com/sudkumar/prd-studio-local/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/sudkumar/prd-studio-local/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg"></a>
  <img alt="Node >= 18" src="https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg">
  <img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-blue.svg">
  <img alt="Local-first" src="https://img.shields.io/badge/local--first-no%20cloud-5b2fd4.svg">
</p>

PRD Studio reads a product requirements document in whatever shape it's in —
pasted text, Word, PDF, Markdown — maps it onto a clean 10-section template,
drafts the gaps with AI, generates an interactive prototype, and turns the
whole thing into a Jira backlog. Everything runs locally against an
[Ollama](https://ollama.com) model, so your PRD never leaves your machine.

## Contents

- [What runs where](#what-runs-where)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Jira (optional)](#jira-optional)
- [Tests](#tests)
- [Your data and moving it between machines](#your-data-and-moving-it-between-machines)
- [Tuning](#tuning)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Project layout](#project-layout)
- [Contributing](#contributing)
- [License](#license)

## What runs where

| Concern             | How it works locally                                   |
|---------------------|--------------------------------------------------------|
| AI parsing/drafting | A local model served by **Ollama**                     |
| PDF/DOCX reading    | Extracted in your browser (images are not supported)   |
| Saved work          | Your browser's `localStorage` (export/import to move it)|
| Jira creation       | The local server calls the **Jira Cloud REST API**     |

Nothing calls any hosted AI provider.

## Prerequisites

- **Node.js 18+**
- **[Ollama](https://ollama.com)** installed and running
- A model pulled locally:
  ```bash
  ollama pull phi3.5          # ~2.2 GB, light default (MIT)
  # or, with 8 GB+ RAM, better quality:
  ollama pull qwen2.5:7b      # Apache-2.0
  ```
  If you pull a different model, set `OLLAMA_MODEL` in `.env` to match.

## Setup

```bash
npm install
cp .env.example .env     # then edit .env
npm run dev              # API on :8787, web on http://localhost:5173
```

Open http://localhost:5173. The badge in the top bar tells you whether the
model is reachable and installed.

### Production (single process)

```bash
npm run build            # builds the front-end into dist/
npm start                # serves the app and the API on :8787
```

## Jira (optional)

Needed only for the "Create in Jira" button. The CSV export works without it.

1. Create a Jira API token and obtain it through your approved secrets process.
2. In `.env` set:
   ```
   JIRA_BASE_URL=https://your-company.atlassian.net
   JIRA_EMAIL=you@company.com
   JIRA_API_TOKEN=***
   ```
3. Restart the server. Credentials live only in `.env` (git-ignored) and are
   used only by the local server — never sent to the browser or the model.

## Tests

```bash
npm test                 # unit + integration (mocked Ollama and Jira)
```

## Your data and moving it between machines

Projects are saved in your browser's `localStorage`, so they stay on the
machine and browser you created them in. To move a project to another machine,
or to back it up, use **Export project** on the Review tab to download a
`.json` file, then **Import project** on the other machine. The export also
includes your saved versions.

## Tuning

- `NUM_CTX` — context window in tokens. Larger reads longer PRDs but uses more
  RAM. The UI warns when a document exceeds what the model can read at once.
- `MAX_PARALLEL` — keep at 1 on a laptop. Higher values need more RAM/VRAM.
- First run after boot is slow while the model loads into memory; it is then
  kept warm for 30 minutes.

## Keyboard shortcuts

| Shortcut                | Action                          |
|-------------------------|---------------------------------|
| `1` / `2` / `3` / `4`   | Jump to Import / Review / Prototype / Jira |
| `Cmd/Ctrl + Z`          | Undo (prototype editor)         |
| `Cmd/Ctrl + Shift + Z`  | Redo (prototype editor)         |
| `Cmd/Ctrl + Y`          | Redo (prototype editor)         |
| `Esc`                   | Close dialog / deselect         |

## Project layout

```
server/
  app.js         Express app factory (routes, validation, queue)
  index.js       Entry point (starts the server)
  lib.js         Pure helpers (ADF, limits, validation) — unit-tested
  *.test.js      Tests
src/
  App.jsx        Top-level orchestrator + state
  constants.js   PRD template, state-machine constants, tunables
  prompts.js     LLM system prompts
  schemas.js     JSON schemas for structured LLM output
  utils.js       Pure utilities (chunk, pool, parseJSON, exports, …)
  api.js         /api/llm client with retry + dedup
  store.js       Versioned localStorage with migrations
  pdf.js         PDF/DOCX/HTML text extraction
  styles.css     All styles (extracted from the original CSS-in-JS)
  hooks/
    useTaskManager.js   Busy/err/abort state
    useScreens.js       Screens state + undo/redo
    useKeyboard.js      Keyboard shortcut wiring
  components/
    Boundary.jsx        Error boundary
    Empty.jsx           Empty-state callout
    ExportDialog.jsx    Export preview modal
    Wire.jsx            Wireframe component renderer
  views/
    ImportView.jsx      Step 1 — paste / upload / sample
    ReviewView.jsx      Step 2 — review & edit parsed PRD
    PrototypeView.jsx   Step 3 — generate & edit wireframes
    JiraView.jsx        Step 4 — backlog + Jira push
```

## Notes

- Outputs are AI-generated drafts. Review every output for accuracy before use,
  and confirm your chosen model's licence allows your intended use.
- The store is versioned (`prdstudio:v2` with `schemaVersion: 3`). Older saves
  are migrated automatically; if you bump the schema in the future, add a
  migration step in `src/store.js`.
- Projects can be exported as JSON (Project ▾ → Export project) and re-imported
  on another machine (Project ▾ → Import project…).

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for
setup instructions and guidelines, and note the
[Code of Conduct](CODE_OF_CONDUCT.md). Good first steps:

- Open an issue using the bug report or feature request template.
- Pick up an issue labelled `good first issue` or `help wanted`.
- Run `npm test` and `npm run build` before sending a pull request.

Found a security issue? Please follow [SECURITY.md](SECURITY.md) and report it
privately rather than opening a public issue.

## License

[MIT](LICENSE) © Sudeep. You're free to use, modify, and distribute this
software. Note that AI-generated outputs are drafts — review them for accuracy,
and confirm your chosen model's licence allows your intended use.
