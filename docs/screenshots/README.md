# AgentPilot screenshots

These are real captures from AgentPilot user-testing sessions in VS Code, not generated mockups.

| File | What it shows | Version and privacy notes |
| --- | --- | --- |
| `dashboard-overview.png` | Dashboard overview, lifecycle statistics, token activity, and recent events | Historical v0.9 beta UI. Values are test history, not current billing. |
| `codex-chat.png` | AgentPilot-owned Codex Chat, conversation list, model selector, and completed status | Deterministically cropped from the supplied real capture to exclude conversation content containing a personal filesystem path. No UI content was generated. |
| `smart-model-advisor.png` | Local task classification and an evidence-based model recommendation | v1.0 RC UI. The visible usage context is historical evidence, not an independent quality score. |
| `usage-analytics.png` | Usage range controls, reconciliation controls, provenance warning, and token totals | Historical v0.9 beta UI. Legacy totals may contain the cumulative-snapshot uncertainty documented by the current release and are not provider billing or verified pricing. |
| `telegram-notification.png` | Metadata-only completion and test notifications delivered by the AgentPilot bot | Bot token and destination chat ID are not visible. Project name and timestamps are non-secret test metadata. |

The PNGs were losslessly recompressed; the four uncropped captures retain their original decoded pixels. The Chat crop retains original pixels and removes only the lower region containing the private path.

For future additions, use a current real build and remove usernames, local paths, private repository names, prompts, source code, thread IDs, credentials, chat IDs, and unrelated notifications. Never present a mockup as a product screenshot or historical usage totals as current billing.
