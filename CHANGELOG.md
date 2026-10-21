# Changelog

## 0.8.2

- Scoped Codex chat startup confirmation to new threads and process starts or restarts.
- Prevented opening the sidebar or selecting a saved conversation from silently starting Codex.
- Kept per-action approvals, workspace trust, and sandbox settings independent and fail-closed.

## 0.8.1

- Fixed debugging tasks being labeled unknown when contextual security terms tied the old code-review rule.
- Added intent-specific debugging phrases and end-to-end dashboard recommendation rendering coverage.

## 0.8.0

- Added a local, deterministic Smart Model Advisor with transparent task classification and complexity signals.
- Reused the official Codex app-server `model/list` catalog and preserved sanitized comparison metadata.
- Added neutral recommendations when verified speed, quality, or cost evidence cannot distinguish models.
- Added safe creation of a new AgentPilot conversation with a selected available model; active conversations are never changed.
- Added bounded metadata-only subjective feedback storage and advisor privacy/message-validation tests.

## 0.7.0-beta.1 — 2026-10-20

- Packages AgentPilot as an installable private-beta VSIX for Windows and VS Code 1.90+.
- Includes the AgentPilot-owned Codex task runner and interactive multi-turn app-server chat.
- Adds responsive, collapsible chat navigation, safer webview message validation, accessible focus behavior, and separate session/current-turn token totals.
- Includes local usage analytics, resumable session metadata, explicit fail-closed approvals, and independent VS Code, Windows, and Telegram notifications.
- Keeps prompts, source code, assistant messages, credentials, and private conversations out of AgentPilot persistence.
- Stabilizes multi-window metadata writes and notification claims, prevents duplicate Telegram/Windows/VS Code delivery across windows, and blocks owned Codex processes in untrusted workspaces.

This beta does not monitor conversations owned by the official Codex VS Code Extension.
