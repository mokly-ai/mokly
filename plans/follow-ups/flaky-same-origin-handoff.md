# Stabilize the same-origin handoff browser test

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #226 and its completed plan, which put the
  failure outside the scope of its review. On 2026-10-30 the duplicate item
  `flaky-same-origin-exact-resource-handoff.md` merged into this item. PR #250
  added it that day from the complete gate of its branch
  `calummoore/npm-run-dev-automation` at `f38892a7`. It failed again on
  2026-10-30 in browser shard 2 of the remote gate of
  `calummoore/mokly-ui-controls` at `1d81517f`, which did not change it, with
  "page.evaluate: TypeError: Cannot read properties of null (reading
  'dispatchEvent')" at the probe call of line 206, and the shard passed on a
  rerun.
- **Location:** `tests/browser/same_origin_identity.spec.ts:126`, with the
  probe call at line 206 and the probe helper at lines 245 to 273.
- **Reason:** The test failed in the remote gates of PR #226 and of the
  branch of PR #250, which did not change it, and it passed on each rerun.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Same-origin adapter:** the viewer frame adapter that mounts a preview
    document of the same origin in the `#frame` element.
  - **Handoff:** the window in which a new adapter mount replaces the
    document of a mounted frame.
- **Background:**
  - The test "an unowned exact-resource document gains no navigation
    privilege during handoff" starts at
    `tests/browser/same_origin_identity.spec.ts:126`.
  - It mounts the frame and clicks a link to the exact-resource document. It
    then starts a second mount of the same URL and holds that request in a
    route handler until the test releases it.
  - In detail, the frame first shows
    `/static/mokly-generated/home/index.mobile.html`. The link
    `#exact-resource-link` loads the same document with `?handoff=exact`. A
    `page.route` handler holds the second request of that URL, and the test
    waits for that held request before it probes.
  - While the request waits, `probeCurrentDocument` at line 245 reads the
    frame's current document. It finds `[data-mokly-link="action"]` with
    `querySelector` and dispatches a click on it at line 265.
  - The test calls the probe at line 206, and the probe's `page.evaluate`
    call is at line 246. The other test of the spec, "an unowned same-origin
    document gains no navigation privilege during handoff", calls the same
    probe at line 90.
- **Problem:**
  - Failure: the test failed once in browser shard 2 of 4 of the remote gate
    of PR #226 on 2026-10-28.
  - Failure text:
    `Cannot read properties of null (reading 'dispatchEvent')`. So the
    probe's `querySelector` found no element in the frame's current
    document.
  - Rerun outcome: the shard passed on its rerun, and the test passed ten of
    ten local runs.
  - Suspected source: the probe reads the frame document during the handoff
    race, before the expected document is in the frame. Nobody confirmed it.
  - Second failure: on 2026-10-30 the test failed in remote browser shard 2
    of 4 of the complete gate run `20261030T124708Z-261766`, on the branch
    `calummoore/npm-run-dev-automation` at `f38892a7`. That branch did not
    change the test.
  - Its failure text:
    `TypeError: Cannot read properties of null (reading 'dispatchEvent')`,
    at `probeCurrentDocument` on line 246, called from line 206.
  - Its rerun outcome: a local rerun of the spec file passed both of its
    tests.
  - Its suspected source: async ordering. The probe reads the frame document
    while the handoff replaces it, so `querySelector` can run on a document
    that does not hold the link yet. Another possible source is an empty
    document that the same-origin adapter shows during a handoff. Nobody
    confirmed either source.
- **Impact if no action:** The browser suite can fail at random on a correct
  change, and each failure costs a rerun. A real handoff defect can hide
  behind a flake label.
- **Root question:** How does the probe know that the frame shows the
  expected document before it dispatches the click?
- **Options:**
  - **A.** Reproduce the failure by repeating the test, and name the source.
    Then make the probe wait for an explicit signal that the frame's current
    document is the exact-resource document with its action link. Keep every
    assertion. Effort: Small.
  - **B.** Change nothing until the test fails again, and record the failure
    details in this item then. Effort: Small (estimate).
  - **C.** If the reproduction shows a product race in the handoff of the
    same-origin adapter, add a failing test first. Then fix the order in the
    adapter. Effort: Medium (estimate).
  - **D.** Reproduce the failure and name the source, as in A. Then make
    `probeCurrentDocument` wait for its selector in the current frame
    document before it dispatches the click, so that every caller probes a
    ready document. Its callers are the tests at lines 90 and 206. Effort:
    Small.
- **Left out:** A retry, a sleep, or a longer time limit. The
  `deterministic-tests` skill forbids them, because they hide the source.
- **Wider fix:** D. The shared probe helper then waits for a ready document
  for both of its callers. Until the merge of 2026-10-30, this item gave
  none, because the `deterministic-tests` skill already requires an explicit
  readiness signal, and it took the fix to be specific to this probe.
- **Previous examples:** Other browser tests that failed once and passed on
  the rerun:
  [flaky-viewer-selection-navigation.md](./flaky-viewer-selection-navigation.md)
  and [frame-adapter-message-flake.md](./frame-adapter-message-flake.md).
- **Related:** Each item below is a separate case of the same recorded
  class: a browser test that failed once and passed on the rerun. Each has
  its own test and suspected source, so each needs its own fix.
  - [flaky-viewer-selection-navigation.md](./flaky-viewer-selection-navigation.md):
    a viewer test whose page evaluation raced a navigation.
  - [frame-adapter-message-flake.md](./frame-adapter-message-flake.md): a
    frame adapter test that once got no navigation message.
  - [flaky-large-watch-react.md](./flaky-large-watch-react.md): the large
    React watch test, which timed out once at its 300-second guard.
- **Recommendation:** A (estimate). It removes the race from the test and
  keeps every assertion. D best protects every caller of the shared probe.
- **Action:** ask the user, because condition 6 holds (estimate): the
  failure was not reproduced and its source is not confirmed, so the
  `deterministic-tests` skill gives `ask the user`.

The duplicate item `flaky-same-origin-exact-resource-handoff.md` merged into
this item on 2026-10-30. Its fields map onto this item as follows:

- Its A, a wait in this test for the action link, is A without the first
  reproduction step.
- Its B, a wait inside `probeCurrentDocument` that it also named as the wider
  fix, is D.
- Its C, a check for an empty document during a handoff, then a failing test
  and an adapter fix, is C.
- It had the grades and the kind of this item.
- Its previous example was the first failure of this item, which the esbuild
  resolve fast path plan of PR #226 recorded.
- It recommended its B: reproduce the flake first and name its source, and
  ask the user when it does not reproduce.
- Its Action was `fix after merge, apply B`, because the test is outside the
  diff of the branch that found the failure. This item keeps its own Action,
  which asks the user.
- Its full text is in the [duplicate item at the commit before deletion](https://github.com/mokly-ai/mokly/blob/e9c20225af1b203bea236d29869c48f8c103668b/plans/follow-ups/flaky-same-origin-exact-resource-handoff.md).

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/esbuild-resolve-fast-path.md?plain=1#L430).
