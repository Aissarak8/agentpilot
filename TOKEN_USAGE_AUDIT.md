# Token Usage Accuracy Audit

Audit date: 2026-10-22  
Branch baseline: `feat/premium-ui-v0.9` at `bc7d0375565d44f311f2fa1323adae3e3ca9c94d`  
Audited product version: `0.9.2-beta.1`

## Scope and privacy

This audit traced every structured usage path through the Codex CLI JSON collector, Codex app-server client, usage adapters, local `UsageStore`, chat turn/session totals, and dashboard aggregation. The existing local usage store was read only. The analysis used aggregate token fields and one-way session hashes; it did not retain or report prompts, responses, source code, credentials, raw telemetry, or private identifiers.

## Protocol evidence

- Codex CLI JSONL emits a usage object on `turn.completed`. AgentPilot stores that once as an incremental per-turn record.
- Codex app-server emits `thread/tokenUsage/updated` repeatedly during a turn. Its `tokenUsage.last` values behaved as cumulative snapshots of the current turn in every observed multi-record sequence: values increased monotonically and the final snapshot represented the turn total.
- `tokenUsage.total` is a broader thread total and is intentionally not used when `last` is present.
- Input and output determine the observed `totalTokens` (`input + output`). Cached input is a subset of input. Reasoning tokens are output detail when exposed and must not be added to the total again.

The official Codex documentation search did not expose field-level token accounting semantics sufficient to settle `last` versus delta behavior. The installed package metadata identified Codex `0.147.0`, but a live schema probe could not be run because the local CLI installation is missing its optional native package `@openai/codex-win32-x64`. No software or global configuration was changed. The conclusion above is therefore grounded in the public structured message shape, existing protocol fixtures, and the internally consistent behavior of real local metadata—not an undocumented private interface.

## Confirmed defect

`CodexAppServerClient` explicitly labeled every `tokenUsage.last` update as `incremental`. Each changed snapshot received a distinct stable record ID because its token values changed. `UsageStore` consequently retained every intermediate cumulative snapshot and the dashboard summed them all. A model-attribution change could also create a different cursor under the previous cursor key. Restart/replay of a final snapshot was not reliably suppressed.

The dashboard arithmetic itself was correct for the records it received. The overcount originated before aggregation. The CLI collector was not implicated, and no session in the audited store appeared in both CLI and app-server sources.

## Reconciliation of the local store

The store contained 59 records at the time of analysis. The original file was not modified.

| Measure | Raw stored total | Reconciled total |
| --- | ---: | ---: |
| Codex CLI JSON | 54,063 | 54,063 |
| Codex app-server | 4,633,329 | 253,336 |
| All sources | 4,687,392 | 307,399 |

The app-server reconciliation grouped records by session, sorted them by timestamp, treated a decrease as a new monotonic turn run, and retained the final snapshot of each run. All seven observed app-server sessions formed one monotonic run each. This method removes 4,379,993 tokens of demonstrable repeated snapshot accumulation.

The largest affected session (hash prefix `f7bb64fc81`) contained 47 snapshots. Its raw sum was 4,475,245 tokens; its final snapshot was 143,795 tokens, for an overcount of 4,331,450. The largest observed final turn/session snapshot was also 143,795 tokens.

Reconciled explicit fields were:

- Input: 306,313
- Output: 1,086
- Total: 307,399
- Reported cached input: 43,136, present only on the three CLI records
- Reported reasoning detail: 73

The known non-cached CLI input is 10,727. A complete non-cached total cannot be verified because 56 app-server records omitted cached-input detail. Treating an omitted field as zero would overstate certainty.

## Fix

- App-server `last` updates are now classified as cumulative snapshots.
- Cursors are scoped by provider, session, source, and turn ID, not model name.
- Turn IDs are retained as bounded metadata so separate turns do not share a cursor.
- The persisted cursor survives Extension Host restart and suppresses replayed final snapshots.
- Partial snapshots retain previously observed cursor fields.
- Chat receives the stored delta rather than the raw cumulative snapshot.
- Dashboard labels now state that cached input is a subset, reasoning is output detail, non-cached values require explicit cache fields, and API-equivalent cost is not direct billing.

The fix affects newly received app-server usage. It does not silently rewrite historical data.

## Historical migration plan

Automatic repair of the existing store is unsafe because historical records did not retain app-server turn IDs. A reversible migration, if added later, should:

1. Copy `usage.json` to a timestamped backup.
2. Run an offline dry-run grouped by source and session, splitting only on clearly decreasing snapshots.
3. Present raw and proposed totals plus ambiguous groups for user review.
4. Write a separate reconciled file only after explicit approval.
5. Preserve the original file and support one-step rollback.

Until such a reviewed migration exists, legacy app-server totals remain overstated. New records collected after this fix are delta-normalized correctly.

## Limitations

- Existing IDE-hosted Codex sessions are only covered when they run through the AgentPilot-owned app-server client; AgentPilot does not attach to the official Codex VS Code extension's private process.
- Historic app-server records cannot be attributed to exact turns because the old schema discarded turn IDs.
- Cached and reasoning breakdowns are displayed only when the protocol explicitly exposes them.
- Token usage is not equivalent to subscription billing, quota consumption, or invoice totals.
