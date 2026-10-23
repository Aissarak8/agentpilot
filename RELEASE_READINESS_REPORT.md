# AgentPilot v1.0 Release Candidate Readiness

Audit date: 2026-10-23

Baseline: `release/v0.9.3-token-fix` at `ca4d195`

Candidate: `release/v1.0-rc`, version `1.0.0-rc.1`

## Verdict

**GO for release-candidate testing; NO-GO for a stable v1.0 release until the manual checks below are completed.** No known critical blocker remains in the audited code. This candidate is intentionally not published or merged.

## Findings and disposition

| Severity | Finding | Disposition |
| --- | --- | --- |
| Critical | None confirmed. | — |
| High | Opening the Dashboard could start an AgentPilot-owned Codex process without the documented single-use startup confirmation. | Fixed. Dashboard opening is passive; process startup remains tied to an explicit Chat action and confirmation. |
| High | A malformed or partially written JSON store could be interpreted as empty and overwritten by a later write. | Fixed fail-closed across usage, conversations, tasks, Telegram delivery queue, notification claims, and advisor feedback. Original bytes are preserved and the UI reports that the store needs attention. |
| Medium | Concurrent event appenders could race between duplicate detection and append. | Fixed with the existing bounded cross-process file lock. |
| Medium | The complete Dashboard was rendered every 2.5 seconds even when no event changed. | Fixed; idle polls no longer render or wake delivery work. Explicit UI actions still refresh immediately. |
| Low | A missing configured Codex executable produced a generic Chat error. | Fixed with actionable, sanitized guidance for the absolute native executable setting. |
| Low | Advisor onboarding implied model discovery without explaining the authorization boundary. | Fixed copy: opening Dashboard never starts Codex; discovery follows explicit Chat authorization. |

## Security and privacy assessment

- Workspace trust gates remain in place; the audit did not add a trust bypass.
- Codex sandbox and approval policy are not overridden. Command, file-change, and permission requests remain explicit and fail closed; Deny remains the safe path.
- Webview messages continue through allowlisted handlers and typed/sanitized inputs. Webview HTML retains its nonce-based content security policy.
- Markdown rendering remains escaped/sanitized before insertion; no prompt, transcript, token, credential, or raw private payload was added to telemetry or release diagnostics.
- Telegram credentials remain in VS Code SecretStorage. Stores contain delivery metadata only.
- Child processes use argument arrays with `shell: false`, and cleanup/cancellation behavior remains covered by tests.
- Malformed persistent state now blocks mutation rather than silently replacing evidence.

## Data-integrity evidence

The production usage store was inspected read-only and was not reconciled or rewritten:

- `%USERPROFILE%\.agentpilot\usage.json`: 25,068 bytes
- SHA-256 before release work: `AA904A4AFA23C9004E76B6A2304DDFE2295F8A069621C4FC86EA18F86B8B26C1`
- Existing timestamped backups remain present.
- `usage-reconciliation.json` was absent; no historical projection was applied.

## Automated and runtime verification

- Baseline suite: 133/133 passed.
- Candidate suite after fixes: 139/139 passed.
- Added regression coverage for corrupt-store preservation, concurrent event deduplication, passive Dashboard startup, explicit Advisor authorization copy, idle polling, and actionable executable errors.
- A real isolated Codex CLI JSON turn completed and persisted one `codex-cli-json` usage record: 13,387 input, 5 output, 11,264 cached-input tokens.
- A real isolated AgentPilot app-server turn emitted started and completed exactly once and persisted one `codex-app-server` usage record: 14,855 input and 5 output tokens.
- Both runtime checks used temporary stores and the harmless task `Reply exactly OK`; production history was not modified.
- The globally installed `codex.cmd` remains unusable because its optional Windows native package is missing. The native executable shipped with the installed official Codex VS Code extension (`codex-cli 0.154.0-alpha.6.2`) passed both supported AgentPilot-owned checks. No global installation was changed.

Performance smoke measurement with synthetic local data:

- Analytics over 5,000 usage records: approximately 80 ms.
- Dashboard render with its bounded 500-event input: approximately 70 ms and 43.6 KB HTML.
- Idle event polling no longer triggers either operation.

## Required manual release checks

Perform these in normal VS Code after installing the RC VSIX:

1. Open the Dashboard in a trusted workspace and confirm it does **not** start Codex or show startup confirmation.
2. Open Chat, send a harmless turn, approve the one-time process startup, then continue the same conversation without another startup prompt.
3. Exercise Deny and Allow for a safe approval request and confirm no sandbox/permission bypass.
4. Restart VS Code and resume the conversation; confirm metadata and token totals remain consistent.
5. Complete a Chat turn and observe VS Code, Windows, and—if configured—Telegram delivery exactly once.
6. Exercise Telegram failed/uncertain manual retry, acknowledging that an uncertain message may already have arrived.
7. Open the Smart Model Advisor and verify recommendation, explanation, and feedback controls visually.
8. Repeat a completion with two VS Code windows open and inspect event/usage/delivery history for duplicates.

The official Codex VS Code extension's private conversations are not monitored. AgentPilot observes only tasks and app-server sessions it owns, plus separately configured supported CLI workflows.

## Official integration basis

The owned app-server flow follows the documented initialize/initialized, thread, turn, notification, approval, interrupt, and token-usage protocol. Thread resume is used for AgentPilot-owned recovery; AgentPilot does not attach to the official extension's private app-server instance.

- https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server
- https://developers.openai.com/blog/codex-as-a-platform
