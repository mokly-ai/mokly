# Configurable Changes Listing

Status: Planned; not started. Created 2026-09-26 with the user's consent while
discussing finding 2 of [Path-Only Evidence](./changes-path-only-evidence.md).
The user will implement it in a new PR after PR #118 merges. The settings UI
is deliberately out of scope and comes in a later plan.

**Problem:** Changes lists an entry whenever the comparison records any reason
for it, including reasons nobody can see. On PR #118, 82 screens were listed
only because the data they pass to a component changed (sample navigation rows
said `kind: "folder"` instead of `"collection"`); every one of their views was
Unmodified and nothing near the status explained why they were listed. A
component whose own file changes without changing its output is listed the
same way. Finding 1 of the path-only plan fixed one such kind with a
hard-coded rule; this plan makes every invisible kind a setting instead.

**Decision (agreed with the user):** add change-listing settings under
`review.changes` in `mokly.config.ts`. Each setting decides whether one kind
of invisible change lists an entry in Changes; every kind is still recorded as
evidence. Defaults:

| Setting              | What it covers                                                                                  | Default    |
| -------------------- | ----------------------------------------------------------------------------------------------- | ---------- |
| `componentData`      | Props or slot data passed to a component changed, with identical output (`inputs` reasons)      | Not listed |
| `componentStructure` | Component instances added, removed, or reordered, with identical output (`structure` reasons)   | Not listed |
| `declaredFiles`      | A component's own file, or a file declared by exact path, changed with identical output         | Not listed |
| `sharedFiles`        | A file matched by `review.sharedImpact` or inside a declared dependency directory changed       | Not listed |
| `metadata`           | Title, description, tags, folder (`navPath`), rationale, related docs, saved examples, controls | Listed     |

Always listed, not configurable: an added or removed entry, and a rendered
change (a view's normalized document, a changed referenced resource, a linked
stylesheet whose changed rules can match, or owned CSS retained at an actual
invocation). `sharedFiles` replaces the hard-coded path-only rule of
[Path-Only Evidence](./changes-path-only-evidence.md): turning it on restores
the earlier conservative listing. With these defaults the PR #118 comparison
would list 2 entries instead of 83 (the two with metadata changes).

**Design constraints for Milestone 1 to settle precisely:**

- Every reason maps to exactly one setting or to "always". `dependency`
  reasons need a recorded source so the mapping is exact: a rendered resource
  (always), a component-owned path or exact declaration (`declaredFiles`), or
  a glob or declared-directory match (`sharedFiles`). A stylesheet a component
  owns and a screen declares exactly, kept by the screen's view, lists the
  screen only through the declaration (`declaredFiles`); the owning component
  stays listed through its rendered owned CSS.
- The comparison result records every reason with its category, the applied
  settings, and which entries are listed, so a later UI can recompute listing
  in the browser without re-running comparisons. One pure function in
  `@mokly/viewer/data` decides listing from reasons and settings, and every
  surface uses it: the Changes count and filter, navigation, removed rows,
  watched updates, Review JSON, published previews, static export, and CLI
  output.
- Flows are listed only through listed screens. Decide whether affected
  consumers follow listed component changes only (recommended, so an
  unlisted component change does not mark consumers affected) and keep the
  result validators consistent with that decision.
- Per-view review states, Changed views marks, and comparison eligibility are
  unchanged. Details keeps showing every recorded reason as evidence with its
  existing copy; no new visual design.
- Unknown keys and non-boolean values in `review.changes` fail config
  validation; settings changes invalidate cached classification.
- If findings 7 and 8 of the path-only plan are still open when this plan
  starts, fix them first: this plan reuses the per-entry reason sources that
  finding 7 recommends passing to source validation.

## Milestone 1: Contract documentation

- [ ] Add `review.changes` to `mokly-configuration.md` (types, defaults,
      validation) and the authoring config guide.
- [ ] Create a focused spec (for example `mokly-changes-listing.md`) that owns
      the reason categories, the mapping of every reason source to a setting,
      the listing rule, flow and affected-consumer propagation, the recorded
      result data, and the boundary with the later settings UI.
- [ ] Update every document that states Changes membership to link to that
      spec instead of restating it: `mokly-changes.md`,
      `mokly-component-changes.md` (the path rule becomes the `sharedFiles` and
      `declaredFiles` categories), `mokly-component-review.md`,
      `mokly-component-review-validation.md`, `mokly-catalogue-changes.md`,
      `mokly-runtime.md`, `mokly-export.md`, `mokly-css-attribution.md`, the
      catalogue guides, `examples/basic/README.md`, and `src/review/README.md`.
      State that `componentData` off reverses the earlier rule that input
      changes stay in Changes.
- [ ] Define the result schema change (version, reason categories, listed
      flags, applied settings) and how readers treat older results.
- [ ] Validate Prettier, links, anchors, doc sizes, and protocol-reading tests.
- [ ] Commit.

## Milestone 2: Settings, classification, and result data

- [ ] Parse and validate `review.changes` with typed defaults; failure-first
      tests for unknown keys and invalid values.
- [ ] Record every reason with its category, including path-only reasons
      when `sharedFiles` is off, without changing entry `sharedImpact`.
- [ ] Add the shared listing function to `@mokly/viewer/data` and compute
      listed entries, flows, and affected consumers from it in the classifier.
- [ ] Emit and validate the new result data in producer and viewer
      validators, with canonical output.
- [ ] Make every CLI surface (Serve summary, watched updates, Review JSON,
      published previews, static export) count only listed entries.
- [ ] Failure-first tests for each setting on and off, the defaults, flows,
      affected consumers, and a fixture shaped like PR #118 (data-only screens
      unlisted, metadata listed; all settings on lists every recorded entry).
- [ ] Smoke: a preview build with default settings and with every setting on;
      record both Changes counts.
- [ ] Commit.

## Milestone 3: Viewer listing

Tags: ui

No visual change: the viewer reads listing from the shared function.

- [ ] The Changes count and filter, navigation badges and ancestors, removed
      rows, recovery, and watched evidence adoption use listed entries only.
- [ ] Details keeps showing recorded reasons for unlisted entries as
      evidence with the existing copy.
- [ ] Failure-first unit and browser tests for an unlisted data-only screen
      (absent from Changes, reachable from All with its evidence) and a listed
      metadata change; smoke-test through `npm run dev`.
- [ ] Commit.

## Milestone 4: Verification, close-out, and review

- [ ] Run `cargo xtask check`; fix anything it reports until it passes.
- [ ] Commit and push.
- [ ] Review the complete local diff against `origin/main` using
      [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md)
      after the push; report each finding with a number, severity, plain
      explanation, impact of doing nothing, lettered options, and a
      recommendation, without changing the implementation.

## Post-merge follow-up (non-blocking)

- A later plan adds the settings UI (mockups first), including a way to see
  why an entry is listed next to its status.
