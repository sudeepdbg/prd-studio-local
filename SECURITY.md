# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Instead, report them privately using GitHub's
[private vulnerability reporting](https://github.com/sudkumar/prd-studio-local/security/advisories/new),
or contact the maintainer directly through their GitHub profile at
https://github.com/sudkumar.

Please include steps to reproduce and the potential impact. You can expect an
acknowledgement within a reasonable time, and we'll work with you on a fix and
coordinated disclosure.

## Scope and notes

This is a **local-first** application designed to run on your own machine:

- The web UI and API are intended to bind to `127.0.0.1` (localhost) only.
  Do not expose the server to a public network without adding your own
  authentication and TLS.
- Jira credentials live only in your local `.env` file and are used only by
  the local server. They are never sent to the browser or to the language
  model. Keep `.env` out of version control (it is git-ignored by default).
- Obtain any API tokens through your organisation's approved secrets process.
