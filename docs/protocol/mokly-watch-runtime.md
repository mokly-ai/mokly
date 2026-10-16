# Watch Runtime And Recovery

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

Continuation of [Watched Catalogue Development](./mokly-watch.md).

## Actions And Coalescing

Watch actions execute serially through one queue. Notifications are debounced
by `watch.debounceMs` of the
[configuration contract](./mokly-configuration.md), and the changes that
arrive during an active action are coalesced by impact before the next
action starts, so two rebuilds cannot race to replace the catalogue model.
The actions are, from least to most impact, `reload`, `rebuild`, and
`config`; a burst takes the strongest action and keeps every observed
candidate path for the terminal line. The observer keeps one latest descriptor per path while an action runs.
Access-only notifications schedule no action. Values above one day for
`watch.debounceMs` use a one-day delay without panicking. Negative values use zero. The `r` shortcut of the
[terminal output contract](./mokly-terminal-output.md#interactive-controls)
enqueues a `rebuild` through the same queue. Shutdown stops the queue first.

## Rebuilds

A rebuild recomputes the graph nodes whose keys moved, re-runs discovery when
the file set changed, and validates the candidate catalogue model. A valid
candidate is adopted in one step with its documents: the model, the route
set, and the cache entries of the moved nodes replace the old ones together,
and one revision is published. A failed candidate keeps the last-good model,
route set, cache, and comparison evidence serving; the error is reported
through the watch failure line. After a failed attempt, a regular-file event
in any watched, non-denied directory starts a fresh attempt. This includes
a newly created import target that the accepted inventory does not name. Warning scopes follow the
[watched Serve generations](./mokly-build-warnings.md#watched-serve-generations)
rule: an attempt starts a new scope, a failed attempt flushes only its own
warnings before its failure line, and late warnings of a superseded attempt
are dropped.

## Configuration Changes

On a configuration file change, Serve loads and validates the candidate
configuration, re-runs discovery, builds a replacement watcher over the new
watch set and waits for its readiness, and validates the candidate catalogue
model. It then adopts the configuration, the watcher, and the model in one
step, closes the old watcher, and publishes a revision. A load, readiness, or
validation failure keeps the old configuration, watcher, and model. A changed
renderer module or module resolution setting produces a new bundle
generation; the old generation is disposed after adoption. An explicit CLI
`--base` stays pinned across reloads; without one, the adopted
configuration's `review.base` applies. The port never changes. `repoRoot`
belongs to the running pool. A candidate that changes it fails with a typed
restart diagnostic before evaluating modules. Sidecar count and timeout are
process options fixed at startup; they are not configuration fields. The accepted
configuration, observer, and model continue serving until Serve restarts.

## Resource Watches

The referenced closure of every composed document feeds the resource watch
set. A rendered document adds its closure as soon as it renders, even when
the background pass has not finished, and a replaced catalogue state replaces
the whole set. A resource subscription queues attachment outside the render task. Adoption
sets the generation, subscribes, and copies its reached resources in one
critical section. Resource additions extend exact inputs on the active
observer. Discovery repeats after changed roots attach. Missing or invalid paths and their
last-known descendants stay observable until repaired or unreferenced; a
repaired dangling alias restores later edits. A changed resource clears the
resource evidence of the documents that reference it and recomputes them; it
never blocks a rebuild or comparison invalidation.

## Git Observation

Watched Serve polls the resolved `HEAD` and base commits once per second
outside the HTTP event loop; Git resolves symbolic refs, worktrees, and
packed refs. A moved merge base clears the Changes evidence, reclassifies
from the render cache without re-rendering the head side, renders the base
views whose commit changed, and publishes the result as a revision; the
terminal reports `comparing again`. Replacement and shutdown cancel active
ref reads and discard their results. Git commands run in dedicated process
groups on POSIX, so cancellation also stops their helpers; `SIGTERM`
escalates to `SIGKILL` after one second, and Windows terminates the direct
child. Git output is capped at 64 MiB per stream. A late result cannot
publish a stale classification: every terminal status uses the same sequence
check as the result, including a background render failure.

## Publication And Adoption

Each completed action publishes one state under the
[shell delivery contract](./mokly-shell-delivery.md#updates-in-serve):
`revision` rises by one, the index and every detail are replaced together. Equal detail payloads retain
their encoded bytes. Delivery stamps the new revision without copying them,
and the event stream carries the revision as the message id. The shell
refetches the index and the current route's details, updates the navigation,
the Changes marks, Usage, and the details panel in place, and reloads only
the mounted frames whose `documentKey` changed. Only a message from another
server process reloads the page; browser state such as search, filter,
disclosure, scroll, and temporary prop edits survives every other publication. A publication marks the comparison
generations of the superseded state stale before the event is sent, and an
open comparison returns to Current; the next explicit selection captures a
new generation. A filesystem edit made of several operations can publish an
intermediate state; a higher revision proves one completed action, not the
completion of every operation a caller groups into one edit.

## Shutdown

Shutdown follows the [runtime order](./mokly-runtime.md#shutdown), including
before readiness. One lifecycle owns the watcher before preparation starts.
An atomic startup handoff prevents a stopped process from reporting readiness.
The active observer closes in the watcher step. An unadopted candidate drops
when cancellation drains its preparation in the work step. The listener stays
reserved until the sidecars end. No later action starts.
Tests prove that no orphan process survives normal shutdown, failed startup,
or interruption, and that the port is reusable afterwards.

## Terminal Presentation

In rich mode the [terminal reporter](./mokly-terminal-output.md#serve-layout)
presents the catalogue-ready, Changes, rebuild, reload, configuration, Git
refresh, and failure boundaries as lifecycle or change lines. The presentation
adds no watch action. Candidate paths accumulate across a coalesced burst and
the completed line names up to three.

## Verification

Behaviour tests count rebuilds, bundles, and renders per change: an HTML edit
renders only its documents, a JavaScript edit bundles once, a stylesheet edit
recomputes one bundle, and a resource edit renders no fragment. A test that
waits for a result waits for both a higher revision and the semantic state
within its deadline, distinguishing unavailable Changes from an available
zero count, and keeps its subsequent-edit and comparison invalidation
assertions rather than assuming one publication per edit. Real-process tests
cover a sidecar that ignores `shutdown`, a Git process that ignores
`SIGTERM`, and shutdown during a configuration transaction.

See [the catalogue runtime](./mokly-runtime.md) and
[Changes](./mokly-changes.md).
