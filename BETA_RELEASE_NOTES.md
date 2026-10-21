# AgentPilot 0.7.0-beta.1

This private beta packages the complete verified AgentPilot development line into a locally installable VSIX. It includes local agent lifecycle tracking, an AgentPilot-owned Codex task runner, interactive app-server chat, verified token accounting, session recovery, and optional Windows and Telegram notifications.

Security remains fail-closed: AgentPilot never auto-approves Codex requests, never bypasses workspace trust or sandbox policy, and stores Telegram credentials only through VS Code SecretStorage. Chat transcripts remain in Extension Host memory unless a future explicit opt-in feature is added.

The stabilization update adds cross-process coordination for multiple VS Code windows. Queue entries, task metadata, and chat sessions are reloaded under a bounded local lock; Telegram sends use an owner claim and treat abandoned sends as uncertain. Stable event-ID claims prevent duplicate local desktop notifications.

Known boundary: AgentPilot does not attach to or observe the app-server process owned by the official Codex VS Code Extension. Completion notifications are available for supported CLI hooks and tasks or conversations launched by AgentPilot itself.
