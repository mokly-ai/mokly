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
candidate path for the terminal line. The `r` shortcut of the
[terminal output contract](./mokly-terminal-output.md#interactive-controls)
enqueues a `rebuild` through the same queue. Shutdown stops the queue first.

## Rebuilds

A rebuild recomputes the graph nodes whose keys moved, re-runs discovery when
the file set changed, and validates the candidate catalogue model. A valid
candidate is adopted in one step with its documents: the model, the route
set, and the cache entries of the moved nodes replace the old ones together,
and one revision is published. A failed candidate keeps the last-good model,
route set, cache, and comparison evidence serving; the error is reported
through the watch failure line, and the next authored change starts a fresh
attempt. Warning scopes follow the
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
configuration's `review.base` applies. The port never changes.

## Resource Watches

The referenced closure of every composed document feeds the resource watch
set. A rendered document adds its closure as soon as it renders, even when
the background pass has not finished, and a replaced catalogue state replaces
the whole set. Discovery repeats after watcher readiness to capture references
introduced while the watcher attached. Missing or invalid paths and their
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
`revision` rises by one, the index and every detail are replaced together,
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

Shutdown stops the queue, discards a candidate watcher whose readiness is
still pending, cancels active Git classification and background work, waits
for an active configuration transaction, and then closes the watchers,
timers, sidecars, HTTP listener, event streams, and port in the order of the
[runtime contract](./mokly-runtime.md#shutdown). No later action starts.
Tests prove that no orphan process survives a normal shutdown, a failed
startup, or an interruption, and that the port is reusable afterwards.

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
