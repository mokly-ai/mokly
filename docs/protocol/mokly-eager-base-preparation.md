# Eager Base Preparation

This page defines the base preparation that Serve starts before the
[background pass](./mokly-on-demand-background.md) of a head state ends, and
how the Changes classification of that state adopts it. Eager preparation is
that work until the classification adopts it. The
[base preparation contract](./mokly-base-preparation.md) owns the sources, the
dependencies, and the kept base. The
[on-demand contract](./mokly-on-demand.md#background-work-and-replacement)
owns the order of the background pass and the base renders. `build` and
`publish` prepare no base early.

## Start

Serve starts eager preparation when the working configuration of a head
preparation attempt validates, with and without watch, and the configured size
of its sidecar pool is at least three. The work that needs no
head dependency evidence can then run: the pin of the merge-base commit, the
checkout settings, the base sources, the lease of an existing complete
extraction, the base configuration, discovery, and the clean dependency
identities of both sides. It builds an extraction only when discovery shows
that the base needs a sidecar, under the
[source rules](./mokly-base-preparation.md#sources). So an HTML base without a
renderer or PostCSS builds no extraction and starts no sidecar.

The configured size is the exact size from `--sidecars` or `MOKLY_SIDECARS`,
or the core count that bounds a
[default pool](./mokly-sidecar-memory.md#default-admission). At a configured
size of one or two, Serve starts no eager preparation. Each classification then
prepares its base after the background pass of its state, under the
[base preparation contract](./mokly-base-preparation.md). The current
[capacity](./mokly-sidecar-memory.md#capacity) of the pool never changes this
choice. A pool with a configured size of three or more keeps eager preparation
when its capacity falls, and the [admission](#admission) rules then bound its
sidecar calls.

Decision: a configured size below three starts no eager preparation. Rejected:
eager preparation at a configured size of two, because there it exceeds the
memory and edit bounds of serial preparation. Rejected: the current capacity as
the condition, because a temporary memory shortage would then turn off the
eager preparation of a larger pool.

The pin, the checkout settings, the base sources, the lease, and the base
configuration run at once. Discovery, the extraction, and the dependency
identities also run at once when the preparation holds the lease of a complete
extraction. Without that lease, they wait until Serve is
[ready](./mokly-runtime.md#serve) for the first time. After that first
readiness, the preparations of later head attempts do not wait for it. A
cancelled preparation ends its wait at once.

Decision: cold discovery waits for the first readiness of Serve. Rejected:
cold discovery during startup, because cold base reads and extraction compete
with head startup and delay readiness. Rejected: a start when the head bundle
ends, because head startup work continues after the bundle.

Head dependency evidence is the set of dependency directories that the head
preparation used. The
[package tiers](./mokly-comparison-packages.md#javascript-package-selection)
select the base dependencies with it. Dependency selection, installation, the
validation of the base catalogue, the base graph, and the freshness record
wait until Serve adopts the head preparation of the state, after any watch
recheck.

Eager preparation starts no work of the comparison: it lists no views for
[early renders](./mokly-base-preparation.md#shared-render-runtime), starts no
early render, renders no base document, and starts no capture or comparison.
Its validation and graph preparation can still read the views of the base
catalogue and graph. The classification starts the comparison work when it
adopts the preparation. The preparation uses the current Mokly version and the
rules of the base preparation contract.

Decision: dependency work waits for the adopted head preparation. Rejected: a
start when the head bundle ends, because the description, the class maps, and
the stylesheets of the head record more dependency directories after it. A
partial list can change a tier, a warning, or an install.

An existing kept base stays with the classification, which decides its reuse,
its freshness, and its release under the
[base lifetime rules](./mokly-base-preparation.md#serve-base-lifetime). Eager
preparation never releases a kept base. When its pinned key is the key of the
kept base, it does no base configuration or source work after the pin. When
the key differs, it does only the work that needs no head dependency evidence,
until the classification releases the kept base. Without a kept base, all
eager work runs. So an edit and its revert reuse the kept base as without
eager preparation.

## Ownership

A base preparation belongs to its classification, which is its owner. An eager
preparation belongs to the head preparation attempt that starts it, and then
to the head state that the attempt creates, until the classification adopts
it. Until a keep, it is pending work, not a
[kept base](./mokly-base-preparation.md#serve-base-lifetime). A failed attempt,
a replacement of that state, and the stop of Serve cancel it. Serve then waits
until its Git commands, installs, sidecar calls, and cache writes end, before
it releases the sources and leases of the preparation. A failure of eager
preparation never fails or delays the start of Serve or Browse.

Only the classification of the same state can adopt the preparation. A
cancelled or superseded preparation publishes nothing, is never adopted, and
cannot release a newer base. After adoption, the classification owns the
preparation under the [cancellation rule](./mokly-base-preparation.md#cancellation).
Only a successful capture and a keep that the base lifetime rule allows detach
it.

Decision: the head state owns eager preparation until its classification
adopts it. Rejected: a kept base that holds unfinished preparation, because no
capture proves such a base. Rejected: work that outlives its state, because it
could publish or hold the sources of a superseded state.

## Adoption

When the background pass of the state ends, its classification adopts the
eager preparation of that state. It adopts the preparation only when every
input that the preparation used is still current:

- its pinned key is the current
  [base key](./mokly-base-preparation.md#serve-base-lifetime),
- the head dependency evidence that it used is the evidence of the current
  head,
- the working manifests and lockfiles that it read are unchanged.

When any of these inputs is not current, the classification discards the
preparation and continues as if no eager preparation had run. So a matching key
alone never adopts a preparation. Adoption repeats no completed work, and it
waits for the work that still runs. A failure of the preparation has the
outcome that the same failure has when the classification prepares the base.

A classification gives the same result with and without eager preparation: the
same Changes states, details, warnings, outcomes, and comparison bytes.

## Reporting

Eager preparation reports nothing before adoption: no Changes status, no
comparison step, no cache directory line, no warning, and no diagnostic text. It
keeps these events in one record, in the order in which the work produced
them. At adoption, Serve reports the kept events in that order, as if the work
produced them then. It reports the later events as they happen. Each report
follows the normal rules:

- the [Changes status](./mokly-changes.md#changes-in-serve) publication,
- the [comparison steps](./mokly-terminal-steps.md#comparison-steps),
- the [cache output rule](./mokly-terminal-cache.md#cache-directory),
- the [attempt rules](./mokly-build-warnings.md#watched-serve-generations) for
  warnings and diagnostics.

So the statuses, the steps, the cache line, and the warnings keep the text and
the order that they have without eager preparation. Only their timing differs.
A kept cache directory line is not the line of the process until Serve writes
it, so it never takes the place of the line of head work. A cancelled or
discarded preparation drops every kept event.
Opt-in [timing records](./mokly-review-timings.md) report the work as it runs.

Decision: one ordered record of events, reported at adoption. Rejected: the
latest step only, because statuses and steps that a comparison without eager
preparation shows would then be missing. Rejected: reports while the work
runs, because each status publication replaces the index and the details
during the background pass, and base lines would mix with head output.

## Admission

Eager sidecar calls share the
[sidecar capacity](./mokly-sidecar-memory.md#capacity) with head calls. Each
holds a [claim](./mokly-sidecar-memory.md#claims) until it ends. At most one
eager call runs at a time. Serve admits an eager call only when no head call
waits for admission and no whole HTTP render is active. It admits the call only
when a claim and an eligible slot are free together, so an admitted eager call
never waits for a slot. An eligible slot is an empty slot or an idle process of
a base root. An eager call never takes the warm head process or another head
process.

These rules use the current capacity of a pool whose configured size is at
least three, because a smaller pool runs no eager preparation, as
[Start](#start) says. At a capacity of one, eager preparation makes no sidecar
call. At a capacity of two or three, an eager call also waits until the
background pass has started its last view. A wait for admission ends at once
when its preparation is
cancelled. An admitted call finishes under its existing deadline. Eager
preparation adds no deadline, no retry, and no timed wait. After adoption, its
calls follow the base call rules of the on-demand contract.

Decision: eager calls use only the shared capacity that head work leaves.
Rejected: the base admission of the classification, because it waits for every
active head call and would hold eager work until the pass ends. Rejected: a
separate base pool, because one memory bound would then need claims across two
pools. Rejected: eager calls at a capacity of one, because the only process
serves the head.

Decision: at a capacity of two or three, eager calls wait for the last view
start. Rejected: eager calls beside head views there, because one eager claim
takes a half or a third of the head slots.
