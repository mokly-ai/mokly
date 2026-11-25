# Screen renders depend on an earlier story render

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from the implementation review of the branch
  `calummoore/storybook-track-b-finish-ekj1`, round 2, outside the scope.
- **Location:** `packages/mokly/src/sidecar/render.ts:35-41`, where only a
  story render reaches `renderStory`, which makes the setup active.
  `packages/mokly/src/sidecar/story-setup.ts`, `setupStories`, which keeps the
  one active `beforeAll` setup of the process. The section "Setup Before
  Render" of `docs/protocol/mokly-storybook-setup.md`, which states the setup
  rules for story renders only.
- **Reason:** The base branch behaves the same, and the fix needs a rule that
  no requirement states yet.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **`beforeAll` setup:** the state that the preview's `beforeAll` hook sets
    up for a bundle generation, such as a mock server, a fake clock, or a
    global theme. The state is shared by the whole process.
  - **Generation:** one compiled and loaded copy of the catalogue's JavaScript
    in a sidecar process.
  - **Sidecar pool:** the set of sidecar processes to which the core sends its
    renders.
- **Background:**
  - Each sidecar keeps at most one active `beforeAll` setup. A story render
    makes its generation's setup active before it composes the story. The
    setup stays active after the render, until a story of another generation
    renders in the same process.
  - A screen render, and a component render that is not a story, never make
    the setup active.
  - The core spreads renders over the sidecar pool, so the order of the
    renders in one process depends on scheduling.
  - "Setup Before Render" of `docs/protocol/mokly-storybook-setup.md` states
    the setup rules for story renders only. No rule says what a screen or a
    component render sees.
- **Problem:** A screen or component render sees the setup's state only when a
  story render of the same generation ran earlier in the same process. So its
  markup can depend on the process that the pool picks and on the render
  order. This was found by a read of the code. Nobody ran such a schedule.
- **Impact if no action:** The same screen can render different markup in two
  builds, or on the two sides of a comparison, so Changes can show a change
  that no source change caused.
- **Root question:** Which setup state does a screen or component render see,
  so that its markup does not depend on scheduling?
- **Options:**
  - **A.** Make the generation's `beforeAll` setup active before every render
    of a generation with a preview file, also before screen and component
    renders. Every render then sees the setup, also a screen that has no use
    for Storybook's setup. Effort: Small.
  - **B.** Release the active setup, with its cleanup, before each screen or
    component render, so that those renders never see it. A hook that returns
    no cleanup still leaves its state, and renders that alternate run the hook
    again at each switch. Effort: Small.
  - **C.** Render stories and the other entries in separate sidecar processes.
    Effort: Large.
- **Left out:** A note in the docs alone keeps the markup dependent on
  scheduling.
- **Wider fix:** A. One rule for every render of a generation removes the
  dependence on the render order.
- **Previous examples:** On 2026-11-20 the Storybook support plan decided that
  each sidecar keeps at most one active setup, for the same class: two loaded
  generations kept two setups on the shared globals.
- **Recommendation:** A. The setup is shared by the whole process by design,
  so every render of its generation then sees the same state. B keeps screens
  free of Storybook's setup, but a hook without a cleanup defeats it.
- **Action:** ask the user, because no requirement says whether a screen or a
  component render sees the preview's `beforeAll` setup, and each option sets
  that behaviour.
