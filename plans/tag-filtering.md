# Tag Filtering

> **For agentic workers:** REQUIRED SUB-SKILL: use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the tag-filtering design recorded on this branch: authored
`tags` on screens and use cases flow through the manifest into the Browse
shell's details chips, search `tag:<tag>` terms, and the search-attached tag
picker, exactly as the approved mockups depict.

**Architecture:** `tags` is additive, optional entry metadata validated like
ids, serialized into manifest v3 only when present, and projected onto nav
rows as a `data-tags` attribute. Filtering stays client-side in the existing
search pipeline: a pure query parser splits `tag:` terms from free text, and
the current row-hiding/group-hiding machinery applies both. Discovery UI
(details chips, search tag button, picker panel) is server-rendered shell
markup progressively enhanced by one new client module.

**Tech stack:** TypeScript ESM (Node 22 test runner via `tsx --test`, tests
import from `../dist`), React 19 static rendering, Playwright Chromium against
`examples/basic`, Rust `xtask` gate.

**Spec:** [`docs/protocol/mokly-shell-design.md`](../docs/protocol/mokly-shell-design.md)
(Top bar, Tag picker, Details inspector bullets, and Delivery Status pending
list), with the approved mockups under `examples/basic/generated/design/`.

## Global Constraints

- Run `cargo xtask check` before declaring any milestone complete (it runs
  `format:check`, `lint`, `typecheck`, `npm test`, `example:check`,
  `package:check`, `package:smoke`, `test:browser`, `cargo fmt --check`,
  `clippy -D warnings`, `cargo test`, and the Rust file-length audit).
- After checks pass at each milestone end: `git add -A`, commit with a
  Conventional Commits title ≤ 50 chars, push, then run `cargo xtask review`.
  Do NOT auto-fix review findings; report each numbered finding with severity,
  impact, lettered options, and a recommendation.
- Never hand-edit `examples/basic/generated/**` HTML or the manifest; run
  `npm run example:build` and commit regenerated output. The authored CSS
  files under `generated/` (`design.css`, `design-stage.css`,
  `design-review.css`, `styles.css`) ARE hand-edited.
- Protocol docs under `docs/protocol/` are updated in the same milestone as
  the behavior they describe; `plans/README.md` tracks this plan.
- Tag grammar everywhere: lowercase kebab-case tokens (the `isCatalogueId`
  grammar), authored order preserved, duplicates rejected at validation.
- Decisions locked by this plan (flag before implementing if the user
  objects): tags are declared on screens and use cases only — collections
  reject the field because collection rows cannot be individually
  tag-filtered in the nav model; the manifest omits `tags` when absent so
  untagged catalogues serialize byte-identically; nested `screen(...)`
  markers accept `tags` but nothing inherits tags from ancestors; an
  unmatched `tag:` term hides every row exactly like a no-match free-text
  query (no new empty-state UI); Escape closes the picker without clearing
  the query; the Review artifact is untouched by this feature.

## Milestones

---

### Milestone 1: Mockup alignment fixes (review findings)

Tags: mockup

Resolves the three open `cargo xtask review` findings in the mockups, per the
recommendations already reported to the user (finding 2 uses option B — both
fixture screens depicted tagged — veto before starting if option A is
preferred). At completion the design catalogue is internally consistent and
regenerated.

#### Task 1.1: Valid search-field markup, count-free home copy, tag notes

**Files:**

- Modify: `examples/basic/entries/design/parts/shell.tsx` (SearchField),
  `examples/basic/entries/design/browse_screens.tsx` (HomeBody),
  `examples/basic/notes.md`
- Regenerate: `examples/basic/generated/**` via `npm run example:build`

**Steps:**

- [x] In `SearchField`, change the wrapper `<span className="mbk-search">` to
      `<div className="mbk-search">` (finding 1: a `<div>` panel inside a
      `<span>` is invalid HTML; the served shell already uses a `div`). The
      `.mbk-search` CSS is class-based and element-agnostic; no CSS change.
- [x] In `HomeBody`, replace the body copy
      `"Browse the mockup catalogue. 18 screens and 1 use case are generated from this repository."`
      with `"Browse the mockup catalogue generated from this repository."`
      (finding 3, option B: no volatile count to drift).
- [x] In `notes.md`, replace the bullet sentence claiming the tags are
      "drawn on the Welcome entry" with: the depicted fixture tags `forms`
      and `onboarding` belong to Welcome and `forms` also to Details, which
      is why the `tag:forms` tree keeps both screen rows (finding 2,
      option B); keep the caveat that no example entry declares tags in
      authored metadata yet (removed in Milestone 2).
- [x] `npm run build && npm run example:build && npm run example:check`; then
      `npx playwright screenshot` the regenerated `tag-filter.desktop.html`
      and `home.desktop.html` from disk and read both images to confirm no
      layout shift from the span→div change.
- [x] Milestone close-out per Global Constraints (gate, commit
      `docs(design): align mockups with review findings`, push, review).

---

### Milestone 2: Tags through authoring, manifest, and the example

Backend only — no shell UI. At completion: `defineScreen`, `defineUseCase`,
and nested `screen(...)` accept validated `tags`, the manifest carries them,
the Changed projection sees them, `examples/basic` declares Welcome
`["forms", "onboarding"]` and Details `["forms"]`, and the served shell still
renders exactly as today.

#### Task 2.1: Authoring types and validation

**Files:**

- Modify: `src/authoring/types.ts`, `src/registry/entry_validation.ts`
- Test: `tests/authoring.test.tsx` (validation cases live with the existing
  entry-validation coverage)

**Interfaces produced:**

```ts
// src/authoring/types.ts — ScreenInput and UseCaseInput each gain:
/** Lowercase kebab-case classification tags, e.g. ["forms"]. */
tags?: readonly string[];
// NestedScreenInput gains the same field. CollectionInput does NOT.
```

**Steps:**

- [x] Write failing tests: `defineScreen` keeps `tags` on the definition; a
      screen with `tags: ["forms", "Forms!"]` yields an `invalid-tags`
      violation; duplicates (`["forms", "forms"]`) yield `invalid-tags`; an
      empty array is valid and equivalent to absent; a collection entry
      carrying a `tags` field yields `invalid-tags`
      ("tags are not supported on collections"). Run; expect failures.
- [x] Add the optional `tags` fields to `ScreenInput`, `UseCaseInput`, and
      `NestedScreenInput`; pass them through `src/authoring/definitions.ts`
      and the nested flattener unchanged (no inheritance).
- [x] In `validateEntry`, add `validateTags(entry, violations)`: when
      `entry.tags !== undefined`, require an array of strings each matching
      the `isCatalogueId` grammar and free of duplicates, reporting
      `problem(entry, "invalid-tags", …)`; report `invalid-tags` when a
      collection declares the field at all.
- [x] `npm test` — new tests pass, all existing pass.

#### Task 2.2: Manifest schema, serialization, validation, Changed projection

**Files:**

- Modify: `src/registry/types.ts`, `src/registry/manifest.ts`,
  `src/registry/manifest_validation.ts`, `src/server/changed.ts`
- Test: `tests/manifest_files.test.ts`, `tests/server_changed.test.ts`

**Interfaces produced:**

```ts
// src/registry/types.ts — ManifestScreen and ManifestUseCase each gain:
/** Declared classification tags, present only when the entry has them. */
tags?: readonly string[];
```

**Steps:**

- [x] Write failing tests: a tagged screen serializes `"tags": ["forms"]`
      and an untagged screen omits the key entirely (byte-stability);
      `parseManifest` accepts entries with and without `tags` and rejects a
      non-string element; `routeChangeProjection` output differs when only
      `tags` changed (drives the Changed filter). Run; expect failures.
- [x] In `toManifestEntry`, spread tags with the existing optional pattern:
      `...(entry.tags && entry.tags.length > 0 ? { tags: [...entry.tags] } : {})`
      for screen and use-case branches.
- [x] In `manifest_validation.ts`, accept the optional field with the same
      optional-string-array shape used for existing lists.
- [x] In `routeChangeProjection`, add `tags: entry.kind === "collection" ? undefined : entry.tags`
      to the common projection object.
- [x] `npm test` — green.

#### Task 2.3: Fixture tags, docs, regeneration

**Files:**

- Modify: `examples/basic/entries/catalogue.mockup.tsx`,
  `docs/protocol/mokly-package.md`, `examples/basic/notes.md`
- Regenerate: `examples/basic/generated/mokly-manifest.json`

**Steps:**

- [x] Declare `tags: ["forms", "onboarding"]` on the Welcome screen entry and
      `tags: ["forms"]` on the Details screen entry, matching the mockup
      depiction from Milestone 1.
- [x] Document the authoring field and manifest addition in
      `mokly-package.md` (grammar, screens/use-cases-only rule, omitted
      when absent, no nested inheritance); remove the notes.md caveat that no
      example entry declares tags.
- [x] `npm run example:build && npm run example:check`; confirm via
      `git diff` that the manifest gained exactly the two `tags` arrays.
- [x] Milestone close-out per Global Constraints (gate, commit
      `feat(registry): add validated entry tags to manifest`, push, review).

---

### Milestone 3: Tag search terms, row filtering, details chips

Tags: ui

At completion: typing `tag:forms` in served Browse filters the tree per the
contract, details inspectors show clickable tag chips that enter the term,
the top bar stays crisp above the drawer scrim, and protocol docs describe
the shipped behavior. The picker panel is Milestone 4.

#### Task 3.1: Pure query model

**Files:**

- Create: `src/client/search_query.ts`
- Test: `tests/client_navigation_state.test.ts` (same suite as the state
  helpers it feeds)

**Interfaces produced:**

```ts
// src/client/search_query.ts
/** A search box value split into tag terms and free text. */
export interface SearchQuery {
  freeText: string;
  tags: readonly string[];
}
/** Split on whitespace; `tag:<t>` terms (case-insensitive, lowercased) vs text. */
export function parseSearchQuery(raw: string): SearchQuery;
/** Every tag term ∈ row tags AND free text ⊆ row text/route (lowercased). */
export function rowMatchesQuery(
  query: SearchQuery,
  row: { route: string; tags: readonly string[]; text: string },
): boolean;
/** Rewrite raw so its only tag term is `tag:<tag>`, preserving free text. */
export function setTagTerm(raw: string, tag: string): string;
/** Remove `tag:<tag>` terms from raw, preserving free text. */
export function clearTagTerm(raw: string, tag: string): string;
```

**Steps:**

- [x] Write failing tests covering: plain text parses to freeText only;
      `tag:forms welcome` → tags `["forms"]`, freeText `welcome`;
      `TAG:Forms` lowercases; two tag terms AND-match; unmatched tag hides a
      row that free text alone would match; `setTagTerm("tag:onboarding welcome", "forms")`
      → `"welcome tag:forms"`-equivalent (free text kept, single tag term);
      `clearTagTerm` removes only the tag term. Run; expect failures.
- [x] Implement the module; keep it dependency-free and pure.
- [x] `npm test` — green.

#### Task 3.2: Row attributes and client filtering

**Files:**

- Modify: `src/server/shell/nav_tree.ts` (NavLeafNode gains
  `tags?: readonly string[]`, populated in `structuredNode` from non-collection
  entries), `src/server/shell/nav.tsx` (LeafRow renders
  `data-tags={node.tags?.join(" ")}` when present),
  `src/client/browse_navigation_state.ts` (parse once per
  `applyNavVisibility`, match rows via `rowMatchesQuery` reading `data-tags`;
  extend `NavigationConstraintFacts` with `tags: readonly string[]` and use
  the same matcher in `navigationConstraintChanges` and
  `selectAndRevealRoute`)
- Test: `tests/nav_tree.test.ts`, `tests/client_navigation_state.test.ts`,
  `tests/client_browse_navigation.test.ts`, `tests/shell.test.ts`,
  `tests/client_modules.test.ts`

**Steps:**

- [x] Write failing tests: `buildNavTree` carries screen tags onto leaves;
      a DOM fixture row with `data-tags="forms onboarding"` stays visible
      under `tag:forms` while an untagged sibling hides and an emptied group
      hides; `navigationConstraintChanges` requests `clearQuery` when
      navigating to a row hidden only by a tag term. Run; expect failures.
- [x] Implement; keep `applyNavVisibility`'s group behavior untouched (it
      already hides empty groups and auto-opens during filtering). A tag-only
      query has empty free text, so the group flag reads a new
      `queryConstrains(query)` predicate instead of a non-empty free-text
      test.
- [x] Serve `search_query.js` from the browser client allowlist in
      `src/server/client_modules.ts` and add a closure test that fails when an
      allowlisted module imports one the server does not serve.
- [x] `npm test` — green.

#### Task 3.3: Details inspector chips and chip-click filtering

**Files:**

- Modify: `src/server/shell/details.tsx` (Tags MetaRow between Schemes and
  Related docs: `<button className="mbk-chip tag" data-mokly-tag={tag} type="button">`
  with `TagIcon`; omitted when the entry has no tags),
  `src/server/shell/icons.tsx` (TagIcon, same path as the mockup icon),
  `src/server/shell/css_details.ts` (tag chip + accent active styles using
  `var(--mokly-accent)` / `var(--mokly-accent-contrast)`),
  `src/server/shell/css_nav.ts` (`.mbk-topbar { position: relative; z-index: 11; }`
  — above the drawer's 10, below the skip link's 20)
- Create: `src/client/tag_filter.ts` (delegated click on
  `[data-mokly-tag]`: toggle `setTagTerm`/`clearTagTerm` on the search
  input, dispatch an `input` event so visibility reapplies, sync the
  `active` chip class from the parsed query), wired from `src/client/browse.ts`
- Test: `tests/client_browse_details.test.ts`, `tests/shell.test.ts`,
  `tests/browser/browse.spec.ts`

**Steps:**

- [x] Write failing tests: shell HTML for a tagged screen contains the Tags
      row and `data-mokly-tag` buttons and omits the row for untagged
      entries; clicking a chip sets the input to `tag:forms` and hides
      untagged rows; clicking the active chip clears the term; browser test:
      served details chips filter the tree and the chip gains the active
      class; browser test extension of the existing narrow-drawer spec:
      with the drawer open the top bar is not covered by the scrim
      (computed `z-index === "11"` and `position === "relative"`). Run;
      expect failures.
- [x] Implement server markup, CSS, and the client module.
- [x] Update `docs/protocol/mokly-runtime.md` (search term semantics,
      chip behavior) and move the details-chips and `tag:` term items from
      the shell-design Delivery Status pending list to implemented; the
      stacking fix item too.
- [x] `npm test && npm run test:browser` — green.
- [x] Smoke test: `node dist/cli/bin.js serve --config examples/basic/mokly.config.ts`,
      type `tag:forms`, click chips on the Welcome details, verify tree and
      active states by hand.
- [x] Milestone close-out per Global Constraints (gate, commit
      `feat(browse): filter catalogue rows by tag terms`, push, review).

---

### Milestone 4: Search tag button and picker panel

Tags: ui

At completion: the search field carries the tag button whenever the catalogue
declares tags; the panel opens under the field (full-width sheet below the
breakpoint), lists the catalogue tag union, supports mouse and keyboard, and
writes terms into the field; docs and Delivery Status describe the shipped
picker; the plan moves to completed.

#### Task 4.1: Server markup and CSS

**Files:**

- Modify: `src/server/catalogue.ts` (Catalogue exposes
  `tags: readonly string[]` — sorted unique union of entry tags),
  `src/server/shell/document.tsx` (inside the `.mbk-search` div, after the
  input: `<button aria-controls="mb-tag-picker" aria-expanded="false" className="mbk-search-tag" data-mokly-tag-toggle type="button">`
  with `TagIcon`, then
  `<div className="mbk-tag-picker" hidden id="mb-tag-picker">` with the
  uppercase `Tags` head and one `data-mokly-tag` chip button per tag;
  both rendered only when `catalogue.tags.length > 0`),
  `src/server/shell/css_nav.ts` (button, panel, scroll cap, narrow
  full-width sheet per the contract's Tag picker bullet)
- Test: `tests/shell.test.ts`, `tests/server.test.ts`

**Steps:**

- [x] Write failing tests: shell HTML contains the button and hidden panel
      listing `forms onboarding` for the example catalogue; a catalogue with
      no tags renders neither. Run; expect failures.
- [x] Implement markup and CSS; panel geometry per the mockups (field-width
      card, 10px radius, `--chrome-shadow`, sheet below 56.25rem).
- [x] `npm test` — green.

#### Task 4.2: Picker behavior, focus, keyboard

**Files:**

- Modify: `src/client/tag_filter.ts` (toggle open/close syncing
  `aria-expanded`/`hidden`; chip selection closes; Escape closes and
  refocuses the button without touching the query; outside click closes;
  focus moves to the active-or-first chip on open; roving tabindex with
  Left/Right/Home/End across the wrapped chip row, Enter/Space selects)
- Test: new `tests/client_tag_filter.test.ts` (the tag chip cases move out of
  `tests/client_browse_details.test.ts` so one suite owns the module), new
  `tests/browser/browse_tags.spec.ts`

**Steps:**

- [x] Write failing tests: unit coverage for open/close/Escape/outside-click
      state and roving tabindex order; browser coverage: open picker →
      select `forms` → input reads `tag:forms`, tree filters, panel closes,
      button refocused; reopen → `forms` chip active; select it again →
      term cleared; narrow viewport → panel spans the bar width. Run; expect
      failures.
- [x] Implement in `tag_filter.ts`; no new persisted state (the query
      persists via existing browse state; the panel is ephemeral).
- [x] `npm test && npm run test:browser` — green.

#### Task 4.3: Docs, preview smoke, wrap-up

**Files:**

- Modify: `docs/protocol/mokly-runtime.md`,
  `docs/protocol/mokly-shell-design.md` (Delivery Status: picker
  implemented; pending list emptied), `examples/basic/notes.md` (drawer and
  picker bullets now match the served shell), `README.md` (one feature
  sentence), `plans/README.md` (move this plan to Completed)

**Steps:**

- [x] Update the docs above; re-read the shell-design doc end-to-end for
      internal consistency (no remaining "pending implementation" text that
      is now shipped).
- [x] Fix the `examples/basic/notes.md` sentence falsified by the Task 3.3
      stacking fix ("The served shell still dims its top bar with the
      scrim…") — the served shell now stacks the bar above the scrim;
      regenerate the example output this touches.
- [x] Correct free-text wording in `mokly-runtime.md` and the
      shell-design Top bar bullet: remaining words match titles/routes as
      ONE contiguous phrase (single substring), while every `tag:` term must
      match — not per-word AND.
- [x] Reconcile mockup drift from the served chips: the implementation adds
      a `:hover` accent-soft affordance and uses `--mokly-accent-contrast`
      for the active glyph where the mockup CSS has no hover rule and a
      literal white; note it in the mockup notes or align the mockup CSS.
- [x] Also reconcile the Task 4.1 additions: the served `.mbk-chip.tag:active`
      press feedback has no mockup rule, and the shell-design Tag picker
      bullet mentions neither the press state nor `aria-pressed` on tag
      chips — add the mockup rule (or note) and one contract sentence.
- [x] `npm run preview:build`; open the static preview's tag-filter and home
      routes from the artifact and confirm the picker markup renders and the
      shell scripts load (static preview keeps Browse client behavior).
- [x] Full serve smoke: picker + chips + `tag:` typing + Changed filter
      composition in one session.
- [x] Milestone close-out per Global Constraints (gate, commit
      `feat(browse): add search tag picker`, push, review).

---

### Milestone 5: Narrow mark-only brand (final-review disposition)

Tags: ui

Added at final review (orchestrator ruling, option b): the contract and the
approved narrow artboards record a mark-only brand wherever the narrow top
bar keeps the search field, but the served shell never implemented it, and
this branch would otherwise merge a Delivery Status paragraph admitting the
gap. At completion the narrow Browse bar fits 390px with the mode switch on
screen and the Delivery Status paragraph is gone.

#### Task 5.1: Hide the product name on the narrow search bar

**Files:**

- Modify: `src/server/shell/document.tsx` (wrap the product name in a
  `span.mbk-name` inside `.mbk-brand`), `src/server/shell/css_nav.ts`
  (narrow media block hides `.mbk-name` when the bar carries the search
  field — Browse only), `docs/protocol/mokly-shell-design.md` (remove
  the Delivery Status gap paragraph), `examples/basic/notes.md` (drop the
  gap note)
- Test: `tests/shell.test.ts` (brand span markup), narrow browser assertion
  (bar fits 390px, mode switch on screen, mark visible, name hidden)

**Steps:**

- [x] Write failing tests (markup + narrow geometry). Run; expect failures.
- [x] Implement the span + narrow CSS; verify Review-mode narrow bars keep
      the full brand (they carry no search field).
- [x] Docs: delete the Delivery Status gap paragraph and the notes.md gap
      bullet; re-read both for coherence.
- [x] `npm test && PLAYWRIGHT_CHANNEL=chromium npm run test:browser` green.
