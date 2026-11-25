# Incoming links make failed stories fatal

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-25, from the implementation review of the branch
  `calummoore/storybook-track-f-failed-stories-omid`, finding 2 of round 1,
  with the options and the facts of its finding check.
- **Location:**
  - `crates/mokly-graph/src/validation.rs:69-88`, `links`, the on-demand
    anchor check, and `:90-119`, `completed`, the complete anchor check.
    `:62-67`, `missing`, gives the error of both checks.
  - The callers of the on-demand check:
    - `crates/mokly-graph/src/session_render.rs:95`, for each saved view
      that Serve renders.
    - `crates/mokly-graph/src/session.rs:183`, `comparison_document`, for
      both sides of Changes.
    - The two `closure_job` methods in `crates/mokly-graph/src/temporary.rs`,
      for the live props preview.
  - The caller of the complete check:
    `crates/mokly-graph/src/validation_summary.rs:54`.
  - `crates/mokly-html/src/story_failure.rs:44-91`, `compose`, which writes
    the error document of a failed view.
  - `docs/protocol/mokly-navigation.md:86`, section "Fragments", and
    `docs/protocol/mokly-link-validation.md:12`, section "Reference
    Records": the two pages that own the fragment rule.
  - `docs/protocol/mokly-storybook-failures.md`, sections "Failed Views" and
    "Changes": the failure rules of stories.
- **Reason:** The recommended option adds an exception to the fragment rule
  of link validation, a requirement in force that no user decision covers.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Logical link:** a catalogue link such as `mock:Menu#actions`, whose
    fragment, here `actions`, names an HTML `id` in the views of another
    entry.
  - **Failed view:** a saved view of a Storybook stories entry whose story
    throws while it renders, so Mokly shows an error document in its place.
  - **Error document:** the document of a failed view, which holds the empty
    root region of the view and the error text.
  - **Anchor checks:** the on-demand check for one document and the complete
    check after a whole generation, both in
    `crates/mokly-graph/src/validation.rs`.
  - **Changes:** the viewer's comparison of the base side, the branch point,
    with the head side, the current catalogue.
- **Background:**
  - The fragment rule: the fragment of a logical link must name an anchor in
    every view that Browse may show for the destination. A missing anchor
    fails `build-invalid` with the referring route. Section "Fragments" of
    `docs/protocol/mokly-navigation.md` and section "Reference Records" of
    `docs/protocol/mokly-link-validation.md` state this rule.
  - The failure rule: a failed view does not stop the build, and `--strict`
    still fails. Section "Failed Views" of
    `docs/protocol/mokly-storybook-failures.md` states it. Each failed view
    gives one `story-render-failed` build warning.
  - The user chose the failure rule on 2026-11-06, in the brainstorm of the
    Storybook support plan. A story that cannot render gives a warning and an
    error document in place of the story, so that reviewers see each failed
    story in place.
  - Section "Changes" of the failures page says: "A failed view on the base
    side does not make Changes unavailable."
  - `docs/protocol/mokly-link-validation.md:42-43` says that a base commit
    whose documents fail the link checks makes Changes unavailable.
  - The error document holds none of the markup of the story. So it has none
    of the anchors of the story.
  - The on-demand check runs for each saved view that Serve, the local
    development server, renders. It also runs for the documents of both
    sides of Changes and for the live props preview of the Props tab.
  - The complete check runs after a pass that renders every view of a
    generation, as in `build` and `publish`.
  - Both checks share one record of anchor results for each generation.
    Commit `bc858df42`, "perf(graph): share link checks within each
    generation (#314)", added this record.
- **Problem:** When the story of `Menu` renders, its views hold an `actions`
  anchor, so a link to `mock:Menu#actions` is valid. When the story fails,
  its error document has no `actions` anchor. Both checks then fail the
  referring route with `build-invalid` and the text
  `{referring route}: logical fragment "actions" is missing from {destination route}`.
- **Impact if no action:** One story failure stops a non-strict `build` or
  `publish`, and in Serve the healthy entry that links to the story does not
  render. On the base side, the failure makes Changes unavailable, against
  section "Changes" of the failures page.
- **Root question:** How should a catalogue link behave when its destination
  story has an error document?
- **Options:**
  - **A.** Keep both checks fatal. State in the failures page that an
    incoming fragment link makes a failed story stop the build. On the base
    side, it then makes Changes unavailable. This keeps the fragment rule and
    narrows the failure rule. The error still names only a missing fragment.
    Effort: Small.
  - **B.** Exempt a failed view from the anchor check in both checks. The
    link stays, and it opens the error document. Sections "Fragments" and
    "Reference Records" state the exception. Each check reads the failure on
    its own. Effort: Medium.
  - **C.** Give both checks one shared destination state: no anchors,
    because the view did not render. Both checks record and read this state
    in the shared anchor results. Keep the anchor check for each view that
    renders. Sections "Fragments" and "Reference Records" state the
    exception. Effort: Medium.
  - **D.** Do A, and name the failed story in the error, so that the author
    sees why the anchor is missing. Effort: Small.
  - **E.** Skip the anchor check for a failed view, and give the referring
    route a warning that names the fragment and the failed story. The author
    of the linking entry then sees that the link lands without its anchor.
    It needs a new warning code in `docs/protocol/mokly-build-warnings.md`,
    and the two fragment pages state the exception. Effort: Medium.
- **Left out:**
  - Placeholder anchors in the error document: its contents would then
    depend on the links of other entries.
  - Change nothing: the code then breaks the failure rule and the sentence of
    section "Changes", which are requirements in force.
- **Wider fix:** C, when its shared state means "this view did not render".
  Both checks then agree by construction, also for a later kind of view that
  does not render.
- **Previous examples:** Commit `bc858df42` made both checks share anchor
  results. Its regression test,
  `a_transient_target_error_is_not_retained_as_an_anchor_result` in
  `crates/mokly-graph/src/_tests_/validation_retry_tests.rs:21`, keeps a
  render failure apart from a missing anchor.
- **Related:** `plans/follow-ups/story-failures-travel-as-fragments.md`, the
  same cause: a story failure reaches the graph as a successful render with a
  warning marker. When that item gives the renderer a typed result and this
  item chooses C, both read one failed-view state. Neither fix waits for the
  other.
- **Recommendation:** C. It keeps the non-strict catalogue and the anchor
  check for every view that renders, and the failed story still fails
  `--strict` through its own warning.
- **Action:** ask the user, because C adds an exception to the fragment rule
  of link validation, a requirement in force, and no user decision covers it.
  Each other option also changes the fragment rule or narrows the failure
  rule, which the user chose on 2026-11-06.
