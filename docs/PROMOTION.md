# AgentPilot promotion kit

Use these drafts as a starting point. Review community rules and adapt the tone before posting. Do not automate posting, cross-post repeatedly, or ask for artificial engagement.

Canonical links:

- Repository: https://github.com/Aissarak8/agentpilot
- Pre-release: https://github.com/Aissarak8/agentpilot/releases/tag/v1.0.0-rc.1
- VSIX: https://github.com/Aissarak8/agentpilot/releases/download/v1.0.0-rc.1/agentpilot-1.0.0-rc.1.vsix
- Issues: https://github.com/Aissarak8/agentpilot/issues

## LinkedIn

I’ve published the first public release candidate of AgentPilot, an MIT-licensed, local-first VS Code extension for developers using Codex workflows.

AgentPilot provides an AgentPilot-owned multi-turn Codex Chat, an explainable Smart Model Advisor, structured token-usage analytics, lifecycle activity, and optional Windows and Telegram notifications. Workspace trust, Codex sandbox settings, and explicit approvals remain in control.

An important limitation: AgentPilot cannot independently monitor private conversations owned by the official Codex VS Code extension. It observes supported CLI hooks and sessions or tasks that AgentPilot starts itself. Token totals are structured usage metadata, not subscription billing.

The Windows-focused `v1.0.0-rc.1` VSIX is available for testing: https://github.com/Aissarak8/agentpilot/releases/tag/v1.0.0-rc.1

Feedback, reproducible bug reports, and focused contributions are welcome.

## Reddit

**Title:** I built AgentPilot, a local-first VS Code dashboard and Codex task runner (public RC)

I wanted one place to run AgentPilot-owned Codex conversations, see supported lifecycle activity and token metadata, and receive a notification when a task finishes. AgentPilot is a lightweight MIT-licensed VS Code extension with:

- owned multi-turn Codex Chat and explicit approvals;
- deterministic, explainable model suggestions;
- structured token analytics with duplicate-safe accounting;
- VS Code, Windows, and optional Telegram notifications.

Privacy boundary: AgentPilot stores bounded metadata locally and keeps Telegram credentials in VS Code SecretStorage. It does not attach to or monitor private conversations owned by the official Codex VS Code extension. Historical usage can be uncertain, and displayed totals are not subscription billing.

This is a Windows-tested release candidate, not stable v1.0. Code, screenshots, limitations, and VSIX: https://github.com/Aissarak8/agentpilot

I’d value feedback on installation, accessibility, and behavior across different Windows/VS Code configurations.

## Hacker News — Show HN

**Title:** Show HN: AgentPilot – local-first Codex chat, usage, and notifications in VS Code

AgentPilot is an MIT-licensed VS Code extension for running Codex sessions it owns and seeing their lifecycle and structured usage metadata in a local dashboard. It includes multi-turn Chat, an explainable local model advisor, and independent VS Code, Windows, and Telegram notifications.

The main design boundary is explicit ownership: it does not scrape or attach to private conversations in the official Codex VS Code extension, and it never bypasses Codex sandbox or approval policy. Prompts and source code are not collected by an AgentPilot service.

`v1.0.0-rc.1` is a Windows-tested pre-release, and token totals are not subscription billing. Repository and VSIX: https://github.com/Aissarak8/agentpilot

I’m especially interested in feedback on install friction, multi-window behavior, and the usefulness of the local analytics.

## Dev.to

**Title:** Building AgentPilot: a local-first control center for Codex workflows in VS Code

AgentPilot started from a practical problem: coding-agent work can finish outside your immediate attention, while lifecycle events, token metadata, and notification health live in separate places.

The public release candidate combines an AgentPilot-owned Codex Chat, supported CLI lifecycle monitoring, structured usage analytics, an explainable Smart Model Advisor, and optional Windows and Telegram notifications. It is deliberately local-first: bounded metadata stays on the machine, Telegram credentials use VS Code SecretStorage, and action approvals preserve Codex sandbox policy.

There is a firm compatibility limit. AgentPilot cannot independently observe private conversations owned by the official Codex VS Code extension, and it does not use UI scraping or private traffic interception. Usage totals are structured metadata—not subscription billing—and legacy history may be uncertain.

The project is MIT licensed and `v1.0.0-rc.1` is available as a GitHub pre-release for Windows-focused testing: https://github.com/Aissarak8/agentpilot

The repository includes real screenshots, architecture and security notes, contribution guidance, and beginner-friendly issues. Feedback is welcome, especially around installation, accessibility, and additional platform testing.

## Publishing checklist

1. Read and follow each community's self-promotion rules.
2. Post from a real maintainer account and answer questions honestly.
3. Use the canonical release link and identify the build as a pre-release.
4. Disclose limitations in the initial post, not only in follow-up comments.
5. Avoid coordinated voting, repetitive cross-posting, or private-message promotion.
6. Record genuine feedback as issues only with the reporter's consent.
