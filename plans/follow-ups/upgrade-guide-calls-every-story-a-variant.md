# Upgrade guide calls every story a variant

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from the review fix round 1 of the branch
  `calummoore/storybook-track-f-failed-stories-omid`, as a problem outside
  its scope.
- **Location:**
  - `docs/guides/start/upgrade.md:71-72`, a bullet of the section "Update
    your authoring".
  - `docs/protocol/mokly-storybook.md`, sections "The Entry And Its
    Variants" and "Args And Props".
  - `docs/guides/authoring/storybook.md:40-44`, in the section "Add a
    stories file".
- **Reason:** The stale line is older than the branch that found it, and that
  branch does not change the entry rules of a stories file.

- **Source:** Implementation.
- **Category:** Docs or spec.
- **Terms:**
  - **Parent page:** the page of the component entry of a stories file, at
    the path of the file, which renders the first included story.
  - **Variant:** a page at the parent's path plus the export name of its
    story as the slug.
  - **Data args:** the args of a story that Mokly keeps as props, after it
    leaves out actions, functions, React elements, and args that argTypes
    hide.
- **Background:**
  - `docs/guides/start/upgrade.md`, "Upgrade to the Rust core", tells authors
    what to change when they upgrade. The guides under `docs/guides` ship
    with the npm package and describe the released product.
  - Lines 71 and 72 say: "A Storybook file is one component. Its stories are
    variants, and their args are props. `argTypes` gives control hints only."
  - Section "The Entry And Its Variants" of `docs/protocol/mokly-storybook.md`
    makes the first included story in source order the parent page. Each
    other included story is a variant.
  - The user chose this on 2026-11-06, in the brainstorm of the Storybook
    support plan, because it matches the docs page of Storybook. Commit
    `ff85f9580`, "feat(storybook): render the first included story as the
    parent page", of 2026-11-23, applied it on the branch
    `calummoore/mokly-storybook-integration`. That commit did not change the
    upgrade guide.
  - On `origin/main`, each story is still a variant, and the meta's `args`
    are the props of the parent. So the line becomes wrong on `main` when the
    integration branch merges.
  - Section "Args And Props" of the same protocol page says that only the
    data args of a story are props. The composed argTypes decide which args
    are data args, and each story render applies their `mapping` and `if`.
    So argTypes give more than control hints.
  - `docs/guides/authoring/storybook.md:40-44` already says that the first
    included story becomes the parent page, and that each other included
    story renders as a variant.
- **Problem:** The upgrade guide says that every story of a stories file is a
  variant, but the first included story is the parent page. It also says
  that all args are props and that argTypes give only control hints.
- **Impact if no action:** An author who upgrades looks for the first story
  among the variants and does not find it there. The author can also expect
  an action or a function arg to show as a prop.
- **Root question:** How should the upgrade guide describe the entry that a
  stories file gives?
- **Options:**
  - **A.** Rewrite the bullet to match the protocol, for example: "A
    Storybook file is one component. Its first included story is the parent
    page, and each other included story is a variant. Their data args are
    props, and `argTypes` give control hints." End it with a link to the
    Storybook guide, at the site route `/docs/authoring/storybook/`. Effort:
    Small.
  - **B.** Replace the bullet with one sentence that links the Storybook
    guide. The upgrade guide then states no Storybook rule of its own, and the
    reader must open the guide to see what changes. Effort: Small.
- **Left out:** Change the code back so that every story is a variant: it
  breaks the choice that the user made on 2026-11-06, a decision in force.
- **Wider fix:** None. The `documentation` skill already requires a guide and
  its protocol page to describe the same behaviour.
- **Previous examples:** Lines 94 and 95 of the same guide say that each
  component render sets up its own providers, which is also wrong.
- **Related:** `plans/follow-ups/upgrade-guide-overstates-component-providers.md`,
  the same file. One branch can fix both. Neither fix waits for the other.
- **Recommendation:** A. The bullet then matches the protocol, and the reader
  still sees what changes for a stories file.
- **Action:** fix after merge, apply A, because the line is outside the scope
  of the branch that found it.
