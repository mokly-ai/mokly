# Define partial capture retention order

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 99, collector review finding 2.
- **Location:** `crates/mokly-compare/src/capture_collection.rs:32`,
  `crates/mokly-compare/src/capture_collection.rs:43`, and
  `crates/mokly-compare/README.md:103`.
- **Reason:** On 2026-10-21 the user deferred the open review items of PR #199
  until after its merge, for the user's later choice.

- **Source:** Review.
- **Category:** Docs or spec (estimate).
- **Terms:**
  - **Capture:** the bounded store of rendered views that one comparison
    keeps, so that Changes does not render them again.
  - **Summary charge:** the bytes that the capture counts for the render
    summary of a side. It grows as validation facts arrive.
  - **Source fallback:** a view outside the capture renders again from its
    side's source when Changes needs it.
- **Background:** One ordered collector validates and captures each view
  in route order, within one byte bound. `Collector::collect` keeps a view
  only when it fits the space that is left. `Collector::summary` raises the
  summary charge and calls `trim`, which removes the last kept routes first.
  On 2026-10-20 the rebuild applied this rule as a default, without the
  user's explicit approval. A skipped or trimmed view is not reconsidered
  and uses source fallback.
- **Problem:** Because the summary charge grows, a later view can stay while
  an earlier view that would fit the final capacity falls back to its
  source. The old exact membership and strict route priority are gone. No
  doc defines which views a partial capture keeps.
- **Impact if no action:** Output bytes stay the same. When memory is
  tight, the set of views that render again follows no stated rule, so a
  later change can alter it without notice.
- **Root question:** Which views should a partial capture keep when the
  capture bound cannot hold every view?
- **Options:**
  - **A.** Record the applied rule and that it was a default, beside the
    capture bound in `crates/mokly-compare/README.md`. Effort: Small.
  - **B.** Make route order strict: keep no later view after the first
    skip or trim. It is simple to state and test, but it can keep fewer
    views. Effort: Small (estimate).
  - **C.** Restore the old rule: apply retention again when the final
    capacity is known, and render each dropped view that then fits.
    Effort: Medium.
- **Left out:** An unbounded capture breaks the byte bound of the capture.
- **Wider fix:** C. A pass at the final capacity makes retention
  independent of the growing summary charge.
- **Previous examples:** None found.
- **Recommendation:** A. Output does not change, and the applied rule is
  already in the code. C best stabilizes which views stay.
- **Action:** ask the user, because condition 5 holds: on 2026-10-21 the
  user reserved the choice for each open review item of the rebuild.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5892).
