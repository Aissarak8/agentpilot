# Troubleshooting

Use **View → Output → AgentPilot** for sanitized diagnostic categories. Do not paste credentials or private workspace material into an issue.

## Codex executable not found

Run `codex --version` in a normal terminal. If AgentPilot cannot resolve it, configure an absolute native `codex.exe` path in **AgentPilot: Codex CLI Path**. `.cmd` and `.bat` wrappers are rejected because AgentPilot intentionally launches without a shell.

If Codex reports a missing optional Windows native package, repair the official installation with its supported installer or package manager. Do not download an executable from an unofficial source. AgentPilot does not modify global Codex configuration.

## Workspace is not trusted

AgentPilot will not start tasks or Chat execution in an untrusted workspace. Review the repository and use VS Code's workspace-trust controls. Do not trust unfamiliar code merely to make AgentPilot run.

## Models do not appear

Model discovery requires an explicitly authorized AgentPilot-owned app-server. Open Chat, submit a harmless first turn, and review startup confirmation. Confirm Codex is authenticated and the native executable works. Opening Dashboard alone intentionally does not start discovery.

## A turn stopped after an approval

Denying or dismissing is fail-closed and may stop the turn. Start another turn if desired and approve only a specific action you understand. AgentPilot never changes Codex sandbox policy or auto-approves requests.

## Telegram configuration fails

- 401 / invalid token: copy a fresh token directly from BotFather into the password input.
- 403 / forbidden: start the bot chat, unblock it, or grant channel permission.
- 429 / rate limited: wait until the displayed retry time.
- timeout/network/TLS category: inspect proxy, firewall, certificate-inspection, and DNS policy.
- SecretStorage category: verify VS Code's platform credential store is available.
- unreadable/non-JSON response: a proxy or TLS inspection product may be replacing the Bot API response.

Run the credential-free connectivity diagnostic before changing credentials.

## Windows notification does not appear

Enable `AgentPilot: Enable Windows Notifications`, then run **AgentPilot: Test Windows Notification**. Check Windows Settings → System → Notifications, VS Code notification permission, Focus Assist/Do Not Disturb, and PowerShell policy. VS Code notifications and Telegram remain independent if native toast delivery fails.

## No usage data is visible

Lifecycle events do not necessarily include usage. Complete a turn through AgentPilot-owned Codex Chat or **AgentPilot: Run Codex Task**, then reopen Dashboard. Existing private official-extension sessions cannot be imported automatically.

If the Dashboard reports a malformed usage store, preserve `%USERPROFILE%\.agentpilot\usage.json` and restore a verified backup. AgentPilot intentionally refuses to overwrite malformed local state.

## Duplicate or uncertain notification

Stable IDs and persistent claims suppress normal duplicates. An uncertain Telegram request may already have reached Telegram; inspect the destination before manual retry. Retained deduplication data is bounded, so it is not an unlimited historical guarantee.
