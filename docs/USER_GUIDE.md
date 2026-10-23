# User Guide

## Dashboard

Run **AgentPilot: Open Dashboard** to view observed activity, AgentPilot-owned task status, verified usage metadata, the Smart Model Advisor, notification delivery, and privacy/settings guidance. Opening the Dashboard is passive and does not start Codex.

Statuses are derived from observed events and may be `unknown`. Test events are labeled separately from real events.

## Codex Chat

Open the AgentPilot Activity Bar view or run **AgentPilot: Open Codex Chat**.

1. Create or select a conversation.
2. Choose a model reported by the AgentPilot-owned app-server.
3. Type a task. Enter sends; Shift+Enter inserts a newline.
4. Review process startup confirmation when a new or restarted owned process is required.
5. Review command, file-change, and permission approvals separately. Deny is the safe default.
6. Use Stop to interrupt a running turn.

Conversation text is held in memory. AgentPilot persists bounded metadata—including the Codex thread ID—so it can resume an owned thread after restart, but the sidebar cannot reconstruct prior message text.

Rename and deletion affect AgentPilot's local conversation metadata only after confirmation. They do not delete project files or the underlying Codex thread.

## Run a one-shot task

Run **AgentPilot: Run Codex Task**. AgentPilot asks for task text, requests confirmation, and launches `codex exec --json` in the active trusted workspace using argument arrays and `shell: false`. The prompt is passed through stdin and is not stored by AgentPilot.

Use **AgentPilot: Cancel Codex Task** to terminate the owned process tree. Completion, failure, cancellation, and timeout enter the same deduplicated notification pipeline.

## Smart Model Advisor

In Dashboard → Advisor, describe the task, select a priority, and choose Recommend. Classification and scoring are deterministic and local. Explanations identify the available evidence; neutral/unknown results are retained when evidence is insufficient. Applying a recommendation creates an AgentPilot conversation using that available model.

Recommendations are heuristics, not independent performance or price benchmarks. Optional feedback stores model ID, category, outcome, and timestamp—not task text.

## Usage analytics

AgentPilot records only explicit structured token fields exposed by supported sources. The Dashboard can group verified records and estimate API cost where pricing is known or explicitly overridden.

Cached input is a subset of input context, and reasoning tokens are output detail; neither should be added twice. Cost estimates are not bills and do not represent subscription usage.

Legacy history can be inspected with **AgentPilot: Dry Run Usage Reconciliation**. Applying a projection requires explicit confirmation and a verified backup. The original `usage.json` remains unchanged. Use **AgentPilot: Roll Back Usage Projection** to remove the derived view.

## Notifications

- VS Code notifications are enabled by default for selected real lifecycle events.
- Enable Windows notifications in Settings and run **AgentPilot: Test Windows Notification**.
- Configure Telegram with the dedicated commands and review delivery state in Dashboard → Notifications.

Notification destinations are independent. Persistent claims and stable source event IDs reduce duplicate delivery across rescans and VS Code windows.

## Supported monitoring boundary

Repository-local Codex hooks can record supported CLI lifecycle events after the CLI reviews and trusts the hook configuration. AgentPilot-owned CLI tasks and app-server chats are monitored directly. Private chats owned by the official Codex VS Code extension are outside AgentPilot's supported boundary.
