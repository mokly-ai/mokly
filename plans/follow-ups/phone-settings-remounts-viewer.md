# Phone settings remount the viewer

- **Severity:** Low. **Likelihood:** Common. **Effort:** Large. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-27, from the check of review finding 4 of round 2 on the branch `calummoore/multiple-org-configuration-error-9mms`.
- **Location:** `packages/app/src/screens/viewer/viewer-screen.tsx:167-174` (`openSettings`), `packages/app/src/settings/dialog-host.tsx:196-215` (the phone handoff), and `packages/app/app/_layout.tsx:28`.
- **Reason:** That branch did not change the viewer or the phone handoff.

- **Terms:**
  - **Viewer:** The screen that shows a project's mockup catalogue and its changes.
  - **Phone handoff:** The effect in `dialog-host.tsx` that, below the breakpoint, replaces a `?settings=` address with the pane's full-screen route.
- **Background:** The viewer opens settings by writing `?settings=...` to its own address. On a desktop the dialog draws over the viewer, which stays mounted. Commit `5a9f08007` kept the viewer mounted when a panel closes on a desktop. On a phone the handoff replaces the address with the pane route, and the root layout draws one route at a time.
- **Problem:** On a phone, opening settings from the viewer unmounts it. Back mounts it again, and its route reads through `useResource` start from loading. The catalogue source survives the rebuild (`packages/app/src/viewer/source-provider.web.tsx:7-10`).
- **Impact if no action:** A phone user who checks a setting waits for the viewer to load again and can lose its scroll place.
- **Root question:** How does the viewer survive a trip to settings on a phone?
- **Options:**
  - **A.** Keep the viewer's reads in a cache that outlives the route, so the remount draws at once from the cache and refreshes. The scroll place still resets. The design call of 2026-11-25 in commit `5a9f08007` rejected caching the project read, because "a cache would still remount the viewer and its stage". Effort: Medium.
  - **B.** Give full-screen settings a layout that keeps the page beneath mounted until the person returns. It breaks the one-route-at-a-time rule that `packages/app/src/navigation/leave-page.ts:18-23` and `packages/app/src/settings/layer-address.ts:40-48` rely on; that rule is a code comment, not a protocol requirement, so the change rewrites the comments and the code that depends on them. Effort: Large.
- **Left out:** Drawing settings as a dialog on a phone. `docs/protocol/cloud/settings-dialog.md:51-52` keeps each pane a full-screen route on a phone. Only two real places exist: the route layout and the data cache.
- **Wider fix:** B. It keeps every page beneath a phone settings trip.
- **Previous examples:** Commit `5a9f08007` fixed the desktop form of this class.
- **Related:**
  - `plans/follow-ups/repository-form-lost-on-settings-trip.md`, the same handoff: its option E is this item's option B.
  - `plans/follow-ups/account-shell-remounts-drop-focus.md`, the same file `packages/app/app/_layout.tsx`: its option C adds a route layout too, so one branch should design both.
- **Recommendation:** B. It keeps the viewer and every other page mounted through a phone settings trip, which the design call of 2026-11-25 already chose over a cache on desktop. It also best protects the codebase.
- **Action:** fix after merge, apply B, because the problem is outside that branch's change and costs the same later.
