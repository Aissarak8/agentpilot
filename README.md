# AgentPilot v0.3

AgentPilot is a local-first VS Code dashboard for coding-agent lifecycle events. Version 0.3 adds optional Telegram Bot API notifications while preserving the metadata-only Codex integration. It never sends source code, prompts, assistant messages, transcripts, tokens, or credentials.

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

The tested Windows extension (`openai.chatgpt` 26.908.40401) does not expose `/hooks` in its IDE slash-command menu, VS Code commands, or extension settings. Hook review and trust are currently documented for the Codex CLI TUI. To test whether CLI-established trust is shared with a new local IDE thread, launch the official Codex CLI from this repository, run `/hooks`, review and trust `.codex/hooks.json`, exit, and then start a new IDE chat in `/local` mode. This is a verification path, not a claim that the installed IDE build supports command hooks.

If the IDE still emits no matching event after CLI trust and a new local chat, treat IDE command-hook integration as unavailable for that build. Keep the verified CLI integration; do not use UI scraping or private extension APIs. For a separately built supported client, Codex app-server provides documented streamed lifecycle events, but AgentPilot does not attach to or intercept the private app-server instance owned by the OpenAI VS Code extension.

Status for v0.2:

- Codex hook payload parsing and storage: automated integration-tested with representative official payload fields.
- Codex CLI real turn: verified on Windows with the official `codex.exe` bundled by the Codex VS Code extension. The separate global npm installation remains incomplete because its optional `@openai/codex-win32-x64` package is missing.
- Codex VS Code extension real turn: not verified; enable only after confirming a real hook event appears locally for your installed extension version.
- Hook payloads identify Codex, session, and turn, but do not identify the client surface. CLI versus VS Code attribution therefore requires correlation with the initiating client/session and is not inferred in stored events.
- Agent failures: no documented local lifecycle hook in the tested interface exposes a general turn-failed event, so AgentPilot does not invent one. The adapter accepts `failed` for providers that explicitly supply it.

Official references: [Codex lifecycle hooks](https://learn.chatgpt.com/docs/hooks) and [Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference).

## Notifications

Settings under **VS Code Settings → AgentPilot** control completed-turn, attention, and error notifications. VS Code notifications are enabled by default. Optional native Windows toasts are disabled by default and use only the bundled local PowerShell script; they require no administrator rights or network access. Events are deduplicated by stable event ID, so watcher and polling fallback cannot notify twice.

## Telegram notifications

Telegram delivery uses the official HTTPS Bot API. The bot token and chat ID are stored in VS Code SecretStorage and are never written to settings, environment variables, hook arguments, the event log, or the repository. The hook process does not access Telegram credentials; the running AgentPilot extension observes the local metadata event store and performs delivery independently. A Telegram failure therefore cannot interrupt Codex.

Setup:

1. Create a bot with Telegram's official **@BotFather** and keep the token private.
2. Open the destination chat and send the bot `/start`. For a channel, add the bot with permission to post.
3. Obtain the numeric chat ID through a trusted Telegram workflow, or use a public channel username such as `@example_channel`. Do not paste the bot token into source files, shell history, issue reports, or logs.
4. In VS Code run **AgentPilot: Configure Telegram Bot Token**. AgentPilot validates it with the Bot API `getMe` method before storing it in SecretStorage.
5. Run **AgentPilot: Configure Telegram Chat ID**.
6. Enable **AgentPilot: Enable Telegram** in Settings or from the dashboard.
7. Run **AgentPilot: Test Telegram Notification** and confirm receipt.

Real notifications contain only agent name, normalized event type, project name, and timestamp. They are sent for completed turns, permission requests, and session end. Delivery has an eight-second timeout, stable-ID deduplication, and a ten-message-per-minute safety cap. The dashboard shows configured connection state and the latest runtime delivery result, never credentials.

Telegram delivery is verified for events written by the Codex CLI hook integration. Codex VS Code Extension completion hooks remain unverified, so Telegram delivery for IDE-hosted Codex turns is not claimed.

## Tests

```powershell
npm test
```

The suite covers normalization, v0.1 compatibility, malformed records, local storage, duplicate prevention, dashboard aggregation/status, HTML escaping, Codex payload mapping, exclusion of private payload fields, Telegram formatting, disabled and missing configuration, delivery failures, HTTP error sanitization, and Telegram deduplication.

## Troubleshooting

- **Hook does not run:** open `/hooks`, verify the repo is trusted, and trust the exact hook definition. Start a new Codex session after changing hooks.
- **`codex` PowerShell script is blocked:** use `codex.cmd`, or adjust your user-scoped PowerShell execution policy if your organization permits it.
- **Missing `@openai/codex-win32-x64`:** reinstall the official Codex CLI package, then confirm `codex.cmd --version` works before testing a real turn.
- **No event in the dashboard:** run the manual smoke test, inspect `%USERPROFILE%\.agentpilot\events.jsonl`, then use **Developer: Toggle Developer Tools** for AgentPilot errors.
- **No Windows toast:** keep VS Code notifications enabled; Windows toast APIs or notification policy may be unavailable. Agent tracking continues regardless.
- **Malformed JSONL line:** it is ignored safely; later valid lines still load.
- **Telegram says disconnected:** configure both secrets, enable Telegram, and send a test. “Connected” means enabled and configured; the last-delivery field reports the latest network result.
- **Telegram test fails:** make sure the bot has received `/start`, the chat ID is correct, and local firewall/proxy policy allows `https://api.telegram.org`.

## Known limitations

Status is inferred only from observed lifecycle events and may be `unknown`; it is not live process monitoring. Storage is capped to the newest 500 records in the dashboard read path. Telegram delivery requires the VS Code extension host to be running. Token analytics, cost comparison, and model recommendations remain future work.
