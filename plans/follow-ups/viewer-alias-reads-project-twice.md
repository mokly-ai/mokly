# Opening a viewer alias reads the project twice

- **Severity:** Medium. **Likelihood:** Common. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-05, from Milestone 6 of `plans/loading-states-match-content.md`, on the branch `calummoore/skeleton-sizing-mismatch`.
- **Location:** `apps/app/src/viewer/reference-redirect.ts`, `apps/app/src/screens/app/viewer-route.tsx` and the publication route under `apps/app/app/[workspace]/[project]/publications/`.
- **Reason:** The double read comes from how the alias redirect mounts the publication's route, which the loading-states change did not change.
- **Category:** Product bug.

- **Terms:**
  - **Alias:** A viewer address that names a branch or a pull request, which the app resolves to that reference's newest publication and then replaces with the publication's address.
  - **Frame wait:** The cloud frame that the viewer draws while it reads the project: the bar's controls as placeholders over the stage's waiting card.
- **Background:** When a reader opens a branch or pull request alias, the app reads the project, resolves the alias, and replaces the address with the publication's address. That address mounts the publication's route, which reads the project again.
- **Problem:** The frame wait shows twice. The reference trigger first shows the alias's name from the address, then its placeholder until the publication answers, then the name again.
- **Impact if no action:** Every alias open, the most common way into the viewer, draws its wait twice and makes one extra project read.
- **Root question:** How does an alias open the publication without reading the project and drawing the wait a second time?
- **Options:**
  - **A.** Keep the viewer route mounted across the alias redirect, so the publication's address reuses the project that the alias read. Effort: Medium.
  - **B.** Keep the route as it is, and seed the publication route's project read from the alias's answer, so it draws its loaded frame at once. Effort: Medium.
- **Left out:** Drop the address replacement. Readable publication addresses are a requirement of `docs/protocol/cloud/product-navigation.md`.
- **Wider fix:** A. One mounted route removes the second read for every alias.
- **Previous examples:** None found.
- **Recommendation:** A. It removes the extra read and the second wait together.
- **Action:** ask the user, because the options change how the viewer's routes mount, and no option is clearly best before a design read of the router.
