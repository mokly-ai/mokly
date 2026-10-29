# Separate plain-text link existence from content identity

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Possible later change (decision work review finding 2, option C): key
every plain-text link target only by whether it exists, which also
removes the `plans/` special case. Preparation must then decide which
targets are resources, and a missed target would stop an edited asset
from changing its document key. Not decided.

## Decision

- **Source:** Review.
- **Category:** performance.
- **Background:** Markdown document keys include linked local inputs. Planning links currently use a special existence-only rule.
- **Problem:** Other plain-text links mix content identity with existence checks. A warm cache can otherwise hide a missing target.
- **Impact if no action:** The special case remains. Extending the rule later can miss an asset content change.
- **Root question:** How should Mokly separate plain-text link existence from content identity?
- **Options:**
  - **A.** Keep the planning-link special case and current keys. Effort: Small.
  - **B.** Check every plain-text target once for each generation outside the render cache. Effort: Medium.
  - **C.** Give each target separate content and existence inputs. Remove the planning-link special case. Effort: Medium.
- **Left out:** Keying every target only by existence can hide edits to linked assets.
- **Wider fix:** C.
- **Previous examples:** Decision work review finding 2 added the planning-link existence key.
- **Recommendation:** C. It models both reasons a document key must change.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5543).
