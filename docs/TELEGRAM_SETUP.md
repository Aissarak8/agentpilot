# Telegram Setup

## Create and prepare a bot

1. Open Telegram and contact the verified **@BotFather** account.
2. Create a bot and copy its token directly into AgentPilot when prompted.
3. Start a chat with the bot and send `/start` so it can message you.
4. Obtain the numeric destination chat ID using a trusted Telegram workflow. A valid public channel username such as `@example_channel` is also accepted when the bot has permission to post.

Never save a real token or chat ID in the repository, VS Code settings JSON, environment variables, screenshots, shell history, or issue reports.

## Configure AgentPilot

1. Run **AgentPilot: Configure Telegram Bot Token**. The token is validated with the official Bot API `getMe` method before SecretStorage persistence.
2. Run **AgentPilot: Configure Telegram Chat ID**.
3. Enable `AgentPilot: Enable Telegram` in Settings or Dashboard → Notifications.
4. Run **AgentPilot: Test Telegram Notification** and verify receipt yourself.

The local queue stores metadata only. It records source event ID, agent, event type, status, attempts, timestamps, sanitized error category, retry time, and confirmed Telegram message ID.

## Delivery behavior

- HTTP 401: invalid bot token; not retried automatically.
- HTTP 403: bot lacks access or is blocked; not retried automatically.
- HTTP 429: rate limited; AgentPilot respects a bounded `retry_after` value.
- Selected HTTP 5xx failures: retried with bounded exponential backoff and jitter.
- Timeout/network interruption after sending: **uncertain**. Telegram may have accepted the message, so AgentPilot does not automatically resend it.
- Missing/disabled configuration: no network request is made.

For an uncertain delivery, check Telegram first. Dashboard manual retry warns that it can create a duplicate.

## Safe connectivity diagnostics

Run **AgentPilot: Diagnose Telegram Connectivity**. It sends a credential-free request with a synthetic invalid token and logs only sanitized metadata such as error category, HTTP status, content type/encoding, byte count, and redirect status. Expected HTTP 401 JSON confirms network reachability; it does not validate your stored token.

Telegram messages contain only agent name, event type, project name, and timestamp. Prompts, source code, transcripts, credentials, and raw event payloads are excluded.
