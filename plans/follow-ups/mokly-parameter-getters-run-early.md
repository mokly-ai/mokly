# Getters of the `mokly` parameter run too early

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from the implementation review of the branch
  `calummoore/storybook-track-b-finish-ekj1`, finding 8 of round 2. Its
  finding check corrected the severity from High to Medium.
- **Location:** `packages/mokly/src/sidecar/story-parameters.ts:20` and `:32`,
  the two loops of `readStoryParameters`, which read each value with
  `Object.entries` before they check its name.
  `packages/mokly/src/sidecar/stories.ts:46`, where `describe` reads the
  `mokly` parameter of each story before any `beforeAll` setup runs.
  `docs/protocol/mokly-storybook-setup.md:86-95`, the table of malformed
  values in "Globals For Views". `tests/storybook_strict_build.test.ts:117`,
  the strict build test of malformed parameters.
- **Reason:** The failure names the stories file, so the author can remove
  the setting and build again, and the fix costs the same after the merge.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **`mokly` parameter:** a Storybook parameter whose `colorSchemes` and
    `viewports` fields map each Mokly view to Storybook globals.
  - **Getter:** a property whose value a function computes each time code
    reads the property. Authored code runs at that read.
  - **`combineParameters`:** Storybook's merge of the parameters of the
    preview, the meta, and the story into the composed parameters.
  - **`beforeAll` setup:** the state that the preview's `beforeAll` hook sets
    up for a bundle generation.
- **Background:**
  - The user chose on 2026-11-25 that Mokly ignores each malformed value of
    the `mokly` parameter with a `storybook-parameter-ignored` warning, and
    uses the valid rest. The name alone decides whether a field or a view
    name is supported. "Globals For Views" of
    `docs/protocol/mokly-storybook-setup.md` holds the rule.
  - `readStoryParameters` walks the fields and then the view names with
    `Object.entries`. That call reads each value, so an authored getter runs
    before the name check.
  - `describe` calls `readStoryParameters` for each story to collect the
    ignored values. No `beforeAll` setup runs before `describe`. A story
    render makes the setup active before it composes the story, and only a
    render does so.
  - When the preview, the meta, or the story set the `mokly` parameter at more
    than one level, `combineParameters` merges the maps and reads every value
    before Mokly's parser runs. The strict build test sets `mokly` and
    `viewports` at two levels, so a regression of the parser belongs in a unit
    test of `readStoryParameters`, not in that test.
- **Problem:**
  - A getter on an ignored name stops the build. In probes, a throwing getter
    on an unknown field or on `viewports.tablet` made `describe` fail with
    `bundle-failed`, and the valid `mobile` mapping never reached the
    catalogue.
  - A getter on a supported name that needs the setup also stops the build.
    `describe` reads it before any `beforeAll` setup runs, so `describe` fails
    with `bundle-failed`, while a render after the setup would read it.
- **Impact if no action:** One unsupported or setup-dependent setting can stop
  a build that should continue with a warning, or render after its setup.
- **Root question:** How does Mokly read the `mokly` parameter, so that an
  authored getter does not stop a build that should continue?
- **Options:**
  - **A.** Check each name before reading its value, in both loops of
    `readStoryParameters`, with one helper. Add a unit test of the parser that
    expects the warning and still returns the valid `mobile` mapping. It does
    not cover a map that two levels set, and it does not cover a getter on a
    supported name. Effort: Small.
  - **B.** Project the composed parameter into recognized fields and rejected
    names at the composition boundary, and let `describe` and the render use
    that projection. It reads the parameter at composition, so the render must
    keep the setup active before it, as it does now. Effort: Medium.
  - **C.** Before Storybook composes a story, copy the `mokly` parameter of the
    preview, with its default and named exports, of the meta, and of the story
    by property descriptor. Give each ignored name an inert value, such as
    `null`, without reading the old value, and keep the names so that the
    parser still warns. Storybook's merge then runs no getter of an ignored
    name. Effort: Medium.
  - **D.** Read the parameter by descriptor, and warn on a getter under a
    supported name. `describe` then runs no authored getter. It adds stricter
    validation, so it needs the user. Effort: Medium.
  - **E.** Make the generation's `beforeAll` setup active before `describe`
    reads the stories. A getter that needs the setup then works at `describe`.
    It adds setup work at `describe`, which no rule states, so it needs the
    user. Effort: Medium.
- **Left out:** A catch around each getter still runs the authored code of an
  ignored name.
- **Wider fix:** C. Neither Storybook's merge nor Mokly's parser runs a getter
  of an ignored name, at any level.
- **Previous examples:** Commit `d935e6a66` added `copyData` in
  `packages/mokly/src/authoring/data.ts:12`, which copies authored props
  without invoking accessors.
- **Related:** `plans/follow-ups/story-parameter-surrogate-warnings-merge.md`,
  the same code in `story-parameters.ts`. Neither fix waits for the other.
- **Recommendation:** A. It keeps a single-level map of ignored names from
  stopping the build, with a small change to the parser. A leaves the getter
  on a supported name open: D and E fix it, and each needs the user. C best
  protects the codebase, because it also covers maps that two levels set.
- **Action:** fix after merge, apply A, because it is a Medium product bug
  with the likelihood Rare, and its fix does not get harder after the merge.
