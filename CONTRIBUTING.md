# Contributing to AgentPilot

Thanks for helping improve AgentPilot.

## Workflow

1. Search existing issues and security guidance.
2. Fork the repository and create a focused branch from the appropriate development branch.
3. Keep changes small and preserve local-first privacy, workspace trust, sandbox, and explicit approval boundaries.
4. Add or update automated tests.
5. Run:

   ```powershell
   npm install
   npm test
   ```

6. If runtime files changed, build and inspect a VSIX with `npm run package:rc`.
7. Open a pull request explaining behavior, tests, manual verification, privacy impact, and remaining limitations.

## Choosing a first contribution

Look for issues labeled [`good first issue`](https://github.com/Aissarak8/agentpilot/labels/good%20first%20issue). A suitable first change should be bounded, independently testable, and avoid changing AgentPilot's security boundaries. Comment on the issue before starting substantial work so maintainers and contributors do not duplicate effort.

Documentation-only contributions do not require a VSIX build. Runtime changes should include relevant automated tests and a locally inspected package.

## Pull request checklist

- Link the issue or explain the user problem.
- Keep unrelated formatting and generated files out of the commit.
- State exactly which automated and manual checks were performed.
- Call out Windows-only assumptions and anything not tested on another platform.
- Update user documentation for settings, storage, network, approval, or compatibility changes.
- Never use real credentials or private conversation data in tests or screenshots.

## Coding expectations

- Do not introduce UI scraping, private API interception, credential access, shell interpolation, or automatic approval.
- Do not persist prompts, source code, transcripts, raw private payloads, or authentication material.
- Treat malformed persistent state and approval ambiguity as fail-closed conditions.
- Keep UI lightweight and compatible with VS Code theme variables.
- Add stable IDs and restart-safe deduplication for new event paths.
- Clearly distinguish mocked tests from real integration observations.

## Reporting bugs

Include the AgentPilot version, VS Code version, operating system, reproducible steps, expected and actual behavior, and sanitized error category. Never attach bot tokens, chat IDs, Codex authentication files, prompts, source code, private conversation text, or raw local stores.

Report security vulnerabilities privately as described in [SECURITY.md](SECURITY.md), not in a public issue.
