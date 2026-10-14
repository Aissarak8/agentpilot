# AgentPilot v0.2

AgentPilot is a local-first VS Code dashboard for coding-agent lifecycle events. Version 0.2 adds a metadata-only Codex hook adapter, normalized local storage, deduplicated notifications, and a VS Code-native dashboard. It never stores source code, prompts, assistant messages, transcripts, tokens, or credentials.

## Install and run on Windows 11

Requirements: VS Code 1.90+, Node.js 22, Python 3 available as `python`, Git, and Codex CLI for CLI events.

```powershell
git clone https://github.com/Aissarak8/agentpilot.git
cd agentpilot
npm test
code .
```

Press **F5** to launch an Extension Development Host. In that window run **AgentPilot: Open Dashboard**. **AgentPilot: Test Notification** writes a clearly labeled test event; test events never trigger the real-event notification rules.

All data stays in `%USERPROFILE%\.agentpilot\events.jsonl`. Existing v0.1 JSONL records remain readable. Delete that file to clear the history.

## Codex CLI integration

This repository includes [`.codex/hooks.json`](.codex/hooks.json). Current official Codex lifecycle hooks provide `SessionStart`, `Stop`, `PermissionRequest`, `Interrupt`, and `SessionEnd`. AgentPilot maps those to session started, completed, attention, interrupted, and session ended. The payload fields retained are timestamp, provider, event kind, project name, hook name, session ID, turn ID, and model when Codex supplies them.

1. Start Codex CLI from this trusted repository.
2. Run `/hooks`, review the project hook definition, and trust it. Codex intentionally skips new or changed non-managed hooks until trusted.
3. Complete a turn, then check `%USERPROFILE%\.agentpilot\events.jsonl` or refresh the dashboard.

Manual adapter smoke test:

```powershell
'{"hook_event_name":"Stop","session_id":"smoke","turn_id":"turn-1","cwd":"C:\\work\\demo"}' |
  python scripts\hook.py codex auto
Get-Content "$env:USERPROFILE\.agentpilot\events.jsonl" -Tail 1
```

The repo-local setup is reversible: remove `.codex/hooks.json` (or disable its entries in `/hooks`). It does not edit or overwrite `%USERPROFILE%\.codex\config.toml`.

## Codex VS Code extension compatibility

The installed OpenAI Codex VS Code extension does not publish a VS Code extension API for turn-completion events. Official Codex documentation describes lifecycle hooks for local Codex threads, but CLI support alone is not proof that every VS Code extension build executes repo-local hooks. AgentPilot therefore does not scrape the Codex UI or use private extension internals.

Status for v0.2:

- Codex hook payload parsing and storage: automated integration-tested with representative official payload fields.
- Codex CLI real turn: verified on Windows with the official `codex.exe` bundled by the Codex VS Code extension. The separate global npm installation remains incomplete because its optional `@openai/codex-win32-x64` package is missing.
- Codex VS Code extension real turn: not verified; enable only after confirming a real hook event appears locally for your installed extension version.
- Hook payloads identify Codex, session, and turn, but do not identify the client surface. CLI versus VS Code attribution therefore requires correlation with the initiating client/session and is not inferred in stored events.
- Agent failures: no documented local lifecycle hook in the tested interface exposes a general turn-failed event, so AgentPilot does not invent one. The adapter accepts `failed` for providers that explicitly supply it.

Official references: [Codex lifecycle hooks](https://learn.chatgpt.com/docs/hooks) and [Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference).

## Notifications

Settings under **VS Code Settings → AgentPilot** control completed-turn, attention, and error notifications. VS Code notifications are enabled by default. Optional native Windows toasts are disabled by default and use only the bundled local PowerShell script; they require no administrator rights or network access. Events are deduplicated by stable event ID, so watcher and polling fallback cannot notify twice.

## Tests

```powershell
npm test
```

The suite covers normalization, v0.1 compatibility, malformed records, local storage, duplicate prevention, dashboard aggregation/status, HTML escaping, Codex payload mapping, and exclusion of private payload fields.

## Troubleshooting

- **Hook does not run:** open `/hooks`, verify the repo is trusted, and trust the exact hook definition. Start a new Codex session after changing hooks.
- **`codex` PowerShell script is blocked:** use `codex.cmd`, or adjust your user-scoped PowerShell execution policy if your organization permits it.
- **Missing `@openai/codex-win32-x64`:** reinstall the official Codex CLI package, then confirm `codex.cmd --version` works before testing a real turn.
- **No event in the dashboard:** run the manual smoke test, inspect `%USERPROFILE%\.agentpilot\events.jsonl`, then use **Developer: Toggle Developer Tools** for AgentPilot errors.
- **No Windows toast:** keep VS Code notifications enabled; Windows toast APIs or notification policy may be unavailable. Agent tracking continues regardless.
- **Malformed JSONL line:** it is ignored safely; later valid lines still load.

## Known limitations

Status is inferred only from observed lifecycle events and may be `unknown`; it is not live process monitoring. Storage is capped to the newest 500 records in the dashboard read path. Claude configuration and Telegram are outside v0.2 scope. Token analytics, cost comparison, and model recommendations remain future work.
