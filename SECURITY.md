# Security Policy

## Supported version

Security fixes currently target the latest release-candidate branch. This project has not declared a stable v1.0 support window.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting feature for this repository when available. If that feature is unavailable, contact the repository owner privately through their GitHub profile and ask for a secure reporting channel before sharing details.

Do not open a public issue containing exploit details, credentials, bot tokens, authentication files, prompts, source code, private conversations, local event or usage stores, or unsanitized logs.

Include:

- affected commit and version;
- impact and prerequisites;
- minimal reproduction without sensitive data;
- whether workspace trust, sandboxing, approvals, SecretStorage, or process cleanup is affected;
- suggested mitigation, if known.

## Security boundaries

- AgentPilot does not bypass Codex sandbox or approval policies.
- Agent-owned execution requires a trusted workspace and explicit startup approval.
- Telegram credentials use VS Code SecretStorage.
- Persistent files contain bounded metadata and should not contain prompts, source code, transcripts, or credentials.
- The official Codex VS Code extension's private app-server and conversations are outside AgentPilot's supported integration boundary.

No software can guarantee that project names or operational metadata are non-sensitive. Review local metadata and Telegram destination policy for your environment.
