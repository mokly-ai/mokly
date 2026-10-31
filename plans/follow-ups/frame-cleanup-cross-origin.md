# Frame cleanup throws after a cross-origin navigation

- **Severity:** Medium (estimate). **Likelihood:** Rare (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-31, from the branch `calummoore/mokly-ui-inspector`, during the gate of the third pull request of the shell views plan.
- **Location:** `packages/viewer/src/client/same_origin_highlight.ts:186` and `packages/viewer/src/client/same_origin_pointer.ts:85`, which call `win.cancelAnimationFrame(pending)` in their cleanup, where `win` is the frame document's window (`doc.defaultView`, lines 29 and 13). `packages/viewer/src/client/same_origin_mount.ts:126` has the same call on the shell's own window. The test is `tests/browser/browse_navigation_security.spec.ts:150`.
- **Reason:** No branch of the shell views stack changes the same-origin adapter, and the failure shows on `main` too.

- **Terms:**
  - **Same-origin adapter:** the viewer code under `packages/viewer/src/client`
    that mounts a preview document of the same origin in a frame, follows its
    pointer, and draws or measures its highlight.
  - **Cleanup:** the function that each adapter part returns. It removes its
    listeners and cancels its pending animation frame when the frame's
    document goes away.
- **Background:**
  - The browser test "sandboxed direct and nested content cannot escape or
    invoke parent enhancement" opens `/view/fixture/nested/home/`. Its
    sandboxed frame content tries to navigate the parent and the top
    window.
  - On 2026-10-31 it failed in browser shard 1 of `main`'s CI run for
    `7edabc30` (run 41195659145), and in browser shard 1 of the remote gate
    of `calummoore/mokly-ui-inspector` at `d5f23d2b`. Neither change touched
    the adapter.
  - Failure text, from the automatic browser error fixture: `pageerror`
    "Failed to read a named property 'cancelAnimationFrame' from 'Window':
    Blocked a frame with origin "http://127.0.0.1:44711" from accessing a
    cross-origin frame." at `/view/fixture/nested/home/`.
  - A frame's `WindowProxy` follows the frame to its next document. Once the
    frame shows a cross-origin or opaque-origin document, any property read
    on the old `win` throws. A cleanup that runs then, while `pending` is
    set, throws instead of returning.
- **Problem:** The shell raises an uncaught error when a frame navigates to
  another origin while an adapter part has an animation frame pending.
- **Impact if no action:** The browser suite fails at random, as `main`'s CI
  did on 2026-10-31, and a reader's console shows an error for a normal
  navigation.
- **Root question:** How does a cleanup cancel its pending work when its
  frame's document is no longer the frame's active document?
- **Options:**
  - **A.** Cancel through the document: `doc.defaultView?.cancelAnimationFrame(pending)`.
    A document that is no longer active has no `defaultView` and runs no
    animation frame callbacks, so nothing is left to cancel. Add a viewer test
    whose fake window throws on property reads after a navigation. Effort:
    Small.
  - **B.** A, plus one shared helper for every adapter part that schedules
    frame work, so each cleanup cancels the same way. Effort: Small.
- **Left out:** A `try`/`catch` around the call, because it hides other
  errors. A retry of the test, because the `deterministic-tests` skill rules
  out retries that hide a cause.
- **Wider fix:** B.
- **Previous examples:** None found.
- **Recommendation:** B. One helper removes the race from every part.
- **Action:** fix after merge, apply B, because the adapter is outside the
  shell views stack and the fix needs its own failing test.
