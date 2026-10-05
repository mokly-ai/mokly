# Publication Changes And Acceptance

Continuation of [Optional Changes In Publication](./mokly-publication.md).

## Explicitly Include Changes

With `--include-changes`, publish the existing All/Changes navigation and screen
comparison controls, including a zero changed count. Retain removed-screen
metadata, previous-version pages, and comparisons. Current and removed entries
never share a path; an entry the [move contract](./mokly-moves.md) pairs stays
current, labelled Moved, with no removed row.
Render those removed screens with their Removed badge and no comparison
controls. Publication packages their baseline views and advertises the
descriptor defined by [removed previews](./mokly-removed-previews.md), which the
shell resolves into the previous version.
Include page and document impact and removed page and document states from the
[shared catalogue snapshot](./mokly-catalogue-changes.md), including flat
Changes rows after deleting their parents and each removed page's or
document's packaged preview. Pages and documents have no visual comparisons;
screen metadata remains supported.

Resolve the effective base and HEAD once, then pin their merge-base commit for
both entry impact and screen comparisons. Capture the current catalogue,
generated documents, and resources consistently for that build; fail if inputs
change during capture rather than mix revisions. Record the resolved comparison
baseline with the exported review metadata. The artifact represents the files
captured at publication time, including any permitted uncommitted input, rather
than claiming that HEAD alone identifies those bytes.

Package validated comparison data and isolated resources under the existing
immutable generation path. Browser diff selection loads the packaged result;
refresh/retry uses that same result. Later Git commits or changes to the base
ref do not update a published artifact. Only a new publication replaces it.
After that generation path is known, repository publication uses the consumer
exporter's typed removed-preview descriptor builder and adds each descriptor to
the matching captured static shell. This artifact-only step does not advertise
page paths from the development server used during capture.

Missing history, an invalid v9 baseline, capture inconsistency, or comparison
failure aborts publication and preserves previous output. Recognized earlier
output instead completes with Changes unavailable under the
[baseline compatibility contract](./mokly-baseline-compatibility.md). Preserve
source protection, snapshot isolation, resource confinement, and sandbox rules.
Both options apply the
[shared source policy](./mokly-source-protection.md), including unimported
reserved files and complete config/consumer input inventories.

## Workflows And Presentation

The existing `main` preview job uses the default command. The PR preview job
explicitly passes `--include-changes --base origin/main`, retaining its current
review purpose and full-history checkout. Deployment aliases, credentials,
ownership checks, cleanup, and npm publication remain unchanged.

The option is selected at build time. A visitor cannot toggle omitted review
data on. Local development keeps its existing Git-aware Changes and on-demand
comparison behavior. Reuse the same shell components, enabling controls from
the explicit capability rather than an environment label or separate shell.
Before UI implementation, add mobile and desktop mockups of the current
catalogue with review omitted and the same catalogue with review included.

## Acceptance

Test default and explicit options through the script and internal boundary,
including invalid arguments and configured/default/overridden bases. Prove
default publication performs no Git/review calls and works without history.
Opt existing comparison tests and PR workflow fixtures in explicitly.

Test archive inputs, removed-entry absence, excluded stale comparison assets,
review-to-default replacement, rollback, unavailable/advancing bases, input
changes during capture, and frozen comparisons after publication. Browser tests
cover controls, persisted preferences, direct links, search/tags, anchors,
Back/Forward, zero-change review, and no comparison network requests by default
at mobile and desktop widths. Preserve existing comparison and safety tests.
Parameterize static-export tests over both options: no live-update entrypoint,
no EventSource or polling request, and no events endpoint or redirect. Test
home, current, not-found, and supported removed-entry routes while proving
normal navigation and opted-in comparison loading still work.
For both options, reject escaping context, parent, and output symlinks without
changing the outside target. Prove valid in-repository symlinks and a symlinked
repository root still support publication.
Test a rebuild immediately before the first input scan and a manifest mutation
after its initial read. Verify navigation, captured pages, and opted-in change
metadata agree, and failed capture preserves the previous output.
Cover safe file/directory aliases in both options, target-only edits, private
aliases, unrelated outside/dangling/cyclic links, and an escaping manifest before
any target read. Remove a copied resource during staging to prove validation
checks exported bytes and preserves the previous artifact.
