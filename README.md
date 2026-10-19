# AgentPilot v0.6

AgentPilot is a local-first VS Code dashboard for coding-agent lifecycle events and verified token-usage metadata. Version 0.6 adds an AgentPilot-owned interactive Codex app-server chat while preserving the v0.5 task runner, usage analytics, and reliable Telegram and Windows notifications. AgentPilot does not upload prompts, source code, assistant messages, transcripts, authentication tokens, or credentials to its own servers.

## Install and run on Windows 11

Requirements: VS Code 1.90+, Node.js 22, Python 3 available as `python`, Git, and Codex CLI for CLI events.

```powershell
git clone https://github.com/Aissarak8/agentpilot.git
cd agentpilot
npm test
code .
```

Press **F5** to launch an Extension Development Host. In that window run **AgentPilot: Open Dashboard**. **AgentPilot: Test Notification** writes a clearly labeled test event; test events never trigger the real-event notification rules.

All data stays in `%USERPROFILE%\.agentpilot`. Existing v0.1 JSONL records remain readable. Events use `events.jsonl`, usage metadata uses `usage.json`, and sanitized Telegram delivery metadata uses `telegram-deliveries.json`. These files never contain bot credentials, prompts, source code, or conversation text.

## Codex CLI integration

This repository includes [`.codex/hooks.json`](.codex/hooks.json). Current official Codex lifecycle hooks provide `SessionStart`, `Stop`, `PermissionRequest`, `Interrupt`, and `SessionEnd`. AgentPilot maps those to session started, completed, attention, interrupted, and session ended. The payload fields retained are timestamp, provider, event kind, project name, hook name, session ID, turn ID, and model when Codex supplies them.

1. Start Codex CLI from this trusted repository.
2. Run `/hooks`, review the project hook definition, and trust it. Codex intentionally skips new or changed non-managed hooks until trusted.
3. Complete a turn, then check `%USERPROFILE%\.agentpilot\events.jsonl` or refresh the dashboard.

Manual adapter smoke test:

```powershell
'{"hook_event_name":"Stop","session_id":"smoke","turn_id":"turn-1","cwd":"C:\\work\\demo"}' |
  python scripts\hook.py codex auto
Get-Content "$env:USERPROFILE\.agentpilot\events.jsonl" -Tail 1
```

The repo-local setup is reversible: remove `.codex/hooks.json` (or disable its entries in `/hooks`). It does not edit or overwrite `%USERPROFILE%\.codex\config.toml`.

## Codex VS Code extension compatibility

The installed OpenAI Codex VS Code extension does not publish a VS Code extension API for turn-completion events. Official Codex documentation describes lifecycle hooks for local Codex threads, but CLI support alone is not proof that every VS Code extension build executes repo-local hooks. AgentPilot therefore does not scrape the Codex UI or use private extension internals.

The tested Windows extension (`openai.chatgpt` 26.908.40401) does not expose `/hooks` in its IDE slash-command menu, VS Code commands, or extension settings. Hook review and trust are currently documented for the Codex CLI TUI. To test whether CLI-established trust is shared with a new local IDE thread, launch the official Codex CLI from this repository, run `/hooks`, review and trust `.codex/hooks.json`, exit, and then start a new IDE chat in `/local` mode. This is a verification path, not a claim that the installed IDE build supports command hooks.

If the IDE still emits no matching event after CLI trust and a new local chat, treat IDE command-hook integration as unavailable for that build. Keep the verified CLI integration; do not use UI scraping or private extension APIs. For a separately built supported client, Codex app-server provides documented streamed lifecycle events, but AgentPilot does not attach to or intercept the private app-server instance owned by the OpenAI VS Code extension.

Status for v0.2:

- Codex hook payload parsing and storage: automated integration-tested with representative official payload fields.
- Codex CLI real turn: verified on Windows with the official `codex.exe` bundled by the Codex VS Code extension. The separate global npm installation remains incomplete because its optional `@openai/codex-win32-x64` package is missing.
- Codex VS Code extension real turn: not verified; enable only after confirming a real hook event appears locally for your installed extension version.
- Hook payloads identify Codex, session, and turn, but do not identify the client surface. CLI versus VS Code attribution therefore requires correlation with the initiating client/session and is not inferred in stored events.
- Agent failures: no documented local lifecycle hook in the tested interface exposes a general turn-failed event, so AgentPilot does not invent one. The adapter accepts `failed` for providers that explicitly supply it.

Official references: [Codex lifecycle hooks](https://learn.chatgpt.com/docs/hooks) and [Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference).

## Notifications

Settings under **VS Code Settings → AgentPilot** control completed-turn, attention, and error notifications. VS Code notifications are enabled by default. Optional native Windows notifications are disabled by default and use only the bundled local PowerShell script; they require no administrator rights, module installation, or network access. Events are deduplicated by stable event ID, so watcher and polling fallback cannot notify twice.

On Windows, AgentPilot first uses the registered Visual Studio Code AppUserModelID (`Microsoft.VisualStudioCode`). Some Windows builds reject a toast created by a helper PowerShell process with `E_ACCESSDENIED`; AgentPilot then uses the standard Windows notification-area balloon API. Run **AgentPilot: Test Windows Notification** to test this path independently of agent events. The **AgentPilot** output channel records only a sanitized category, exit code, and HRESULT. A successful API call cannot prove that a banner was visible because Do Not Disturb, Focus Assist, or Windows notification-center policy may silently route or suppress it.

## Telegram notifications

Telegram delivery uses the official HTTPS Bot API. The bot token and chat ID are stored in VS Code SecretStorage and are never written to settings, environment variables, hook arguments, the event log, or the repository. The hook process does not access Telegram credentials; the running AgentPilot extension observes the local metadata event store and performs delivery independently. A Telegram failure therefore cannot interrupt Codex.

Setup:

1. Create a bot with Telegram's official **@BotFather** and keep the token private.
2. Open the destination chat and send the bot `/start`. For a channel, add the bot with permission to post.
3. Obtain the numeric chat ID through a trusted Telegram workflow, or use a public channel username such as `@example_channel`. Do not paste the bot token into source files, shell history, issue reports, or logs.
4. In VS Code run **AgentPilot: Configure Telegram Bot Token**. AgentPilot validates it with the Bot API `getMe` method before storing it in SecretStorage.
5. Run **AgentPilot: Configure Telegram Chat ID**.
6. Enable **AgentPilot: Enable Telegram** in Settings or from the dashboard.
7. Run **AgentPilot: Test Telegram Notification** and confirm receipt.

Real notifications contain only agent name, normalized event type, project name, and timestamp. Completed turns and permission requests are queued using their stable source event IDs. A normal `SessionEnd` after `Stop` is suppressed; an independently configurable exceptional SessionEnd notification can be sent when no completion was observed.

Delivery metadata survives Extension Host restarts and records pending, sending, sent, failed, or uncertain state, attempt count, sanitized error category, next retry time, and Telegram message ID when Telegram confirms one. HTTP 429 honors Telegram's bounded `retry_after`; selected HTTP 5xx failures use bounded exponential backoff with jitter. HTTP 401 and 403 are terminal. A timeout, network disconnect, or extension restart during a send is **uncertain** because Telegram may already have received it, so AgentPilot never retries it automatically. Check the chat before using the dashboard's manual Retry action.

The queue is capped at 500 records and written atomically. Only one in-process worker may claim a delivery, with at most ten attempts per minute. Disabling Telegram prevents new attempts and prevents newly observed events from being queued. Enabling it later does not backfill historical events; use an explicit test notification instead.

Telegram delivery is verified for events written by the Codex CLI hook integration. Codex VS Code Extension completion hooks remain unverified, so Telegram delivery for IDE-hosted Codex turns is not claimed.

## AgentPilot-owned Codex task runner

Run **AgentPilot: Run Codex Task** from the Command Palette or dashboard. AgentPilot asks for a task, shows a modal confirmation, and starts an official `codex exec --json` child process in the first active workspace folder. The task text is sent over the child process's stdin and is never written to AgentPilot storage or logs.

Configure **AgentPilot: Codex CLI Path** with a working native Codex executable. On Windows this must be `codex.exe`, not a `.cmd` or `.bat` launcher. AgentPilot launches it directly with `shell: false`, inherits the existing supported Codex authentication environment, and does not add sandbox-bypass or automatic-approval flags. An optional exact model can be configured with **AgentPilot: Codex Task Model**; empty uses the normal Codex default.

The runner records only task ID, provider, project, model when explicitly configured, timestamps, status, duration, thread ID, normalized failure category, and usage-record ID. Metadata is stored atomically in `%USERPROFILE%\.agentpilot\codex-tasks.json` and capped at 100 tasks. Running metadata found after an Extension Host restart is marked interrupted; tasks are never silently relaunched.

Task completion, failure, cancellation, and timeout generate normal AgentPilot lifecycle events. These use the existing deduplicated VS Code, Windows, and Telegram notification pipeline. Use **AgentPilot: Cancel Codex Task** to terminate the owned process tree. The default timeout is 30 minutes and is configurable.

Important boundary: this command creates a separate AgentPilot-owned CLI task. It does not observe or control conversations in the official Codex VS Code Extension. Official OpenAI documentation recommends `codex exec` for bounded workflows and app-server for applications that own persistent conversations and approval handling: [Codex as a platform](https://developers.openai.com/blog/codex-as-a-platform) and [Codex app-server](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server). No supported observer API is documented for attaching to another extension's existing IDE conversation, so AgentPilot does not attach to private app-server instances, scrape UI, read private session files, or intercept authentication traffic.

### Manual runner validation

1. Start the Extension Development Host and set **AgentPilot: Codex CLI Path** to a working official native `codex.exe`.
2. Keep the dashboard open and optionally enable Windows and Telegram notifications.
3. Run **AgentPilot: Run Codex Task**, enter `Reply exactly OK. Do not use tools.`, review the workspace confirmation, and select **Run**.
4. Confirm the dashboard changes from running to completed and shows duration.
5. Confirm `%USERPROFILE%\.agentpilot\events.jsonl` contains `agentpilot_runner` start and completion events, `%USERPROFILE%\.agentpilot\usage.json` contains the matching explicit CLI usage, and `%USERPROFILE%\.agentpilot\codex-tasks.json` contains no task text.
6. Confirm the enabled notification destinations receive one completion notification. Telegram receipt and native Windows banner visibility require user confirmation in those destinations.
7. Start a second harmless task and run **AgentPilot: Cancel Codex Task** to verify interrupted status and child cleanup.

If a task reports `workspace_not_trusted`, Codex rejected the folder before creating a thread because it is not a trusted Git workspace. Open a trusted Git repository or initialize and review version control yourself, then retry. AgentPilot intentionally does not pass `--skip-git-repo-check`. If it reports `executable_not_found`, set **AgentPilot: Codex CLI Path** to the absolute path of a supported native `codex.exe`; shell launchers such as `.cmd` files are rejected.

## Interactive Codex chat

Open the AgentPilot activity-bar icon or run **AgentPilot: Open Codex Chat**. The sidebar starts a separate AgentPilot-owned `codex app-server --listen stdio://` process and communicates using newline-delimited JSON-RPC. It never connects to the private app-server instance owned by the official Codex VS Code Extension.

The MVP uses the stable documented protocol surface:

- `initialize` followed by `initialized` for compatibility and client identity.
- `model/list` for the model selector. The catalog is not treated as an entitlement guarantee.
- `thread/start` and `thread/resume` for new and continuing conversations.
- `turn/start`, `item/agentMessage/delta`, and `turn/completed` for multi-turn streaming.
- `turn/interrupt` for Stop.
- `thread/tokenUsage/updated` for explicit per-turn usage.
- `item/commandExecution/requestApproval`, `item/fileChange/requestApproval`, and `item/permissions/requestApproval` for explicit VS Code confirmation. Permission grants are limited to the current turn. AgentPilot never silently approves and does not offer session-wide approval in this MVP.

The active workspace must be trusted. AgentPilot passes no sandbox override, approval override, or workspace-trust bypass; the owned app-server inherits the supported Codex configuration and authentication used by the native CLI. Unsupported server-initiated requests fail closed with a JSON-RPC method error.

Chat text is held only in Extension Host memory for the current run. `%USERPROFILE%\.agentpilot\codex-chat-sessions.json` stores bounded metadata only: AgentPilot session ID, Codex thread ID, generic title, project, selected model, lifecycle status, timestamps, last turn ID, and a sanitized error category. After restart, AgentPilot can resume the Codex thread, but the sidebar intentionally cannot reconstruct prior message text. Prompts and assistant output are not copied into AgentPilot storage.

Turn completion, interruption, failure, and approval attention events use the existing deduplicated VS Code, Windows, and Telegram pipeline. Usage continues through the existing metadata-only `UsageStore` and dashboard analytics.

Official protocol references: [Codex App Server](https://developers.openai.com/codex/app-server) and [Codex as a platform](https://developers.openai.com/blog/codex-as-a-platform).

### Manual chat validation

1. Open a trusted Git workspace in the Extension Development Host and configure **AgentPilot: Codex CLI Path** with a supported native `codex.exe` if it is not already on the Extension Host PATH.
2. Open the AgentPilot sidebar. Confirm the model selector populates, create a conversation, and send `Reply exactly FIRST. Do not use tools.`
3. Wait for completed status and verify one completion notification in each enabled destination.
4. In the same conversation send `Reply exactly SECOND. Do not use tools.` Confirm the same Codex thread ID is retained in `codex-chat-sessions.json` and usage increases without duplicate records.
5. Start another harmless turn and select **Stop**. Confirm interrupted status.
6. For approval UI testing, request a harmless read-only command, review the exact VS Code modal, and choose Approve once or Decline. Never approve an action you do not understand.
7. Restart the Extension Development Host, select the prior session, and send a follow-up. The thread continues, while prior text remains absent by design.

## Token usage and cost analytics

AgentPilot records usage only when an official structured payload explicitly contains token counts. Lifecycle hook activity is never converted into guessed usage.

- **Claude Code:** the documented status-line JSON includes `context_window.current_usage`, model, session, prompt, and project information. Configure Claude Code's `statusLine.command` to pipe that JSON to this repository's local collector:

  ```json
  {
    "statusLine": {
      "type": "command",
      "command": "node C:\\absolute\\path\\to\\agentpilot\\scripts\\usage.js claude-statusline"
    }
  }
  ```

  Preserve other Claude settings when adding this entry. The collector reads stdin only, stores no conversation content, and repeated status-line invocations are deduplicated by session, prompt, model, and counts. Claude documents these fields as current-context/latest-response usage, not cumulative billing data.

- **Codex CLI:** lifecycle hooks still do not contain token counts. For automatic collection, run non-interactive CLI tasks through AgentPilot's transparent structured-output wrapper. It adds the official `codex exec --json` flag, passes JSONL through unchanged, and stores only the `turn.completed.usage` fields:

  ```powershell
  $env:AGENTPILOT_CODEX_PATH = 'C:\path\to\codex.exe'
  npm run codex -- --sandbox read-only "Reply exactly OK"
  ```

  `AGENTPILOT_CODEX_PATH` is only a process path, not a credential. On Windows the wrapper requires the native `codex.exe`; it rejects `.cmd` and `.bat` launchers so task text is never passed through a command shell. You can instead pass `--codex-path=C:\path\to\codex.exe` as the wrapper's first argument. The wrapper never writes prompts, responses, tool output, or raw JSONL. It records explicit input, cached input, cache-write input, output, and reasoning-output counts. Model attribution is stored only when `--model` is explicitly supplied; otherwise it remains `unknown`.

- **Codex app-server:** the public generated protocol includes `thread/tokenUsage/updated`, containing `last` and cumulative `total` token breakdowns. The adapter accepts the documented `last` values for application-owned app-server sessions. AgentPilot does not connect to, proxy, or intercept an app-server process owned by the Codex VS Code extension. Official guidance positions app-server as a protocol driven by the application that starts it: [Codex app-server](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server) and [Codex as a platform](https://developers.openai.com/blog/codex-as-a-platform).

- **Codex IDE and existing sessions:** no public VS Code extension API or official local usage export was found for observing existing IDE-hosted conversations. AgentPilot therefore does not scan Codex session files, inspect authentication data, attach to private sockets, or intercept network traffic. **AgentPilot: Import Structured Usage JSON** remains available for explicit, read-only imports from an official export containing a `usage` object.

Usage is stored atomically in `%USERPROFILE%\.agentpilot\usage.json`, capped at 5,000 records and retained for 90 days by default. Stable source IDs prevent duplicate imports. An adapter marked as cumulative is converted to incremental deltas using a persisted per-session cursor; Claude status-line records are treated as per-response snapshots and deduplicated without subtraction.

The dashboard offers 7-day, 30-day, and all-time local views grouped by provider, model, project, day, week, and verified data source. Dates use the machine's local timezone. Empty and partially priced data remain explicit.

### Pricing and overrides

Built-in prices include source URL, effective date, version, currency, and per-million-token rates. The current built-in Codex rate comes from the official [OpenAI API pricing](https://developers.openai.com/api/docs/pricing). Unknown models and Claude models are deliberately shown as **Unavailable** rather than assigned a guessed price. OpenAI also documents that API usage reporting can be best-effort and is not a final bill; see [Agents API observability](https://developers.openai.com/api/docs/guides/agents-api/observability).

Optional overrides can be added to `agentpilot.pricingOverrides`, keyed by `provider:model`:

```json
{
  "claude:your-exact-model-id": {
    "input": 3,
    "cachedInput": 0.3,
    "cacheCreationInput": 3.75,
    "output": 15,
    "unit": 1000000,
    "currency": "USD",
    "source": "your documented source",
    "effectiveDate": "2026-10-15"
  }
}
```

These are API-equivalent estimates, not subscription spend. Cache-creation records require an explicit cache-creation rate; otherwise the cost remains unavailable.

Official Claude references: [status-line input](https://code.claude.com/docs/en/statusline), [cost tracking](https://code.claude.com/docs/en/costs), and [hooks](https://code.claude.com/docs/en/hooks).

### Validate automatic Codex CLI usage

1. Start the AgentPilot Extension Development Host and open the dashboard.
2. Set `AGENTPILOT_CODEX_PATH` to a working official native `codex.exe` for that terminal only.
3. Run a harmless task through `npm run codex -- --sandbox read-only "Reply exactly OK"`. Optionally add `--model your-supported-model-id` when you know the exact model accepted by your account.
4. Confirm the CLI prints its normal JSONL and exits successfully.
5. Inspect `%USERPROFILE%\.agentpilot\usage.json`. A real record must have `source: "codex-cli-json"` and the CLI thread ID. No prompt or response text should appear.
6. Refresh the dashboard and compare its token cards to the `turn.completed.usage` values printed by that same run.
7. Run the collector against the same captured completion in the automated test or import it twice; the stable thread-and-usage identifier must leave one record after restart.

This validates only wrapper-owned Codex CLI turns. It does not validate the Codex VS Code Extension.

## Tests

```powershell
npm test
```

The suite covers event and usage normalization, malformed records, bounded atomic storage, persistent deduplication, cumulative-to-incremental conversion, dashboard grouping/date windows, pricing and overrides, Codex payload privacy, Telegram reliability, and Windows notification diagnostics.

## Manual reliability validation

1. Start the Extension Development Host, configure Telegram through AgentPilot, enable it, and keep the dashboard open.
2. From this trusted repository, run a harmless real Codex CLI turn and complete it. Confirm the resulting `Stop` record in `%USERPROFILE%\.agentpilot\events.jsonl` has `source: hook` and `test: false`.
3. Confirm one completion notification arrives in Telegram and the dashboard delivery row becomes **sent**, with one attempt. The following normal SessionEnd must not create a second delivery row.
4. For restart recovery, disable Telegram, enqueue a test only after re-enabling, or use a controlled test build that leaves a delivery pending; restart the Extension Development Host and confirm the pending row resumes. Never terminate while a real request is in flight merely to test this with a production chat.
5. For timeout safety, use a test-injected timeout in the automated suite. Confirm the row becomes **uncertain** with no automatic retry. In a manual environment, retry an uncertain row only after checking Telegram and accepting the duplicate warning.

These steps validate Codex CLI hooks only. IDE-hosted Codex completion hooks remain unverified and are not claimed.

## Troubleshooting

- **Hook does not run:** open `/hooks`, verify the repo is trusted, and trust the exact hook definition. Start a new Codex session after changing hooks.
- **`codex` PowerShell script is blocked:** use `codex.cmd`, or adjust your user-scoped PowerShell execution policy if your organization permits it.
- **Missing `@openai/codex-win32-x64`:** reinstall the official Codex CLI package, then confirm `codex.cmd --version` works before testing a real turn.
- **No event in the dashboard:** run the manual smoke test, inspect `%USERPROFILE%\.agentpilot\events.jsonl`, then use **Developer: Toggle Developer Tools** for AgentPilot errors.
- **No Windows toast:** keep VS Code notifications enabled; Windows toast APIs or notification policy may be unavailable. Agent tracking continues regardless.
- **Test Windows notification:** run **AgentPilot: Test Windows Notification**, then inspect **View → Output → AgentPilot**. `sent` means the toast API accepted it; `balloon_fallback` means Windows rejected the helper's toast identity and AgentPilot used the notification-area fallback. If neither is visible, turn off Do Not Disturb/Focus Assist and check **Settings → System → Notifications**, including Visual Studio Code and Windows PowerShell notification permissions.
- **Malformed JSONL line:** it is ignored safely; later valid lines still load.
- **Telegram says disconnected:** configure both secrets, enable Telegram, and send a test. “Connected” means enabled and configured; the delivery history reports each queued result.
- **Telegram test fails:** make sure the bot has received `/start`, the chat ID is correct, and local firewall/proxy policy allows `https://api.telegram.org`.
- **Delivery is uncertain:** Telegram may already have accepted the request. Check the destination before selecting **Retry**; manual retry can produce a duplicate.
- **Pending delivery remains pending:** confirm Telegram is enabled and credentials are configured. HTTP 429 and selected 5xx responses show a future retry time in the local delivery record.
- **Telegram token validation reports a response or proxy error:** run **AgentPilot: Diagnose Telegram Connectivity** in the Extension Development Host, then open **View → Output** and select **AgentPilot**. The diagnostic uses a synthetic invalid token and records only the error category, HTTP status, content type, content encoding, response byte count, and redirect flag—never a token, URL, authorization value, or response body. An `invalid_token` result with HTTP 401 and `application/json` confirms that the Extension Host can reach the Bot API; it does not validate your stored token.

## Known limitations

Status is inferred only from observed lifecycle events and may be `unknown`; it is not live process monitoring. Event reads and Telegram delivery history are each capped at 500 records. Telegram delivery requires the VS Code extension host to be running. Persistent deduplication is bounded by retained history. Telegram does not provide a general client idempotency key for `sendMessage`, so uncertain requests require a human decision. Codex lifecycle hooks and the tested Codex VS Code extension do not expose verified token usage. Automatic Codex usage collection requires starting CLI tasks through AgentPilot; it cannot retroactively cover existing CLI or IDE sessions. Cost estimates are not invoices, subscription costs, or model recommendations.

Interactive chat history text is memory-only, so selecting a persisted session after restart resumes its Codex context without reconstructing prior transcript text. The tested `codex-cli 0.154.0-alpha.6.2` generated protocol has no shutdown RPC; AgentPilot requests normal stdin EOF and retains a bounded process-tree termination fallback. Existing conversations in the official Codex VS Code Extension remain outside AgentPilot's supported integration boundary.
