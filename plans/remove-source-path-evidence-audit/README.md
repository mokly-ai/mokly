# Milestone 16 Mainline Preservation Audit

This is supporting evidence for [Milestone 16](../remove-source-path-evidence.md#milestone-16-integrate-main-0130).
It is not a new implementation plan. It audits base `3699c566`, main `b2c82c15`
and the original local merge `7dc94cbe`. The pending amendment must keep both parents.

## Scope And Method

The supplied `.context/m16-main-lines-absent.txt` contains 335 paths and 1,360
main-added lines absent by exact stripped-line matching. Its SHA-256 is
`a1c4009c45acfb04b37f42ca9fa77a11c2c84133cd99b6d87405763aba72bdde`.

Read each absent line with its main-to-merge diff. Trace renamed types, moved
helpers, split tests and rewritten prose to their current owners. A line match
alone is not proof of preservation. Check the approved plan decisions before
accepting any reduction. Classify a mixed file as (c) if any contract was lost;
otherwise use (a) for an intentional migration or removal, or (b) for equivalent
moves, extensions and wording. Counts refer to the original merge, before these
restorations.

| Class                                      | Files | Result                                       |
| ------------------------------------------ | ----: | -------------------------------------------- |
| (a) Intended migration or approved removal |   307 | Keep the branch contract.                    |
| (b) Equivalent move, split or wording      |    16 | Keep the current owner and behavior.         |
| (c) Lost content                           |    12 | Restore and cover with failure-first checks. |
| Total                                      |   335 | Every supplied path is classified once.      |

The following tables name every path and its decision:

- [Contracts, READMEs and examples](./contracts-and-examples.md).
- [Source and tools](./source-and-tools.md).
- [Tests and fixtures](./tests.md).
- [Additional mainline paths](./additional-paths.md).
- [Added test-case audit](./test-cases.md).

A rename-disabled comparison covers all 1,580 paths changed on main since the
base. Of these, 1,111 path states match main exactly. The remaining 469 are the
335 supplied paths plus 134 additional paths. The additional table covers the
latter, including the catalogue fixture rename that an ordinary rename-aware
file list hides. No production source, guide or example requires restoration.

## Reasons For Intended Reductions

These reasons apply only to the paths named in the tables.

- **F — Formats.** Manifest v8, catalogue v4 and comparison v5 replace main's
  v7/v3/v4. Types, strict readers, fixture paths, byte digests, package checks
  and assertions move together. Static delivery v3, removed-page preview v2,
  export ownership v2 and upload v1 retain their separate versions.
- **P — Path evidence.** Remove authoring `dependencies`, component
  `ownedDependencies`, manifest `declaredDependencies`, catalogue
  `details.dependencies`, and result/entry `sharedImpact`. Keep warnings for
  authored retired fields and TypeScript rejection. Delete only their old
  matching, ownership, display and tests. Preserve rendered-resource reasons,
  CSS exclusion, metadata, navigation paths, usage and screen-to-flow effects.
  The approved Shared impact screen removal changes the design count from
  102 to 101 and Browse/Changes from 63 to 62. The existing component artboard
  becomes Excluded styles. Do not change the deferred second-review findings.
- **S — Stylesheets.** Component `stylesheets` replaces the old source ownership
  and example style collector. Keep mixed/global configured CSS, imported CSS,
  actual render order, resource ownership, transient rendering and warning
  behavior. Exact-screen source declarations no longer override attribution.
- **H — History.** Normalize supported v3–v7 metadata, strip retired fields,
  drop collection records and flatten variants before v8 validation. Preserve
  required/inferred source inventories. Per the recorded user decision, older
  stored route layouts make Changes unavailable. Keep main's identity-derived
  panes and original snapshot bytes. Unsupported v2/v9 fixture cases replace
  main's lower/newer-version cases without removing those checks.
- **B — Equivalent structure.** File splits, helper extraction, warning
  callbacks and accepted-graph reuse preserve the prior operations and tests.
  Declared-CSS watch coverage extends configured coverage. Historical marker
  handling keeps original range coordinates. Shorter status notes do not
  remove the normative rules retained in their owning sections or linked docs.

## Restorations

The 12 class (c) rows list every restored item by original file. The catalogue's
projection, privacy, serialization and serving rules now live in the linked
`docs/protocol/mokly-catalogue-delivery.md`. The original anchors still link to
those sections. Both pages are below 250 lines; the old size exception is
removed. Other restored protocols stay below 250 lines. No cap is raised.

`tests/mainline_preservation_docs.test.ts` adds 14 targeted checks. All 14 fail
against the original merged docs and pass after restoration. The existing split
link check includes the new catalogue page. The complete unit run also found
missing release-note names for main's released ManifestV7, ReviewResultV4 and
ScreenReviewV4 exports. Their class (a) migration now names both old and current
types; the existing public-export guard supplies its failure-first check. The watch wording preserves main's
indexed lookup contract and clarifies that descendant lookup is bounded by path
depth; exact-file and ancestor membership use constant-time set lookups.

Verification logs and the complete path inputs live in
`.context/m16-preservation/`. The active milestone records final checks and the
amend/remerge review. The reviewer owns the push and the later review against
`origin/main`.
