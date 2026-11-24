# Story cleanups outlive their own render

- **Severity:** High. **Likelihood:** Common. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-24, from the implementation review of pull request
  #492, branch `conductor/storybook-support-b-story-reading`, findings 3
  and 4 of round 1, merged because they share one cause and one fix.
- **Location:** `packages/mokly/src/sidecar/render.ts:46-47`, where a story
  render calls `setupStories` and then `story.load()`.
  `packages/mokly/src/sidecar/story-setup.ts`, which keeps the one active
  `beforeAll` setup of the sidecar process. The "Setup Before Render"
  section of `docs/protocol/mokly-storybook.md`, the "Loaders and hooks"
  section of `docs/guides/authoring/storybook.md`, and the cleanup tests of
  `tests/sidecar_storybook_setup.test.ts`.
- **Reason:** The recommended option changes the documented cleanup timing,
  which no recorded decision covers, so the fix waits for the user.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **`beforeEach` cleanup:** a function that a story's `beforeEach` hook
    returns, to undo its setup.
  - **`beforeAll` setup:** the state that the preview file's `beforeAll`
    hook sets up for a bundle generation, with its own cleanup.
  - **Generation:** one compiled and loaded copy of the catalogue's
    JavaScript in a sidecar process. Serve makes a new one after each edit.
- **Background:**
  - Storybook's portable stories keep `beforeEach` cleanups in one
    module-level queue that the whole process shares. Portable `load()`
    first runs and clears that queue, and then runs the next story's
    loaders and `beforeEach` hooks and queues their cleanups. Storybook
    clears the queue only after every callback returns.
  - The protocol says: "A `beforeEach` cleanup runs before the next story
    loads, as in Storybook." A test asserts that a throwing cleanup fails
    the next story render. No user decision sets this timing.
  - On 2026-11-20 the plan's orchestrator decided that each sidecar keeps at
    most one active `beforeAll` setup. Before a story of another generation
    loads, the old setup's cleanup runs, and then the new generation's
    `beforeAll`. A hook that threw does not run again for its generation.
  - A render calls `setupStories`, the `beforeAll` swap, before `load()`,
    which runs the outgoing story's `beforeEach` cleanups.
- **Problem:** Probes against the sidecar build of commit `472f624d`
  showed five failures of one cause, story cleanups that wait in
  Storybook's shared queue:
  - After a generation switch, the outgoing story's `beforeEach` cleanup
    runs after the new `beforeAll` setup and undoes it. A probe set the new
    value to `B`, the old cleanup restored `A`, and the next render also
    showed `A`. The review reproduced this; its finding check was stopped
    before it ended.
  - A throwing `beforeEach` cleanup stays in the queue. Every later story
    render in that sidecar then fails with the same `render-failed`, also in
    another generation, and fixing the story does not recover the process.
  - A story's `beforeEach` state stays active in later screen and component
    renders of the same sidecar until another story loads. A probe rendered
    a screen that showed the story's value right after the story render.
  - When a later `beforeEach` hook throws, Storybook drops the cleanups that
    the earlier hooks returned, so their state stays until the process
    exits.
  - A throwing cleanup fails the next story view that loads, so the error
    names another story, and with several sidecar processes the failing
    story depends on render order.
- **Impact if no action:** After a rebuild in Serve, views can use old
  settings. One broken cleanup stops every later story render of the
  process. Story state leaks into screens that do not use it.
- **Root question:** How does each story render release its own setup once,
  so that neither its state nor its cleanup error reaches a later render?
- **Options:**
  - **A.** Drain the outgoing story's cleanups through a hook-free portable
    story before a generation switch, and wrap each callback so that it runs
    at most once, also when it throws. Storybook still owns the order, so
    the screen leak and the misnamed error stay. Effort: Small.
  - **B.** One sidecar coordinator owns both kinds of cleanup. It runs the
    outgoing story's cleanups before the old generation's cleanup and the
    new setup, detaches pending callbacks before it runs them, tries the
    rest after an error, reports the failure for the current render, and
    captures each cleanup when its hook returns, so that a throwing hook
    does not drop the earlier ones. It keeps the documented timing. Test the
    order with both hooks and a healthy render after a failure. Effort:
    Medium.
  - **C.** Replace the sidecar process after a cleanup failure. It resets
    the state, but the caller must restore the generation, and the warm
    process is lost. Effort: Large.
  - **D.** Release each story's setup inside its own render. Wrap the
    `beforeEach` hooks of the preview, the meta, and the story, so that each
    cleanup goes to a list for the current render and Storybook's shared
    queue stays empty. After the markup, run the list in reverse in a
    `finally` block, also when `load()` or the render throws, and call each
    callback once. Fail the render with the first cleanup error, or keep the
    render's own error. The wrapper must also cover the addon and core hooks
    of the composed project annotations. Update the protocol sentence, the
    guide, and the test that expects the next story to fail. Test a later
    story, another generation, and a screen after a failure. Effort:
    Medium.
- **Left out:** A retry cannot recover a cleanup that always throws.
  Swallowing the error hides a render failure. An upstream Storybook fix
  alone fails the installed versions. A Storybook module for each
  generation leaves later renders of the same generation failing. A Mokly
  loader pipeline replaces the `story.load()` flow that the user chose on
  2026-11-06. A separate realm for each generation needs a new evaluation
  design.
- **Wider fix:** D. No story cleanup then lives longer than its own render,
  whatever form Storybook's queue takes.
- **Previous examples:** The 2026-11-20 decision fixed the same class for
  `beforeAll` setups: two loaded generations kept two setups on the shared
  globals.
- **Related:** `plans/follow-ups/storybook-loaders-read-saved-args.md`, the
  same code in `render.ts`. Put the requested args on the story before any
  cleanup or setup runs. If this fix replaces `load()`, it must give the
  hooks the same args.
- **Recommendation:** D. It removes the late queue that causes all five
  failures, and it names the story whose cleanup threw, for the same effort
  as B. If the user keeps the documented timing, choose B.
- **Action:** ask the user, because D changes the documented rule that a
  `beforeEach` cleanup runs before the next story loads, and no recorded
  decision covers that change.
