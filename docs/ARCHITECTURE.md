# Architecture

AgentPilot is a CommonJS VS Code extension with lightweight HTML, CSS, and JavaScript webviews and no runtime npm dependency tree.

## Components

- `extension.js`: activation, commands, trust gates, Dashboard, event watcher, notifications, and integration wiring.
- `chat-view.js`, `codex-chat.js`, `codex-app-server.js`: sidebar UI and AgentPilot-owned Codex app-server lifecycle.
- `codex-task-runner.js`, `scripts/codex-exec.js`: AgentPilot-owned one-shot `codex exec --json` tasks.
- `core.js`, `scripts/hook.py`: normalized local lifecycle events and supported repository-local CLI hooks.
- `usage.js`, `codex-usage-stream.js`, `usage-reconciliation.js`: explicit usage normalization, incremental accounting, analytics, and non-destructive legacy projection.
- `delivery-queue.js`, `telegram.js`, `notification-claims.js`: bounded Telegram delivery and cross-window notification deduplication.
- `windows-notifications.js`, `scripts/windows-toast.ps1`: native Windows toast with sanitized diagnostics and fallback.
- `smart-model-advisor.js`: deterministic local classification and explainable recommendation scoring.

## Execution boundaries

AgentPilot launches owned Codex processes only after workspace trust and explicit user confirmation. Processes use argument arrays and `shell: false`; task text is sent over stdin. The extension does not attach to the official Codex VS Code extension's private app-server.

App-server approvals are allowlisted for documented command-execution, file-change, and permission requests. Malformed or unsupported requests fail closed. AgentPilot returns the user's explicit decision and never relaxes Codex sandbox settings.

## Storage

Bounded metadata is stored under `%USERPROFILE%\.agentpilot` with atomic writes and cross-process lock files where concurrent VS Code windows can write. Malformed or oversized stores fail closed and are not silently replaced.

Typical files include:

- `events.jsonl`
- `usage.json` and optional `usage-reconciliation.json`
- `codex-tasks.json`
- `codex-chat-sessions.json`
- `telegram-deliveries.json`
- `notification-claims.json`
- `advisor-feedback.json`

Telegram token and chat ID are stored separately in VS Code SecretStorage. Chat transcripts, prompts, source code, and authentication credentials are not intentionally persisted by AgentPilot.

## Webview security

Webviews use `default-src 'none'`, nonce-restricted scripts, local inline styling, escaped rendering, and action allowlists. Incoming messages are validated before dispatch. The webviews do not load remote JavaScript or analytics.

## Delivery model

Lifecycle events receive stable IDs and flow independently to VS Code, Windows, and Telegram destinations. Telegram uses a persistent state machine (`pending`, `sending`, `sent`, `failed`, `uncertain`) and avoids automatic resend after ambiguous outcomes.

## Usage accounting

CLI per-turn usage is treated as incremental. App-server current-turn snapshots are cumulative, so persisted provider/session/source/turn cursors convert them into nonnegative deltas and prevent restart/replay double counting.
