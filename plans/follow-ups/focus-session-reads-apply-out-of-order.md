# Older focus reads can replace newer account data

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-06, from review round 1 of the branch `calummoore/desktop-browser-authentication`, finding 1.
- **Location:** `apps/app/src/session/context.tsx:100` and `:141`, `apps/app/src/session/refresh.ts:28`, and `apps/app/src/data/use-slug-suggestion.ts:13`.
- **Reason:** The bug needs unusual response timing, and the fix moves a shared helper out of a file that the branch did not change.

- **Terms:**
  - **Focus refresh:** a session read that starts each time the desktop app's window gets focus, so that a GitHub connection or installation finished on the web appears without a reload.
  - **SessionProvider:** the app component in `apps/app/src/session/context.tsx` that holds the signed-in account data.
  - **Newest-request gate:** `createRequestSequence` in `apps/app/src/data/use-slug-suggestion.ts`, which lets only the newest request of a form apply its answer. A race test covers it.
- **Background:**
  - Desktop GitHub setup opens on the web, and the window reads the session again on focus. `docs/protocol/cloud/desktop-app.md` requires that a connection finished on the web appears without a reload.
  - SessionProvider keeps a generation counter that drops a start-up read once a sign-in or sign-out has replaced the session.
  - Each focus starts its own read at once. Overlapping focus reads read the same generation number.
- **Problem:** When two focus reads overlap, the older answer can land last and replace the newer one. A reviewer reproduced `githubConnected: true` turning back to `false`. A slow explicit reload, such as **Try again** on the session error screen, can replace a newer focus answer in the same way.
- **Impact if no action:** Account settings can show GitHub as not connected after the connection succeeded. The next focus or a reload corrects it.
- **Root question:** How does the app make sure that an older session answer never replaces a newer one on screen?
- **Options:**
  - **A.** Give focus reads their own sequence counter and drop older answers. A regression test needs a new browser probe, because no harness runs the provider's effects. Effort: Small.
  - **B.** Cancel the previous focus read when another starts, and keep the sign-in and sign-out protection. The same test cost as A. Effort: Small.
  - **C.** Route the start-up read, the reload and the focus read through one read owner that applies each answer. Effort: Small.
  - **D.** Build C on the newest-request gate. Move `createRequestSequence` into its own module under `apps/app/src/data/`. Each session read takes a new number, and adopt and sign-out invalidate it. A focus read that fails while the state is still `loading` behaves as a failed start-up read. Add a node test that settles two held reads in reverse order, a `loading` case in `apps/app/src/_tests_/session/refresh.test.ts`, and a test that fails when the window stops reading on focus. It also edits the slug hook and its test. Effort: Small.
  - **E.** Run one session read at a time, with one queued read for a focus during a read. A stalled read then holds back the latest focus read. Effort: Small.
- **Left out:** Changing nothing fails the requirement. Bumping the existing generation counter in the focus read can leave start-up loading forever after a failed focus read. A version on each API answer adds a migration for no gain. A debounce does not stop a slow read from overlapping a later one. Moving the session into `useResource` turns a failed refresh into an error state and has no adopt step.
- **Wider fix:** D. The gate cannot read the current number without taking a new one, so a new session read cannot repeat the defect.
- **Previous examples:** Commit `cb282fac` fixed a start-up session answer that replaced a newer sign-in in the same component.
- **Recommendation:** D. Every session read then follows one tested response-order rule.
- **Action:** Fix after merge, apply D, because the bug needs unusual response timing and D moves a shared helper outside the branch's files.
