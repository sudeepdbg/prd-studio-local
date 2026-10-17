# Contributing to PRD Studio (local)

Thanks for your interest in contributing! This project is a local-first tool,
so contributions that keep it simple, private, and dependency-light are
especially welcome.

## Ways to contribute

- **Report bugs** using the bug report issue template.
- **Suggest features** using the feature request template.
- **Improve docs** — typos, clarifications, and examples all help.
- **Send pull requests** for fixes and features.

## Development setup

You'll need **Node.js 18+** and, for the AI features, **[Ollama](https://ollama.com)**.

```bash
git clone https://github.com/sudkumar/prd-studio-local.git
cd prd-studio-local
npm install
cp .env.example .env        # edit as needed
ollama pull phi3.5          # or another model; set OLLAMA_MODEL to match
npm run dev                 # API on :8787, web on http://localhost:5173
```

## Before you open a pull request

1. Run the test suite: `npm test`
2. Make sure it builds: `npm run build`
3. Keep changes focused — one logical change per PR is easiest to review.
4. Add or update tests for any behaviour you change. Pure helpers live in
   `server/lib.js` and `src/utils.js` and are the easiest to test.
5. Update the README or other docs if you change how something works.
6. **Never commit secrets.** `.env` is git-ignored; keep it that way. Don't
   paste real Jira tokens into issues, PRs, or test fixtures.

## Project layout

```
server/        Express API: LLM proxy (Ollama) + Jira REST client
  app.js       App factory (routes)
  index.js     Entry point
  lib.js       Pure helpers (ADF conversion, validation) — unit tested
src/
  App.jsx      Top-level orchestrator
  views/       One file per step: Import, Review, Prototype, Jira
  components/   Reusable UI pieces
  hooks/       Stateful logic (tasks, screens/undo, keyboard)
  api.js       LLM client (timeout, retry, dedup)
  store.js     Versioned localStorage with migrations
  constants.js The PRD template lives here — edit SECTIONS to change it
```

## Coding style

- Plain JavaScript (ES modules), React function components and hooks.
- Prefer small, pure functions that are easy to test.
- Match the existing formatting; keep comments where logic is non-obvious.

## Commit messages

Short, imperative summaries ("Fix Jira retry on rejected priority"). Reference
an issue number when there is one.

## Code of conduct

By participating you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE) that covers this project.
