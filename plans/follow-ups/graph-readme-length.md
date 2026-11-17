# Graph README exceeds the shared length target

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-17, from the documentation check on `calummoore/mokly-parallel-render-keys-6m85`.
- **Location:** `crates/mokly-graph/README.md`.
- **Reason:** The long README predates parallel key calculation, and splitting its existing guidance belongs in a separate documentation change.

- **Background:** The graph crate prepares render generations and owns render workers and the bounded render cache. Its README combines integration guidance and entry points.
- **Problem:** The README had 313 lines before parallel key calculation and now has 318. The shared agent guide says to split a file that passes 300 lines.
- **Impact if no action:** The README remains above that target and mixes detailed cache guidance with other integration topics.
- **Root question:** How can the graph documentation stay short while preserving all integration guidance?
- **Options:**
  - **A.** Move the complete cache integration guidance to a linked page beside the crate README. Keep a cache summary and entry points in the README. Effort: Small.
  - **B.** Move the worker integration guidance to a linked page beside the crate README. This separates the forwarding checklist from the generation entry points. Effort: Small.
  - **C.** Split cache and worker guidance into separate pages together. This moves more content than the length problem needs. Effort: Medium.
- **Left out:** Deleting guidance would lose useful integration rules. Compacting prose or removing blank lines merely to fit the target would hide the length problem.
- **Wider fix:** None. The shared guide already sets the file length rule.
- **Previous examples:** None found.
- **Recommendation:** A. The cache guidance is one long, self-contained topic, so one move can bring the README below the target.
- **Action:** fix after merge, apply A, because the existing documentation split reaches beyond the key calculation change.

Preserve every current cache rule and every public entry point. Keep the
required crate README sections. Update local links and run Prettier and
`tests/markdown_links.test.ts` after the move.
