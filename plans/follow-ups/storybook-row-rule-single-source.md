# The Storybook row rule needs one home

- **Severity:** Low. **Effort:** Small. **Confidence:** Medium. **Harder later:** Yes.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from the branch
  `calummoore/storybook-milestone-1a-canvas-mockups-omnr`, review round 2,
  finding 10. It is the wider fix E of the finding check, which the branch
  split off its direct fix.
- **Location:**
  - `examples/basic/specs/design/canvas/stories/parts/branch.ts:43-50`,
    `linksStorybook`, the rule of the mockups.
  - `examples/basic/specs/design/canvas/stories/parts/inspect.tsx:28-44`,
    `StorybookLink`, and `:46-76`, `StoryHead`, which draws the Story and the
    Storybook rows.
  - `tests/fixtures/design/expectations.json:1773-1787`, the `viewFacts`
    rows of the three story pages.
  - `plans/storybook-support.md:2931-2946`, "Milestone 28: The Storybook link
    in the shell", and `:869-918`, decision 23 and its answer.
  - `docs/protocol/mokly-component-design.md:216-232`, the Story and the
    Storybook rows.
  - `packages/ui/src/metadata-row/metadata-row.tsx:24`, `MetadataRow`,
    `packages/ui/src/change-status/change-status.tsx:9`,
    `ChangeStatusValue`, and
    `packages/model/src/generated/catalogue/ChangesStatus.ts:4`,
    `ChangesStatus`.
- **Reason:** E needs the Storybook row of `@mokly/ui`, which Milestone 28 of
  `plans/storybook-support.md` adds after the mockup milestone of the branch.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **Story row:** the Details row of a stories entry's page that names the
    story that the page renders.
  - **Storybook row:** the Details row after the Story row. Its link,
    `Open in Storybook`, opens the same story in the published Storybook in
    a new tab.
  - **Changes state:** the `ChangesStatus` of the catalogue: `preparing`,
    `pending`, `ready`, `unavailable`, or `disabled`.
  - **Stories branch:** the depicted branch of the Storybook stories
    mockups. There the Menu's Expanded story changed, and the branch adds its
    Disabled story.
- **Background:**
  - Decision 23 of `plans/storybook-support.md` asks where a story page links
    when the published Storybook does not hold the shown story. The user
    chose B on 2026-11-25.
  - That answer says: the page of an added entry has no Storybook link. A
    changed story keeps its link. While Changes is not ready, and in a build
    without Changes, every story page shows its link.
  - `docs/protocol/mokly-component-design.md:216-232` states the rows that
    way. The status line of that page says that the shell shows no Story or
    Storybook row yet.
  - The mockups draw both rows in `StoryHead`. On 2026-11-25 the branch
    replaced a separate `storybook` flag of each story with `linksStorybook`,
    which returns false for an entry with the status `added`.
  - The stories branch has a ready Changes, so the mockups need no Changes
    state. The shell needs it, because it shows the link while Changes is not
    ready.
  - The design catalogue test "Props retries and Storybook Details show the
    expected values" reads the `viewFacts` rows of the story pages. They
    require the Story and the Storybook rows on
    `design/canvas/stories/storybook` and `design/canvas/stories/failed`. They
    require the Story row alone on `design/canvas/stories/storybook/added`.
  - Milestone 28 adds the link to `@mokly/ui` and renders it from the viewer
    container for entries with a Storybook URL. It renders the package
    component in the design library, in a form without an address. It adds
    tests under `packages/ui/tests` and `packages/viewer/tests`. It does not
    say where the rule for an added entry lives.
  - `@mokly/ui` has no Storybook row yet. `MetadataRow` draws one row of
    Details. `ChangeStatusValue` names the change statuses, and `ChangesStatus`
    of `@mokly/model` names the Changes state.
  - The orchestrator of `plans/storybook-support.md` owns Milestone 28. It can
    add E to the TODOs of that milestone and then delete this item.
- **Problem:** After Milestone 28 the rule would live in two places:
  `linksStorybook` in the mockups and the viewer container in the shell. The
  shell copy needs the Changes state and the mockup copy does not. So the two
  copies differ from the start, and they can drift further.
- **Impact if no action:** The shell and the mockups can disagree about an
  added story, or about a story page while Changes is not ready, and no test
  compares them.
- **Root question:** How do the shell and the mockups decide the Storybook
  row by one rule?
- **Options:** E and F follow the finding check on the source branch. The
  branch applied F: the row follows the entry's change status, and a check
  covers the rows on all three story pages.
  - **E.** Give the `@mokly/ui` Storybook row of Milestone 28 the entry's
    change status and the Changes state as props. Effort: Small.
    - The row draws nothing for an added entry while the Changes state is
      `ready`. It draws the link in every other case.
    - The viewer container passes the status of the entry and the Changes
      state of the catalogue.
    - The design library renders the package row in its form without an
      address. The stories fixture passes the status of each story and a
      ready Changes. Delete `linksStorybook`.
    - Test the rule once under `packages/ui/tests`. Cover an added entry
      while Changes is ready, and while it is `preparing`, `pending`,
      `unavailable`, and `disabled`, and a changed entry.
    - Keep the three story rows of the view facts passing.
  - **G.** Put the rule in a function of `@mokly/model`, the package of the
    catalogue rules that the viewer shares. The viewer container and the
    mockups call it, and the row draws the link that it gets. Test it under
    `packages/model/tests`. No mockup imports `@mokly/model` today, so the
    mockups gain a new import. Effort: Small.
  - **H.** Change nothing. Milestone 28 puts the rule in the viewer container
    with a test under `packages/viewer/tests`. The mockups keep
    `linksStorybook` and the view facts. The two copies can drift. Effort:
    Small.
- **Left out:** A read model that leaves out the Storybook URL of an added
  entry: the link must show until Changes is ready, so the rule needs the
  live Changes state.
- **Wider fix:** E. The package row that every caller renders then holds the
  rule, so the shell and the mockups cannot disagree.
- **Previous examples:** Commit `54e0a948e` gave each story of the mockups a
  `storybook` flag beside its change status. The branch derived the flag from
  the status on 2026-11-25.
- **Recommendation:** E. One rule in the package row serves the shell and the
  mockups, and one package test covers it. G fits instead if a caller without
  the row needs the rule.
- **Action:** fix after merge, apply E, because the Storybook row of
  `@mokly/ui` does not exist before Milestone 28 of
  `plans/storybook-support.md`.
