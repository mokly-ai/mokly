# Story loaders read saved args, not edited props

- **Severity:** High. **Likelihood:** Common. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-24, from the implementation review of pull request
  #492, branch `conductor/storybook-support-b-story-reading`, finding 2 of
  round 1.
- **Location:** `packages/mokly/src/sidecar/render.ts:41-52`, the story path
  of `render`, which composes the story, sets the view globals, runs
  `setupStories` and `story.load()`, and only then lays the requested props
  over the story. `tests/sidecar_storybook_setup.test.ts`, the loader and
  `beforeEach` tests. The "Setup Before Render" section of
  `docs/protocol/mokly-storybook.md` and the "Loaders and hooks" section of
  `docs/guides/authoring/storybook.md`.
- **Reason:** The orchestrator merged pull request #492 before its review
  findings were fixed, and asked for each open finding as an item.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Loader:** a Storybook callback that prepares data, which the story
    reads as `loaded`.
  - **Data props:** the args of a story that are plain data. Mokly saves and
    edits them. The other args, such as callbacks, stay as the file defines
    them.
- **Background:**
  - Before each story render, the sidecar runs the story's loaders and
    `beforeEach` hooks through Storybook's portable `story.load()`.
  - On 2026-11-23 the plan's orchestrator decided that each story renders
    with its own non-data args and exactly the requested data props. The
    sidecar passes `undefined` for each data arg that the request leaves
    out, so "unset" of an optional prop in Serve works.
  - Portable `load()` reads the composed story's stored args, `story.args`,
    not the request. The render then lays the requested props over the
    story.
- **Problem:** Loaders and `beforeEach` hooks see the saved args, while the
  render sees the requested ones. A probe against the sidecar build of
  commit `472f624d` rendered
  `loader=Saved render=Edited | beforeEach=SavedNote render=EditedNote` for
  an edit. With the prop `note` unset, `beforeEach` still saw `SavedNote`.
  The track B change caused this, because the sidecar called no `load()`
  before it.
- **Impact if no action:** In Serve, a preview can show loader data for
  another state than the Props panel shows, and an unset prop keeps its
  saved value in the loader output.
- **Root question:** How does each render use the same inputs for its setup
  and for its markup?
- **Options:**
  - **A.** Put the requested data props on the freshly composed story's
    `args` before `load()`, and remove each data key that the request
    leaves out, as Storybook's own args store does. Render from that same
    state with no second overlay. Test an edit and an unset. Effort: Small.
  - **B.** Supply the effective args during Storybook composition. It adds
    a composition step for each request and a copy rule for each story
    form, and it keeps an unset meta arg as a key with `undefined`. Effort:
    Medium.
  - **C.** Do A, and write the rule: in "Setup Before Render" of
    `docs/protocol/mokly-storybook.md`, say that loaders and `beforeEach`
    hooks get the same args as the render. Say the same in "Loaders and
    hooks" of the guide. A probe showed that the loader then sees the edit
    and gets no key for the unset prop. The 2026-11-23 decision settles
    these sentences, so C does not wait for the user. Effort: Small.
- **Left out:** A Mokly runner for loaders and hooks: A is better on every
  point, and Storybook does not export its `prepareContext`. Wrappers for
  each loader and hook: A is better on every point. Storybook's portable
  `run()`: it mounts into a DOM and runs `play` and `afterEach`, which the
  protocol forbids. A guide note that hooks read the saved args: it fails
  the goal.
- **Wider fix:** None, because A and C leave one args object that every
  Storybook stage reads. A and C rely on `story.args` being the object that
  `load()` reads, as the view globals already do; the new test of an edit
  and an unset catches a Storybook version that breaks this.
- **Previous examples:** The 2026-11-23 decision fixed the same class for
  the render: a render kept a saved arg after the user unset it.
- **Related:** `plans/follow-ups/storybook-story-cleanups-outlive-their-render.md`,
  the same code. Put the requested args on the story before any cleanup or
  setup runs, so that both fixes work in either order. If that item's fix
  replaces `load()`, it must give the hooks the same args.
- **Recommendation:** C. It fixes the defect and states the rule whose
  unclear text let the defect through.
- **Action:** fix after merge, apply C, because the pull request merged
  before its review findings were fixed.
