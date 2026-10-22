# Changelog

## 0.9.3-beta.1

- Fixed Codex app-server token overcounting by converting cumulative current-turn snapshots into persisted nonnegative deltas scoped by provider, session, source, and turn.
- Added restart/replay, turn-boundary, model-change, partial-field, cached-input, reasoning-detail, and large-count regression coverage.
- Added an explicit, local reconciliation dry-run with raw versus candidate totals and clear uncertainty for legacy records without turn IDs.
- Added checksum-verified timestamped backups, stale-source detection, atomic projection metadata, and rollback without modifying raw usage records.
- Updated dashboard provenance labels so legacy raw totals, candidate estimates, cached subsets, reasoning detail, and API-equivalent costs are not presented as billing facts.
- Preserved the premium v0.9.2 navigation, charts, chat, Advisor, approval, and notification behavior.

## 0.9.2-beta.1

- Replaced the narrow dashboard's horizontally scrolling tabs with a labeled section dropdown, while preserving the wide sidebar, adding a compact medium-width rail, and retaining the active section across resizing.
- Added readable chart dates, exact verified-token interactions for mouse, keyboard, and touch, plus an accessible data table and correct empty, zero, and single-day states.
- Refined the Codex Chat header, model/status hierarchy, narrow-width action controls, message identity, long-content handling, and streaming layout stability.
- Moved detailed session and current-turn token accounting into the details drawer, conditionally shows verified cached-input metadata, and clarifies why usage differs from newly typed text without inventing billing costs.
- Added focused responsive-navigation, chart-accessibility, compact-header, message-layout, and token-detail regression coverage.

## 0.9.1-beta.1

- Fixed Jump to latest appearing in empty chats and kept it synchronized with messages, streaming, and manual scroll position.
- Added a centered, purposeful chat empty state and tightened narrow-sidebar hierarchy, message contrast, details, and composer layout.
- Fixed legacy usage-card markup that allowed metric values and labels to collide.
- Added responsive, tabular-number usage cards and tables with explicit unavailable API-equivalent costs.
- Shortened notification health to an untruncated status while retaining detailed accessible context.
- Improved activity timeline truncation, timestamp alignment, KPI sizing, and stacked narrow-width behavior.

## 0.9.0-beta.1

- Added a shared VS Code-native webview design system for dark, light, high-contrast, narrow-panel, and reduced-motion environments.
- Rebuilt the dashboard around persistent keyboard-accessible Overview, Advisor, Usage, Activity, Notifications, and Settings sections.
- Added verified token charts, lifecycle timelines, refined delivery history, and clearer cost-estimate labeling without inventing metrics.
- Redesigned AgentPilot-owned Codex Chat with conversation search, a details drawer, copy actions, status announcements, and a manual jump-to-latest control.
- Preserved strict CSP, local-only assets, sanitized Markdown, message allowlists, single-use startup confirmation, and per-action approvals.

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
