# CI Fixture Preparation And Lifetime

## Delivery Status

The shared example-baseline preparation, isolated copies, cold operations and
verification ownership below are implemented.
[Generated Output Simplification](../../plans/generated-output-simplification.md)
records the audited callers and comparable measurements for finding 34 option C.
See [CI verification](./ci-verification.md) for suite boundaries and evidence.

## Shared Example Baseline Preparation

Playwright global setup prepares the unchanged example baseline repository and
its rebuilt v8 baseline cache exactly once per browser-suite invocation, before
any test starts. This includes filtered runs and each independent CI shard/job;
no writable checkout or cache is shared between invocations, runtimes or jobs.
Keep the existing global setup's ready-Serve work as well.
Listing/discovery does not trigger this preparation; it runs before execution.

After the main merge, audit every browser fixture that reconstructs this same
example baseline, including indirect helper callers. The current users are
`static-example` in `tests/browser/static_example.spec.ts` and
`design-library-export` in `tests/browser/design_library_export.spec.ts`, through
`tests/helpers/example_baseline.ts`. Record the complete merged call-site list
in the plan before implementing reuse; do not assume these remain the only two.
Only identical baseline inputs share this preparation.

The merged fixtures previously compiled and committed distinct focused outputs.
The shared export baseline uses one common focused source profile: the basic
catalogue/components and the design-library export entries. Both consumers use
that same baseline unchanged before the design fixture applies its source edit.
Its real recipe remains `npm ci`, `npm run build`, `npm run example:build`.
The separate ordinary-preview profile has different inputs and no historical
comparison work; it keeps its own worker-owned preparation.

Global setup must:

1. Create a unique owned root under repository `.context/`, using the existing
   verification owner/cleanup boundary. Copy the real example sources and
   tooling, create its Git baseline commit and retain the exact commit id.
2. Invoke the real baseline preparation path once with that fixture's actual
   configuration and recipe. Require a complete v8 manifest, inventory, authored
   closure and completion marker. Do not fake a cache hit, change the recipe,
   track generated output or use the working checkout as the baseline repository.
3. Finish and drain all preparation processes, then publish a run-scoped
   descriptor atomically. It records the prepared root, pinned commit, requested
   catalogue/config path and recipe identity. A worker must receive that exact
   descriptor, not discover a newest directory or rely on module-global memory.
4. Treat the prepared repository and completed cache as immutable templates.
   A missing, partial, mismatched or invalid template fails setup/the consuming
   fixture; never silently rebuild separately in each ordinary fixture.

The descriptor is `example-baseline.json` beneath that verification owner's
resource root. Workers receive its exact path through
`MOKLY_BROWSER_BASELINE_DESCRIPTOR` and the existing owner environment keys.
It contains `schemaVersion: 1`, `ownerId`, `repository`, `commit`, `configPath`,
`cataloguePath`, `commands`, `recipeIdentity` and `templateHash`. Readers require
that owner's directory, a regular bounded descriptor, exact fields and paths,
the recorded commit and SHA-256 recipe/content identities. They reject aliases.
Template hashing covers file names and bytes, including Git refs/index and cache
contents; timestamps are not identity. The completed cache contains only its
commit's `complete.json`, `inputs.json` and `output/`, with no source or lock debris.

Every consuming fixture gets its own writable repository/source copy and local
copy of the completed cache, preserving the same baseline commit, relative
catalogue root and recipe. Do not share `.git` refs/index, cache locks/markers,
source edits, generated output, export destinations, ports or server processes.
Use copies or independent clones without hard links for mutable data; no
symlinked cache output. Do not copy live locks, partial source extractions or
transaction leftovers. Existing marker and inventory validation must establish
that the copied cache is a real warm hit; copying is not permission to skip it.
Validate the template before and after copying and again at teardown. Exports
must observe a real warm baseline span with no command span; an unexpected
rebuild fails the fixture instead of being hidden by successful export output.

The design-library fixture applies its source edit only after acquiring that
independent copy. The static-example fixture retains its unchanged-HEAD checks.
Neither may write back into the global template. Global teardown runs after
all workers/fixtures drain their resources and removes the template through
its owner. Setup failure and cancellation use the same bounded cleanup path;
unconfirmed termination fails verification and retains diagnostic files.

## Cold Operations And Time Limits

Keep exactly one browser test whose operation under test is a real cold
example-baseline rebuild. It uses an independent empty cache, observes the
actual install/build commands, and verifies the resulting v8 cache/inventory
and comparison result. It must not consume the warmed cache. Identify and
retain that owning test after the merge, adding an explicit regression if cold
work previously happened only incidentally in fixture setup. Keep every
existing UI assertion in the ordinary fixtures that now reuse preparation.
The owning case is `tests/browser/example_baseline_cold.spec.ts`.

Also retain `tests/browser/preview_preparation.spec.ts` and its real cold
`npm run preview:build`, absent-output proof, generated-byte stability and
fresh-publication checks. It remains independent of the shared baseline setup;
do not replace its operation with a copied prebuilt preview. Other tests may
reuse setup only when setup is not the operation they verify. This decision
does not remove unit/integration baseline, lock, cancellation, invalidation,
source-mutation or clean-install coverage, or change what the preview test builds.

Keep `FULL_CATALOGUE_SETUP_TIMEOUT_MS = 600_000` (600 seconds) unchanged. Apply
the same 600-second ceiling to the one global baseline preparation operation;
do not move repeated unbounded work into global setup. Do not change assertion
deadlines, worker count, retries, sharding, coverage requirements or the full gate.

## Timing And Acceptance For Shared Preparation

Before changing shared preparation, measure the merged branch with the old fixture
preparation. Repeat after the change with the same runtime, npm, Chromium,
hardware, worker/shard selection and controlled cache conditions. Record full
browser-suite wall time, startup/global setup/teardown time, complete test
inventories and all fixture phase timings. Report any measurement difference
that prevents a direct comparison; do not compare only assertion durations.

Keep `[mokly:fixture-timing]` records with schema version, fixture, phase,
`durationMs`, status and `operationUnderTest`. Record global source/Git setup,
real baseline install/build/total and each fixture's copy, cache validation and
export phases. Ordinary preparation is `operationUnderTest: false`; the
retained cold-baseline and preview-build operations are true. Warm consumers
must report absent install/build phases as `not-observed` with null duration,
not invented zeroes. Count rebuilds of this shared example baseline: one global
preparation plus the one cold-baseline regression. Report the separate preview
operation and any Serve preparation of a different pinned base on their own
terms. No ordinary consumer may cause another equivalent baseline rebuild.

Acceptance proves isolation between source-mutating fixtures, immutable template
bytes/refs, warm hits for every audited consumer, failed/cancelled preparation
cleanup and continued real cold coverage. Record before/after results in the
plan with retained logs under `.context/`. Run the complete gate, commit and
push before the final implementation review. A timing improvement cannot waive a test,
change the 600-second limit or hide preparation in an unmeasured phase.

## Existing Verification Rules

[CI suite evidence](./ci-suite-evidence.md) owns fixture lifetime, cleanup,
cancellation and hosted acceptance measurements. Shared preparation retains
those rules; it changes only where equivalent baseline work is prepared.
