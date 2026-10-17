# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-01

### Added
- Parse any PRD (paste, `.docx`, `.pdf`, `.md`, `.txt`, `.html`) onto a
  structured 10-section template using a local LLM via Ollama.
- AI gap-filling for fields the source PRD does not cover, clearly tagged.
- Editable click-through prototype with undo/redo, device preview, and
  per-screen AI refinement.
- Jira backlog generation (epics and stories with acceptance criteria) and
  creation via the Jira Cloud REST API, plus CSV export.
- Multi-project support with versioning and JSON export/import.
- Local-first: no data leaves the machine except Jira issues you choose to
  create.
