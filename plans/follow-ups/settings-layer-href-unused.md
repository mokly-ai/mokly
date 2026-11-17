# The settings layerHref helper has no caller

- **Severity:** Low. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-06, from the check of finding 83 of the round 2 review of `calummoore/skeleton-sizing-mismatch`.
- **Location:** `ts/app/src/settings/surface.tsx:225` (`layerHref`).
- **Reason:** The helper is already on `origin/main` and unchanged by the change that found it.
- **Category:** Dead code.

- **Background:** `layerHref` builds a settings layer address.
- **Problem:** A search of the repository finds no caller of `layerHref`.
- **Impact if no action:** A reader looks for a use that does not exist.
- **Root question:** Is `layerHref` dead code?
- **Options:**
  - **A.** Confirm with the dead-code conditions of the `git-commit` skill (no reference, no indirect path, no outside consumer, nothing keeps it), then delete it and record the searches. Effort: Small.
- **Left out:** None. The conditions settle it.
- **Wider fix:** None.
- **Previous examples:** None found.
- **Recommendation:** A.
- **Action:** fix after merge, apply A, because it is outside the change that found it.
