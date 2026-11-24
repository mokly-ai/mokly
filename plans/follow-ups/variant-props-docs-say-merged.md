# Docs call every variant's props merged props

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-24, from the implementation review of pull request
  #492, branch `conductor/storybook-support-b-story-reading`, finding 5 of
  round 1.
- **Location:** At commit `70760ab4`:
  - `docs/protocol/mokly-entry-props.md:35`, `:84`, `:112`, `:113-118`,
    `:159`, and `:178`.
  - `docs/protocol/mokly-variants.md:32`, `:33-37`, `:105`, `:122`, and
    `:132`.
  - `docs/protocol/mokly-storybook.md:63-65`.
  - `docs/protocol/mokly-catalogue.md:33`, `docs/protocol/mokly-component-manifest.md:27`,
    `docs/protocol/mokly-catalogue-delivery.md:29`,
    `docs/protocol/mokly-component-comparison-records.md:14`, and
    `docs/protocol/mokly-component-controls.md:60` and `:70`.
  - Code comments: `crates/mokly-model/src/catalogue.rs:75` with its
    generated `packages/model/src/generated/catalogue/VisualEntry.ts:19`,
    and `crates/mokly-sidecar/src/methods.rs:166` and `:175` with the
    generated `packages/mokly/src/generated/sidecar/RenderStoryParams.ts:17`.
- **Reason:** The orchestrator merged pull request #492 before its review
  findings were fixed, and asked for each open finding as an item.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Story variant:** a page of a Storybook stories entry for each included
    story after the first one.
- **Background:**
  - Ordinary variants of screens and components replace the top-level keys
    of the entry's props and keep the rest: their "merged props".
  - On 2026-11-23 the plan's orchestrator decided that a story variant's
    props are only its own data args, that a top-level key is required only
    when every included story sets it, and that each story renders with
    exactly the requested data props.
  - `docs/protocol/mokly-storybook.md` holds that rule.
    `mokly-entry-props.md` and `mokly-variants.md` keep their general rules
    and add a short stories exception with a link at a few places.
- **Problem:** Many general sentences still use one kind's method, "merged
  props", as the name for the props of every variant, stories included:
  saved props, the inference input, validation, the read model, rendering,
  and the sentences on six more pages. Comments in the Rust code and the
  generated types say the same: "Own props or merged variant props" for
  the read model's `props`, and "Validated merged data args" that are
  "overlaid" for the `renderStory` props. The code stores a story variant's
  own props as its complete props, so these sentences are false for
  stories.
- **Impact if no action:** A reader can implement a consumer or a later
  validation change that brings back props that a story does not set.
- **Root question:** Which one term names the props of an entry or a
  variant, so that the general rules on every page are true for each kind,
  and only one sentence says how each kind gets its props?
- **Options:**
  - **A.** Refer to each entry's complete props in the general sections of
    `mokly-entry-props.md` and `mokly-variants.md`, with a link to the
    stories exception where the source of those props matters. The other
    pages and the comments keep "merged". Effort: Small.
  - **B.** Organize the affected sections by entry kind, and link to each
    kind's own rule. It rewrites more text. Effort: Medium.
  - **C.** Define "complete props" once, in the `variants` item of "One
    Model" in `mokly-entry-props.md`: an entry's complete props are its own
    props; an ordinary variant's complete props are the entry's props with
    the variant's top-level keys replaced; a story variant's complete props
    are its story's data args, with the one link to the Storybook page. Use
    the term, with no story exception, in every sentence of the Location.
    Keep the exception for which render a story variant uses. Replace the
    required-key rule and its stories exception with one rule: a top-level
    key is required when the entry's own props and every variant's complete
    props contain it. Replace the repeated story rule of
    `mokly-storybook.md:63-65` with a link. Merge the two story sentences of
    `mokly-variants.md:33-37` into one. Keep the sentences that use "merged"
    for a live edit over the shown props, such as
    `mokly-component-controls.md:67` and `:116-121`, because they are also
    true for stories. Correct the code comments, and regenerate the types
    with `cargo xtask generate-types`. No behaviour changes. Effort: Small.
- **Left out:** A return to inheritance breaks the 2026-11-23 decision. A
  note on the Storybook page that it wins keeps two texts that disagree. A
  test or a lint on doc words: `AGENTS.md` forbids tests that read
  protocol words, and a new lint needs the user's approval.
- **Wider fix:** C. One defined term prevents this class when a kind's
  method changes, because no other sentence names the method.
- **Previous examples:** The track B decision of 2026-11-20 replaced
  restated Storybook rules on eight protocol pages with links.
- **Related:** `plans/follow-ups/story-required-keys-derived-twice.md`, the
  same cause in the inference code. Use the term "complete props" there
  too. Neither fix waits for the other.
- **Recommendation:** C. It corrects every page and comment that states a
  variant's props, and a later change of one kind's method then changes one
  sentence.
- **Action:** fix after merge, apply C, because the pull request merged
  before its review findings were fixed.
