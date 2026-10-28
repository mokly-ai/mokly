# Watch Runtime And Recovery

Continuation of [Watched Catalogue Development](./mokly-watch.md).

## Actions And Coalescing

Watch actions execute serially through one queue. Notifications are debounced
by `watch.debounceMs` of the
[configuration contract](./mokly-configuration.md), and the changes that
arrive during an active action are coalesced by impact before the next
action starts, so two rebuilds cannot race to replace the catalogue model.
The actions are, from least to most impact, `reload`, `rebuild`, and
`config`; a burst takes the strongest action and keeps every observed
candidate path for the terminal line. Access-only notifications schedule no action. Values above one day for
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
the whole set. Missing or invalid paths and their
last-known descendants stay observable until repaired or unreferenced; a
repaired dangling alias restores later edits. A changed resource clears the
resource evidence of the documents that reference it and recomputes them; it
never blocks a rebuild or comparison invalidation.

## Git Observation

Watched Serve polls the resolved `HEAD` and base commits once per second;
Git resolves symbolic refs, worktrees, and packed refs. When either tip moves, Serve resolves their merge base again.
An equal merge base keeps the published Changes state. A moved merge base clears the Changes evidence, reclassifies
from the render cache without re-rendering the head side, renders the base
views whose commit changed, and publishes the result as a revision; the
terminal reports `comparing again`. Replacement and shutdown cancel active
ref reads and discard their results. Git commands follow the cancellation and
output bounds of the [Git runtime](./mokly-git.md). A late result cannot
publish a stale classification: every terminal status uses the same sequence
check as the result, including a background render failure.

## Publication And Adoption

Each completed action publishes one state under the
[Serve update rules](./mokly-shell-delivery.md#updates-in-serve). Browser
state such as search, filter, disclosure, scroll, and temporary prop edits
survives every publication of the same server process. A publication marks the comparison
generations of the superseded state stale before the event is sent, and an
open comparison returns to Current; the next explicit selection captures a
new generation. A filesystem edit made of several operations can publish an
intermediate state; a higher revision proves one completed action, not the
completion of every operation a caller groups into one edit.

## Shutdown

Shutdown follows the [runtime order](./mokly-runtime.md#shutdown), including
before readiness. A stopped process never reports readiness. The active
observer closes in the watcher step. An unadopted candidate drops
when cancellation drains its preparation in the work step. The listener stays
reserved until the sidecars end. No later action starts. No orphan process
survives normal shutdown, failed startup, or interruption, and the port is
reusable afterwards.

## Terminal Presentation

In rich mode the [terminal reporter](./mokly-terminal-output.md#serve-layout)
presents the catalogue-ready, Changes, rebuild, reload, configuration, Git
refresh, and failure boundaries as lifecycle or change lines. The presentation
adds no watch action. Candidate paths accumulate across a coalesced burst and
the completed line names up to three.

See [the catalogue runtime](./mokly-runtime.md) and
[Changes](./mokly-changes.md).
