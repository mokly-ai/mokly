# Current Documentation Policy

Continuation of [README](./README.md).

## Current Documentation Rule

Former version names, removed field names and implementation plan or milestone
references belong only in `Delivery Status` sections, except for the content
listed below. A status section ends at the next heading of equal or higher level.
Guides have no status notes; keep their delivery notes in the owning protocol.
There is no plans index. Link to the `plans/` directory. Each plan starts with
a `Status: Active` or `Status: Completed` paragraph directly below its title.

This rule applies to Markdown in `docs/**`, the root README,
module/package/example READMEs, `xtask/README.md` and authored `notes.md` files.
Plan history and link handling follow the separate rules below.
`docs/reviews/**` and `CHANGELOG.md` stay unchanged.

Reviewers may accept these names and references in the following content:

- Removed-input type/warning contracts, exact diagnostics, rejection/privacy
  rules and consumer migration instructions that must name the removed input.
- Version-admission/rejection and release migration contracts that must name
  an earlier format; current independent protocols are not former formats.
- Frozen wire/hash identifiers, versioned compatibility fixtures and explicitly
  dated design snapshots retained as history, never as current behavior.
- The documentation policy and review-workflow instructions that discuss how
  to manage delivery references. Upload Plan operations and SVG path commands
  are domain terms, not implementation references.

Reviews check this rule. No test checks documentation wording, as required by
[`AGENTS.md`](../../AGENTS.md). Tests compare documentation with code
structurally, including parsed values, names, options, tables, links and counts.

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

Reviews enforce the current-documentation rule. The documentation-wording
tests were removed under the option A decision in
[M35](../../plans/remove-source-path-evidence.md#milestone-35-integrate-main-175-and-181).

## Delivery Status

Removal of baseline compatibility is implemented in
[M23B](../../plans/remove-source-path-evidence.md#milestone-23b-remove-baseline-compatibility).

Uniform CSS attribution, root boundaries, evidence fields and stylesheet-owner
warnings are implemented in [M19](../../plans/remove-source-path-evidence.md#milestone-19-classify-css-by-where-its-rules-match) of the [source-path removal plan](../../plans/remove-source-path-evidence.md).
Comparison details for screens and component saved views are implemented in [M20](../../plans/remove-source-path-evidence.md#milestone-20-show-the-outside-component-evidence);
the whole-document page display is implemented in [M20B](../../plans/remove-source-path-evidence.md#milestone-20b-show-whole-document-page-evidence). The combined formats retain the branch records in manifest v10, catalogue v6
and review v7.

The [id-derived routes plan](../../plans/id-derived-routes.md) records the
identity-only format delivery. The 2026-10-05 decisions are documented in
[M26](../../plans/remove-source-path-evidence.md#milestone-26-document-the-2026-10-05-review-decisions).
The excluded-only mockup and shared Details card are implemented in
[M27](../../plans/remove-source-path-evidence.md#milestone-27-depict-the-excluded-only-stylesheet-state).
Link placement and discovery are implemented in [M28](../../plans/remove-source-path-evidence.md#milestone-28-fix-component-stylesheet-links).
Warning generations, startup cleanup and unused-code removal are implemented in
[M29](../../plans/remove-source-path-evidence.md#milestone-29-fix-serve-warnings-and-startup-cleanup).
Stronger regression tests, recorded mutation runs and type checks are
implemented in [M30](../../plans/remove-source-path-evidence.md#milestone-30-strengthen-tests-the-docs-guard-and-removed-field-types).
Exported navigation and viewer alignment are implemented in
[M31](../../plans/remove-source-path-evidence.md#milestone-31-keep-the-branch-name-in-exported-navigation).
