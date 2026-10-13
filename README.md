# AgentPilot Starter v0.1

Local-first **VS Code extension prototype** for Windows: event timeline, native VS Code notifications, optional Telegram notifications. This is an original, small implementation, **not a merger of third-party source code**.

## Quick start (Windows)
1. Install Node.js, Python 3 and VS Code.
2. Open this folder in VS Code.
3. Run `npm test` in a terminal to verify the basics.
4. Open **Run and Debug** > create `launch.json` from the included `.vscode/launch.json`, or simply press **F5** while this folder is open. This launches **Extension Development Host**.
5. In the new VS Code window, open Command Palette (**Ctrl+Shift+P**), run `AgentPilot: Open Dashboard`, then `AgentPilot: Test Notification`.

## Telegram (optional)
Create a bot with @BotFather, message `/start` to your bot, then get chat ID from Telegram `getUpdates`. **Never paste bot token into public GitHub or into chat.**

In PowerShell, set environment variables (for only that terminal session):
```powershell
$env:AGENTPILOT_TELEGRAM_TOKEN = 'BOT_TOKEN'
$env:AGENTPILOT_TELEGRAM_CHAT_ID = 'CHAT_ID'
code .
```
Then use VS Code Settings > `AgentPilot: Enable Telegram` (check), **restart Extension Development Host** and run test again. For best secret hygiene, do not store tokens in plain-text VS Code settings.

## Hook adapter manual smoke test
```powershell
'{}' | py scripts\hook.py claude completed
'{}' | py scripts\hook.py codex attention
```
This writes local metadata to `%USERPROFILE%\.agentpilot\events.jsonl`. The extension watches that file.

## Real agent integrations: not auto-installed
For Claude Code, install the `Stop`/`Notification` hooks via Claude Code's official hook configuration to call the adapter. Event arguments should be `claude completed`, `claude attention`, and `claude failed` as appropriate. For Codex, test whether the VS Code extension triggers Codex `notify` or its current hook interface on your version; CLI support **does not guarantee** VS Code extension support. Back up existing hook config before editing it, and do not overwrite other hooks. This starter intentionally does **not** modify `~/.claude/settings.json` or `~/.codex/config.toml`.

## Scope and limitations
- Working: manual tests, event capture, desktop VS Code message, Telegram send when enabled, local event dashboard.
- Not included yet: token tracking, quota tracking, cost estimation, task-quality scoring, model recommendation, real-agent hooks auto-registration.
- Events are **turn events**, not proof that code works. Secrets/prompts are not stored in the event log.
- File watcher operates on up to last 300 entries; future releases should use a cursor/database for robust high-volume event handling.

## Audit
See `docs/AUDIT.md`. MIT license in this original project is independent of the third-party repositories reviewed.
