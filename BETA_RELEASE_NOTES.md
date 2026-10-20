# AgentPilot 0.7.0-beta.1

This private beta packages the complete verified AgentPilot development line into a locally installable VSIX. It includes local agent lifecycle tracking, an AgentPilot-owned Codex task runner, interactive app-server chat, verified token accounting, session recovery, and optional Windows and Telegram notifications.

Security remains fail-closed: AgentPilot never auto-approves Codex requests, never bypasses workspace trust or sandbox policy, and stores Telegram credentials only through VS Code SecretStorage. Chat transcripts remain in Extension Host memory unless a future explicit opt-in feature is added.

Known boundary: AgentPilot does not attach to or observe the app-server process owned by the official Codex VS Code Extension. Completion notifications are available for supported CLI hooks and tasks or conversations launched by AgentPilot itself.
