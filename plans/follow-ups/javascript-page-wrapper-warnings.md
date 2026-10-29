# Report JavaScript page wrapper attribute warnings

- **Severity:** Medium. **Effort:** Large.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** The sidecar render record and callback HTML diagnostics.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** product bug.
- **Background:** Authored HTML wrappers emit `html-ignore-attribute` warnings. JavaScript `renderPage` callbacks return HTML through the sidecar.
- **Problem:** Callback wrappers silently lose unknown attributes because the sidecar render record has no warning transport.
- **Impact if no action:** The same invalid wrapper has different diagnostics by authoring format.
- **Root question:** How should Mokly report JavaScript page wrapper attribute warnings?
- **Options:**
  - **A.** Add warning transport to the sidecar record and report each callback wrapper attribute. Effort: Large.
  - **B.** Define callback HTML as warning-free and limit the warning to authored bodies. Effort: Small.
- **Left out:** Parsing callback HTML in JavaScript duplicates the Rust HTML checks.
- **Wider fix:** A. Shared warning transport aligns every callback diagnostic.
- **Previous examples:** F22 recorded this as user item 138.
- **Recommendation:** A. It preserves one warning rule for authored and callback HTML.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5800).
