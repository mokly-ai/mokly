# Site home: Browse shows the click-through

Status: Active. On branch `calummoore/missing-browse-feature-7h2l`, no pull
request yet. The pull request that completes the work deletes this plan, as
the `plans` skill says.

The features section of the site home has three modules: 01 Browse, 02 Review
and 03 Edit. The 01 Browse module draws the pull request check, the viewer's
Changes filter and the Swipe compare, so it shows the visual diff, not
browsing. No drawing on the home opens a second screen, although the hero
promises "an interactive mockup of your entire app" and the product already
follows a link inside a screen to its destination
([Browse guide](../docs/guides/catalogue/browse.md)). This change adds a new
01 Browse module that shows a click from one screen to the next. Today's
module becomes 02 Changes with its heading and demo unchanged. Review
and Edit become 03 Review and 04 Edit. The change does not touch the hero,
the spread, the open foundation, the product, or any other page.

## Decisions

Cal answered decisions 1 and 2 on 2026-11-25, in the brainstorm of this
workspace. The brainstorm notes are in
`.context/home-browse-click-through/brainstorm.md`. The options check of the
same day added options F to decision 1 and D and E to decision 2, and it
found decision 3. A second check of the same day added options E, F and G
to decision 3. Both reports are in
`.context/site-home-browse-click-through/options-check-report.md`. Decision 1
stays chosen, because the check still recommends C. Decisions 2 and 3 are
open.

1. **How the home shows that a reader can click through a branch's screens.**
   Chosen: **C**, a fourth module. The new 01 Browse shows a click on a link,
   and the next screen opens. Today's module becomes 02 Changes with its
   heading and drawing. Review and Edit become 03 and 04. Alternatives:
   - **A.** Prototype link lines between three screens of the spread, and
     01 Browse renamed to 01 Changes. Rejected: no heading names the
     click-through, and `Browse, review, edit.` then names a module that is
     gone.
   - **B.** The Swipe drawing in 01 Browse replaced by a link click.
     Rejected: the home loses the visual diff drawing and the approved
     heading `A visual diff for every branch.`
   - **D.** Three modules with content moved: Browse shows the click-through
     and Review takes the check card and the Swipe drawing. Rejected: it
     redraws two approved demos, and `Sticky comments.` then describes only
     part of its module.
   - **F.** Added by the options check. The new 01 Browse holds a real
     control that opens the next drawn screen, and the built page shows the
     finished state. Not chosen: it needs a new requirement in
     [Site](../docs/protocol/cloud/site.md#boundary), because drawings take
     no focus today, and readers then expect every drawn control to work.
     Effort: Large.

   Left out: change nothing or rename only, because no drawing shows a
   click. An embedded Mokly build, because Site decision 2 rejected it as
   catalogue work. A docs page or a new route, because it is not on the home.

   Reason: C is the only option that gives the click-through its own heading
   and drawing and keeps every approved drawing and heading.

2. **The copy of the new module and of the module after it.** Open. Cal chose
   **A** before the options check added D and E.
   - **Root question:** Which words name the click-through, and do the lead,
     the headings and the module bodies still read as one message in the new
     order?
   - **Background:** The features lead is `Every branch becomes a catalogue
your whole team can open.` Today's Browse body, which moves to 02
     Changes, starts with `Each branch and pull request publishes a catalogue
built from your real components.` In the new order that sentence comes
     after the click-through. [Product copy](../docs/protocol/cloud/product-copy.md)
     says to say each thing once. Cal's decision of 2026-11-19 fixed the
     heading `A visual diff for every branch.`, not the body.
   - **Options:**
     - **A.** Heading `Click through every screen.` Body `Open any branch and
follow its links from screen to screen, as in the real app.` Keep the
       features heading and the Changes body. The body repeats the heading
       and the lead. Effort: Small.
     - **B.** The copy of A, with the features heading changed to `Browse,
compare, review, edit.` The same repeats stay. Effort: Small.
     - **C.** Cal's own copy. Effort: Small.
     - **D.** Heading `Click through every screen.` 01 Browse body `The
screens use your real components, and their links work as in your
app.` 02 Changes body `Changes shows what moved, and the check on the
pull request counts it.` Keep the features heading. One approved body
       sentence moves. Effort: Small.
     - **E.** Heading `Click through every screen.` 01 Browse body `Screens
open on mobile and desktop, and their links work as in your app.`
       Keep the Changes body and the features heading. The catalogue
       sentence still comes after the click-through. Its words name desktop
       frames that the drawing does not show. Effort: Small.
   - **Left out:** None. The options cover the new body, the Changes body
     and the features heading.
   - **Recommendation:** D. It says each thing once and puts the components
     fact first. It replaces the first recommendation, A.

3. **Which link the Browse drawing clicks.** Open.
   - **Root question:** Which link in the demo app makes the drawn click read
     as a natural next step?
   - **Background:** The demo app's payment screen has no continue button.
     Its only button is `Pay $42.00` (`AcmeCardForm.astro`). The spread and
     the Changes compare draw that screen too. The review-order screen
     exists only as a dark phone screen. The pricing screen's cards have a
     `Choose` button, and the Regular plan costs $32 a month. The welcome
     screen exists only as a light phone screen, with `Continue`.
   - **Options:**
     - **A.** `Pay $42.00` on payment opens review-order. No approved
       drawing changes. A reader sees a payment before the review, which
       reads wrong. Review-order needs a light scheme. Effort: Small.
     - **B.** `Choose` on a pricing card opens payment. Both screens exist
       on the phone. The $32 plan then leads to a $42.00 payment, which
       reads wrong. The pricing screen shows in three modules. Effort:
       Small.
     - **C.** Relabel the branch payment button to `Continue`, which opens
       review-order. The spread and the Changes compare change with it, and
       review-order needs a light scheme. Effort: Medium.
     - **D.** `Continue` on welcome opens a new onboarding screen, or `Place
order` opens a new confirmation screen. A new demo screen is drawn in
       the mockups and the site. Effort: Medium.
     - **E.** The back arrow of review-order opens payment. Both screens
       exist. The press target is small, and a step back shows the
       click-through less well. Effort: Small.
     - **F.** `Continue` on welcome opens pricing. Both screens exist, and
       onboarding into plans reads naturally. The pricing screen shows in
       three modules. Effort: Small.
     - **G.** B with a payment variant for the Regular plan at $32.00. The
       spread and the Changes compare keep today's payment screen. Effort:
       Medium.
   - **Left out:** The settings menu, because settings exists only as a
     dark desktop screen.
   - **Recommendation:** F. It uses two existing screens, adds no drawing,
     and reads naturally. It replaces the first recommendation, B. C best
     keeps pricing out of a third module.

## Design

Each item below is my design call of 2026-11-25, with its reason.

- **The diff module's kicker is `Changes`.** It is the name of the product's
  own filter and tab, and the product-noun rule of
  [Site](../docs/protocol/cloud/site.md#positioning) prefers product nouns.
- **The order is 01 Browse, 02 Changes, 03 Review, 04 Edit.** It follows the
  reader's path: open the branch, see what changed, discuss it, change it.
- **Anchors.** `#browse` and `browse-title` move to the new module. The diff
  module takes `#changes` and `changes-title`. Only the Specs panel links to
  them.
- **Names in the code.** The final code names are `changes` for the diff
  module and `browse` for the new module, so each name says what its module
  shows. The site and mockup stylesheets are compared rule by rule
  (`docs/mockups/src/_tests_/design-site-parity.test.ts`), so the mockups
  cannot rename alone. In Milestone 1 the diff module keeps its `browse`
  names and the new module uses `links`. Milestone 3 renames both sides
  together: first the diff module from `browse` to `changes`, then the new
  module from `links` to `browse`, each in a commit of its own so that Git
  shows moved files as moves. Changed on 2026-11-25, after the mockups.
- **What the new drawing shows.** The depicted viewer opens acme/storefront
  on `feat/checkout-v2` in the product's Browse look: the tree beside the
  open entry's frames on a dot grid, not the compare stage of the Changes
  viewer. The viewer shows one phone frame, `Mobile · Light`, because two
  frames are too narrow at the viewer's height. Sam's cursor presses the
  link of decision 3, and a press ring shows that it is a press, not a
  hover. A link line draws
  from the pressed button to the destination, the destination opens, and
  the tree's current row moves to it. The built page draws the finished
  state: the destination open and current. The source screen sits outside
  the drawn viewer, as the check card does in 02 Changes, with its press
  drawn and its link line into the destination.
  The mockup milestone checks that this state reads as a click-through. When
  it does not, the change asks Cal with a new decision.
- **Reuse.** The new viewer reuses the bar and the tree of the Changes
  viewer and the existing demo screens. It draws no compare.
- **Ahead-of-release marks.** The link click is a released feature and gets
  no mark. Sam's cursor gets `status: "ahead" (presence)`, as every named
  cursor in the drawn viewer does.

Contract owners:

- [Site](../docs/protocol/cloud/site.md).
- [Site copy](../docs/protocol/cloud/site-copy.md).
- [Site design: pages](../docs/protocol/cloud/site-design-pages.md) and
  [Site design: components](../docs/protocol/cloud/site-design-components.md).
- The [site README](../apps/site/README.md) and the
  [mockups README](../docs/mockups/README.md).

## Milestone 1: Mockups

Tags: mockup

Depends on: none

The first drawing uses the recommended options of decisions 2 and 3, as a
draft for Cal's review, which he asked for on 2026-11-25. The milestone
completes when Cal answers decisions 2 and 3 and the drawing follows the
answers.

The `design/site/home` mockup gets the new 01 Browse module and renumbers the
others, on the desktop and the phone composition, in both schemes.

- [x] Give the diff module the kicker `02 Changes` and the anchor
      `#changes`.
- [x] Add the new 01 Browse module with the copy of decision 2 and the
      drawing of the design.
- [x] Renumber Review to 03 and Edit to 04, and update the frame labels.
- [x] Update the Specs panel rows in `workspace.tsx`, the entry metadata in
      `docs/mockups/src/entries/design/site/home.mockup.tsx` and the comment
      of `docs/mockups/src/screens/design/site/home_screen.tsx`.
- [x] Update `docs/mockups/src/_tests_/design-site-home.test.ts`.
- [x] Run the mockup check that `docs/mockups/README.md` gives. Smoke-test
      the home on the desktop and the phone, in light and dark.
- [x] Update the design and the TODOs of this plan for each problem that the
      mockups show. The check output and the screenshots are in
      `.context/site-home-browse-click-through/`.
- [ ] Redraw the mockup for Cal's answers to decisions 2 and 3 and to his
      review of the draft.

## Milestone 2: Documentation and protocol

Depends on: 1

The protocol docs state the four modules, their order, their copy and their
drawings.

- [ ] Update `docs/protocol/cloud/site.md`: the order of emphasis and the
      home's module list.
- [ ] Update `docs/protocol/cloud/site-copy.md`: the Specs panel rows, the
      new 01 Browse copy, the renumbered modules and the frame descriptions.
- [ ] Update `docs/protocol/cloud/site-design-pages.md` and
      `site-design-components.md` for the new frame and the renamed one.
- [ ] Update `apps/site/README.md` and `docs/mockups/README.md`.
- [ ] Update the module names in
      `plans/follow-ups/site-home-demo-replays-after-resize.md`, and add the
      new module's link line when it is drawn per layout step.

## Milestone 3: Site home

Tags: ui

Depends on: 2

The site home draws the same four modules as the mockup.

- [ ] Rename the diff module's site and mockup files, classes and demo from
      `browse` to `changes` in a rename-only commit, and give the site module
      the kicker `02 Changes` and the anchor `#changes`.
- [ ] Rename the new mockup module from `links` to `browse` in a
      rename-only commit.
- [ ] Add the new `BrowseModule.astro`, its sheets and its `browse` demo in
      `demos.ts`, with reduced motion and no-script showing the finished
      state.
- [ ] Renumber Review and Edit, and update `SpecsPanel.astro` and
      `Workspace.astro`.
- [ ] Update the browser specs: `home.spec.ts`, the renamed
      `home-changes.spec.ts`, a new `home-browse.spec.ts`,
      `home-review-edit.spec.ts` and `tests/helpers/home-island.ts`.
- [ ] Check that the site and the mockup stylesheets stay equal, as
      [Site mockups](../docs/protocol/cloud/site-mockups.md) requires.
- [ ] Smoke-test the built home in a browser at 1440px, 1280px, 1100px,
      768px and a phone, and save screenshots under
      `.context/site-home-browse-click-through/`.

## Milestone 4: Verification, commit, review, and pull request

Depends on: 1, 2, 3

- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.
