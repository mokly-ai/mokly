# Current Documentation Policy

Continuation of [README](./README.md).

## Current Documentation Rule

Former version names, removed field names and implementation plan or milestone
references belong only in `Delivery Status` sections or on a short reviewed
allow list. A status section ends at the next heading of equal or higher level.
Guides have no status notes; keep their delivery notes in the owning protocol.
There is no plans index. Link to the `plans/` directory. Each plan starts with
a `Status: Active` or `Status: Completed` paragraph directly below its title.

The guard scans Markdown in `docs/**`, the root README, module/package/example
READMEs, `xtask/README.md` and authored `notes.md` files. Plans are outside this
current-doc guard. Plan history and link handling follow the separate rules
below. `docs/reviews/**` and `CHANGELOG.md` stay unchanged. The guard fails closed and
reads complete statements across line breaks, including fenced examples. A
word such as "removed", "older" or "never" is not a general exemption.

Each allow-list entry names an exact file, bounded statement or section, and
reason. It may hold only:

- Removed-input type/warning contracts, exact diagnostics, rejection/privacy
  rules and consumer migration instructions that must name the removed input.
- Version-admission/rejection and release migration contracts that must name
  an earlier format; current independent protocols are not former formats.
- Frozen wire/hash identifiers, versioned compatibility fixtures and explicitly
  dated design snapshots retained as history, never as current behavior.
- The documentation policy and review-workflow instructions that discuss how
  to manage delivery references. Upload Plan operations and SVG path commands
  are domain terms, not implementation references.

No whole-directory exemption or broad keyword allowance is permitted. Match
each reviewed exception exactly and fail when it no longer matches its source.

The executable guard is `tests/current_docs_contract.test.ts`. Its reviewed
exceptions live in `tests/fixtures/current-docs-allowlist.json`. Each exception
matches one complete statement or fenced example after whitespace normalization.
An added sentence requires its own review. Missing or changed exceptions fail.
The regression fixture retains verbatim reviewed lines with their source revision.

## Plan History And Local Links

`docs/` and every `README.md` are live content. In an active plan, completed
milestones and checked TODOs are history; all other content is live. In a
completed plan, open review findings and unchecked post-merge follow-ups are
live; all other content is history. Keep the words of history unchanged.

The local-link check includes docs, plans and READMEs. Repair stale live links
with the current target. For a broken history link, replace only its URL with
a GitHub permalink at a commit where the target matches the recorded words.
Start with the commit that wrote the link. A squash-merged PR can require its
`refs/pull/<number>/head`. Markdown line links put `?plain=1` before `#L<number>`.
Earlier dated decisions retain their words and dates. Link-only repairs do not
rewrite those decisions. Record every plan link repair in the commit description.

## Delivery Status

The fail-closed guard and mutation checks are implemented in
[M30](../../plans/remove-source-path-evidence.md#milestone-30-strengthen-tests-the-docs-guard-and-removed-field-types).

## Delivery Status

Removal of baseline compatibility is implemented in
[M23B](../../plans/remove-source-path-evidence.md#milestone-23b-remove-baseline-compatibility).

Uniform CSS attribution, root boundaries, evidence fields and stylesheet-owner
warnings are implemented in [M19](../../plans/remove-source-path-evidence.md#milestone-19-classify-css-by-where-its-rules-match) of the [source-path removal plan](../../plans/remove-source-path-evidence.md).
Comparison details for screens and component saved views are implemented in [M20](../../plans/remove-source-path-evidence.md#milestone-20-show-the-outside-component-evidence);
the whole-document page display is implemented in [M20B](../../plans/remove-source-path-evidence.md#milestone-20b-show-whole-document-page-evidence). The combined formats retain the branch records in manifest v9, catalogue v5
and review v6.

The [id-derived routes plan](../../plans/id-derived-routes.md) records the
identity-only format delivery. The 2026-10-05 decisions are documented in
[M26](../../plans/remove-source-path-evidence.md#milestone-26-document-the-2026-10-05-review-decisions).
The excluded-only mockup and shared Details card are implemented in
[M27](../../plans/remove-source-path-evidence.md#milestone-27-depict-the-excluded-only-stylesheet-state).
Link placement and discovery are implemented in [M28](../../plans/remove-source-path-evidence.md#milestone-28-fix-component-stylesheet-links).
Warning generations, startup cleanup and unused-code removal are implemented in
[M29](../../plans/remove-source-path-evidence.md#milestone-29-fix-serve-warnings-and-startup-cleanup).
Stronger regression tests, recorded mutation runs, the docs guard and type checks are
implemented in [M30](../../plans/remove-source-path-evidence.md#milestone-30-strengthen-tests-the-docs-guard-and-removed-field-types).
Exported navigation and viewer alignment are implemented in
[M31](../../plans/remove-source-path-evidence.md#milestone-31-keep-the-branch-name-in-exported-navigation).
