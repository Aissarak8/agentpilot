# Preliminary GitHub audit — 2026-10-13

| Repository | License | Useful approach | Risk / integration decision |
|---|---|---|---|
| Lethalos/agent-notifier-vscode-extension | MIT | Windows VS Code hooks, desktop notifications | Examine hook setup; modifies global agent config, so back up and merge carefully |
| charlesDGY/claude-codex-usage-dashboard | MIT | Local JSONL parsing, quota and usage breakdown | Reads sensitive OAuth credentials and private histories; prefer local parsing first, do not copy its remote token requests by default |
| AgenticSec/ClaudeCodeUsageDashboard | MIT | Claude end-session analytics, subagents | Sends usage metadata to server in its typical team deployment; privacy-first adaptation needed |
| 777genius/agent-notifications | GPL-3.0-or-later | Multi-agent notifications and webhooks | Study behavior, do not copy GPL source into MIT project |

Sources:
- https://github.com/Lethalos/agent-notifier-vscode-extension
- https://github.com/charlesDGY/claude-codex-usage-dashboard
- https://github.com/AgenticSec/ClaudeCodeUsageDashboard
- https://github.com/777genius/agent-notifications

Audit is preliminary: README/license-level validation, not a line-by-line security or dependency audit. Real-world VS Code Codex event behavior remains to be tested.
