# Overlay push count survives a route change

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** Low. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from branch `calummoore/header-bar-loading-issue-mqph`, review round 1.
- **Location:** `packages/app/src/navigation/address.ts`, the `pushed` count, `writeAddress` and `undoAddress`.
- **Reason:** The defect is suspected and not reproduced, so it needs a reproduction in its own branch.

- **Terms:**
  - **Overlay:** a viewer panel or the settings dialog. Opening one pushes one history entry, and closing it undoes that entry.
  - **`pushed`:** the count in `address.ts` of the entries that the app pushed and did not undo yet. `undoAddress` goes back only while the count is above zero.
- **Background:** A Back or Forward step that the reader makes sets `pushed` to zero. A router navigation, such as a link inside an open panel, does not change `pushed`.
- **Problem:** A reader can follow a link inside an open panel to another route. The count then still holds the panel's entry, although that overlay is gone. A later close on the new route can then go back one entry too far, to the earlier route.
- **Impact if no action:** If the case occurs, one Close takes the reader back to the page they left. Nobody has seen it.
- **Root question:** How does the count of the app's own entries stay true across a router navigation?
- **Options:**
  - **A.** Reproduce the case in a browser spec. If it fails, set `pushed` to zero on each router `pushState`, which the history wrap in `address.ts` already sees. Effort: Small.
  - **B.** Store the overlay's own marker in the history state of each entry the app pushes, and undo only when the current entry has that marker. Effort: Medium.
- **Left out:** Drop the undo and always replace on close. That breaks the depth contract of `docs/protocol/cloud/web-product-shell.md`.
- **Wider fix:** B, because each entry then says whose it is, and no count can drift.
- **Previous examples:** None found.
- **Recommendation:** A. A reproduction decides first, and the reset is one line.
- **Action:** fix after merge, apply A, because no reproduction shows the defect yet.
