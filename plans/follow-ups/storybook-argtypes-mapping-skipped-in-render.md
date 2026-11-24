# Story renders skip argTypes mapping

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-24, from a finding check of the implementation review
  of pull request #492, branch `conductor/storybook-support-b-story-reading`,
  listed outside the scope.
- **Location:** `packages/mokly/src/sidecar/render.ts:52`, where the story
  path renders the composed story with `story(args)`.
- **Reason:** The render before pull request #492 used the same portable
  call, so the review kept this problem out of that branch.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **argTypes `mapping`:** a Storybook option that maps a primitive arg
    value, such as `"arrow"`, to the value that the component gets, such as
    an icon element.
  - **argTypes `if`:** a Storybook option that hides an arg unless a
    condition on another arg or global holds.
- **Background:**
  - The sidecar renders each story through Storybook's portable story
    function, with the story's own non-data args and exactly the requested
    data props.
  - The portable story function builds its context with Storybook's
    `prepareContext`, which applies `mapping` and `if`, and then replaces
    `context.args` with the initial args and the extra args. So the render
    gets the raw args.
  - Storybook's own preview, and the loaders that portable `load()` runs,
    get the mapped args.
- **Problem:** A probe against the sidecar build of commit `472f624d`
  rendered a story whose `argTypes` map `a` to `MAPPED-A`. The render showed
  `a`, but its loader got `MAPPED-A`.
- **Impact if no action:** A story that maps a control value, such as an
  icon name to an icon element, renders the raw value in Mokly, unlike in
  Storybook.
- **Root question:** How does each story render get the same mapped args as
  Storybook's own preview?
- **Options:**
  - **A.** Apply each arg's `mapping` and `if` from the composed story's
    argTypes to the args before the render, in the sidecar's story path.
    Test a mapped select arg and a hidden arg. Effort: Small.
  - **B.** Render through Storybook's context with the args set before
    `prepareContext` runs, for example by setting the story's args before
    the call. It depends on how the portable story builds its context.
    Effort: Medium.
- **Left out:** An upstream Storybook fix alone fails the installed
  versions. A guide note that `mapping` does not work fails the goal.
- **Wider fix:** None, because this is one missing step of one call.
- **Previous examples:** None found.
- **Recommendation:** A. It is small, and it uses the argTypes that the
  sidecar already reads.
- **Action:** fix after merge, apply A, because the problem predates the
  branch that found it.
