# Watched Catalogue Development

`mokly serve` watches by default; `--no-watch` serves one deterministic
snapshot. Every development catalogue shell loads the package-owned browser client, which connects to
the versioned event stream. Higher versions refresh background evidence in place
or reload the durable URL when content has changed, as defined by the
[live evidence contract](./mokly-live-evidence.md). Snapshot panes do not run this client. Watch classification
derives from resolved config, both source graphs, and the resources referenced
by generated output:

- the config file and its transitive authoring imports reload configuration, generated
  output, watch targets, and the child;
- resolved entry modules, page/renderer/transformer imports, and every other
  inventoried source rebuild generated output, including imported bytes handled
  by asset loaders;
- a created, renamed, or deleted regular file whose repository-relative path
  matches an `entries` glob re-runs discovery before that rebuild, so the
  resolved entry set follows the filesystem; the glob defines the complete
  entry shape, and the stable prefix of every entry glob is a watched root for
  this purpose;
- an input shared with shell metadata rebuilds before restarting the child;
- configured stylesheets and referenced local CSS, fonts, images, and other
  resources used only through public URLs reload the browser without rebuilding;
- header-proven generated output plus `.git`, `.context`, `node_modules`,
  `dist`, `target`, coverage, browser-test output, comparison output, and Mokly
  transaction trees are pruned from broad watches and classify as ignored;
- additional inputs use the explicit action declared in config.

An entry glob's stable prefix is a traversal waypoint, not an exemption for its
whole subtree. A candidate that is an ancestor of, or equal to, the prefix is
never pruned. Broad traversal evaluates descendants relative to the deepest
containing prefix, while discovery and entry-candidate classification evaluate
a matched file relative to the deepest root whose glob matches that file. Below
that base, only directory segments are denied, so a regular file named `target`
remains ordinary. The denied names are `.git`, `node_modules`, `.mokly-cache`, `dist`,
`coverage`, `target`,
`test-results`, `playwright-report`, `.context`, and segments beginning with
`.mokly-review-` or `.mokly-write-`. Baseline-cache, `review.outDir`,
header-proven generated-output, and export-output rules still apply. Thus an
explicit `dist/entries/**` root remains reachable, while `src/dist` and
`src/node_modules` are pruned beneath a `src/**` root, and repository-root globs
still prune top-level `.git` and `node_modules`. The discovery walk and broad
watch traversal skip `review.outDir`; matching file events beneath it are
ignored too.

Exact required files, including the config and its imports, inventoried sources,
the renderer, and configured stylesheets, retain both their ancestor path and the
file itself even when intentionally nested beneath an ordinarily ignored
directory. Configured stylesheet files remain reload inputs.
Those package-owned classifications take precedence over additional watch rules.
A created path beneath a denied segment relative to its glob root, or beneath
`review.outDir`, is ignored because discovery cannot accept it. A file created
under an entry glob root that no `entries` glob matches and that is not imported
classifies like any other unrelated file. Package source under `node_modules` or
an npx cache is never treated as consumer source. Development of Mokly itself
uses repository tooling rather than a hidden consumer-specific self-reload path.

Header-proven generated output is trusted only when its recorded owner is a
resolved entry module, an inventoried source, or a repository-relative path
matching a configured entry glob with dotfile matching enabled. As the
glob-based trust branch, a repository-root glob trusts every path matching that
glob and nothing else. A deleted or renamed entry remains trusted while its old
path still matches, so its stale output is pruned as an orphan. Other
Mokly-headered HTML is unclaimed and remains untouched.

Resource discovery follows the same portable HTML/CSS URL rules as Changes,
including transitive imports and nested documents, with shared edges read once
per discovery pass and cycles visited once. External URLs and resource hints
are excluded. Live documents include ignored-region resources in this watch
graph so their rendered chrome refreshes even when Changes remains empty.
Only confined public files and their validated local alias targets are watched;
resource watchers do not follow symlinks. Their lexical paths remain observable
so an invalid or replaced alias can be repaired. Generated files and
package-owned ignored paths remain excluded, preventing output feedback loops.

The repository's `npm run dev` command builds the local CLI once, then runs
watched Serve with `examples/basic/mokly.config.ts`. Arguments after `--`
are forwarded to Serve, for example `npm run dev -- --port 0`. Restarting the
command rebuilds changes to Mokly's own source; this shortcut does not add
watch targets beyond the example's inputs and referenced resources.
Use `npm run -s dev` for Mokly's rich terminal output without npm's outer script
banner; nested build scripts are already quiet.

An unowned public HTML file beneath `mockupsDir` is an authored static input,
not generated merely because of its extension. Reachable HTML resources reload
automatically; an unrelated file can use an explicit reload, restart, rebuild,
or ignore rule. Configured inputs and discovered resources take precedence over
additional rules.

Export markers prove ownership of their listed files, not every descendant of
the output directory. Ignore inventory-listed files and the marker itself, but
traverse the output and its subdirectories so later unowned additions still
reach consumer rules. Owned directory events may be ignored without pruning
traversal. Active transaction trees and the initialized internal reservation
namespace remain pruned. Unowned files still make subsequent export replacement
fail; watch classification does not grant permission to overwrite them.

The input graphs are resolved before the source/config watcher is constructed.
It becomes ready before initial index preparation; import changes replace its watch
set using the same readiness and recovery rules as configuration adoption.
Resource watches are discovered from candidate output and become ready before
it is written. Discovery repeats after readiness to capture newly introduced
references during watcher attachment. Notifications during generation and child
startup are buffered. Each notification delivery is isolated: a classifier
exception is reported once, that event is dropped, and later notifications keep
flowing. A child receives the parent-validated catalogue, validates
its source inventory, and binds before
readiness. Initial startup tries a requested concrete port and then each higher
port in order when the address is occupied; port `0` delegates selection to the
operating system. The resolved port remains stable across child restarts, which
bind strictly rather than changing the published URL. Exhausting the valid port
range or encountering another bind error exits non-zero without leaking
watchers. An unexpected child failure after readiness reports its diagnostic
once, starts cleanup if the process remains alive, and enqueues a restart through
the same serialized action queue used for authored changes. The supervisor
retains ownership until terminal confirmation; a replacement cannot bypass an
in-progress cleanup or contend with the failed child's still-bound port.

The supervisor retains the five-minute readiness safety allowance for the child
to receive the accepted config, live index and retained renderer, construct its
catalogue and bind. The interactive performance target is under five seconds;
the timeout is not an acceptable startup duration. Startup transfers no rendered
HTML and avoids rereading the large manifest file. The child
still validates the transferred metadata and re-resolves the config and consumer
input graphs to enforce source-inventory freshness before binding. These checks
are visible separately with `--debug-timings`. Local controls are available at
readiness. The older full-manifest internal startup path retains its post-ready
runtime handoff; live Serve uses the lightweight pre-ready handoff.

On a config-file change, the parent first loads and validates the candidate,
starts a replacement watcher, waits for readiness and validates a new index and
rendering graph. It then adopts the config, closes the old watcher and restarts
the child. Load, watcher-readiness or index-validation failure retains the previous
config, watcher, output and child. Full rendering and transactional output writing
follow in the background. Their failure preserves old disk output and withholds
complete usage/Changes; valid current previews remain available. An explicit CLI
`--base` remains pinned; without one, the restarted child uses the newly loaded
config's comparison base.

Initial startup, successful rebuilds and configuration changes, and resource
reloads refresh the reachable resource watch set. A ready replacement is adopted
only with its matching output; failed writes discard it and retain the previous
resource watches. Independently, visited previews send generation-tagged document
closures to the parent, which attaches incremental resource watches immediately,
even when exhaustive rendering has not finished or fails elsewhere. Incremental
watches accumulate within a source generation and are replaced by the next
generation's visited closure. Discovery repeats after watcher readiness. Reloads
keep missing or invalid paths and their last-known
descendants observable until repaired or unreferenced. Invalid resources still
make Changes unavailable, while verified baseline deletions identify affected
screens. Neither case prevents a live reload or comparison-cache invalidation.
Resource watches coalesce file and entry-replacement notifications and replace
their observers when validity changes, so repairing a dangling alias as a regular
file also restores subsequent edits. Unnamed raw events and unrelated generated
entries cannot broaden the resource watch set.
Generated-output ownership checks return false for unresolvable paths, so a
temporarily dangling resource remains observable and can recover after repair.

Rebuilds are debounced and accept metadata and the retained graph together. A failed
index candidate keeps the last-good server and output; a background failure keeps
the last-good disk output without claiming completeness. Errors are reported while
the watcher waits for another authored change. A
successful rebuild or healthy restart publishes a new update version. Browsers
reload their current durable URL and restore search, changed-only selection,
current collection disclosure, the disclosure baseline captured before active
filtering, details disclosure, viewport and color-scheme selection, responsive
drawer, catalogue scroll, and per-region stage scroll once. Recovery is strictly
parsed with one compatibility rule: a payload from before filter-baseline
capture treats that missing baseline as unavailable while restoring its other
valid state. Browse applies durable preferences and initial active-route
selection before one-shot recovery. It then re-establishes active-route
visibility, promoting a recovered pre-filter baseline only when a closed
ancestor must be opened. A non-null baseline without active search or Changes
filtering is invalid. Recovery applies only when its durable URL exactly matches
the reloaded page and is removed before application; a later manual refresh
cannot resurrect stale state. Recovery also retains an optional validated Changes
status (older payloads omit it). A selected Changes filter survives pending or
unavailable states and their completion rather than switching to All to reveal an
unchanged current preview. Explicit navigation still reveals its destination.

When an authored rebuild reparents an entry, the new manifest relationships
move its navigation row and ancestor crumbs in the same reload. Disclosure
recovery still applies to every unchanged stable collection id; removed ids and
obsolete label-path keys have no target and are ignored.

When a successful rebuild leaves the manifest structure unchanged, or a
resource edit or explicit watch rule requests a reload, the parent keeps the
ready child. It first publishes a typed update that clears stale route and
component evidence, making the successful content generation visible without
waiting on Git. The parent then computes one complete classification outside the
HTTP request path. A sequence token discards results superseded by a newer watch
action; the current successful result publishes a second typed update that
atomically replaces route membership, removed-entry baseline data, and component
evidence. Both tabs are present from startup: pending status shows a spinner in
the reserved count slot and, when selected, in the sidebar. An available empty list
shows zero; a failed or unavailable comparison ends loading and shows a dash plus an
unavailable sidebar. Every terminal status uses the same sequence/version checks as
the result, including background build and write failures. Initial watched startup follows the
same asynchronous classification rule after listener readiness, as does non-watched
Serve. Watched Serve polls resolved HEAD/base commits once per second outside HTTP;
Git resolves symbolic refs, worktrees and packed refs. A changed or newly available
ref clears evidence and reclassifies existing completed output without rerendering
views. Replacement and shutdown cancel old ref reads and discard stale results.

Watch actions execute serially. Changes received during an active action are
coalesced by impact before the next action starts, so two rebuilds cannot race
to replace generated output or restart the same child. The parent assigns a
monotonic integer update version to each child and asset reload. Every served
catalogue shell carries the update version captured when its request began. The client
seeds its page baseline from that stamp: an equal event-stream `ready` version
is a no-op, while a higher `ready` version or `update` event requests the current
shell snapshot. Equal content versions adopt evidence without navigation recovery;
a newer content version triggers reload and one-shot state recovery. A document without a valid stamp retains
compatibility behavior in which its first `ready` version establishes the
baseline.

In rich mode, the [terminal reporter](./mokly-terminal-output.md) presents the
existing accepted-catalogue, baseline, Changes, reference-refresh, rebuild,
reload, restart, configuration, and failure boundaries as lifecycle or change
lines. The presentation does not introduce another watch action. Candidate
paths accumulate across each coalesced burst and the completed line names up to
three. The `r` shortcut enqueues the same `rebuild` action through this serialized
queue, so it cannot race a filesystem-triggered action.

A filesystem edit composed of multiple operations can publish intermediate
states: removing a tracked alias may identify a deletion before its replacement
restores the baseline. A higher version proves a completed watch action, not
completion of every filesystem operation a caller groups into one edit. Tests
for a specific result must wait for both a higher version and that semantic
state within the existing deadline, distinguishing unavailable Changes from an
available zero count. They must retain subsequent-edit and comparison
invalidation assertions rather than assuming exactly one publication per edit.

Publishing an update without restarting the child marks its cached comparison
stale before notifying browsers. Both content reloads and evidence adoption restore Current, so comparison work
waits for another explicit diff selection. Concurrent comparison requests reuse
one regeneration and snapshots remain pinned to their immutable generation.

Shutdown first stops queued work, aborts active Git classification, and waits
for any active configuration transaction, then closes all final adopted
watchers, timers, child processes, HTTP servers, event streams, and ports. A
candidate watcher is discarded if shutdown begins before adoption: shutdown
interrupts an outstanding candidate readiness wait and closes that watcher
before the action queue finishes draining. No later child restart is started.
Tests must prove no orphan process remains after normal shutdown, failed
startup, or interruption. The child also
runs the same idempotent server close when its parent IPC channel disconnects,
so an abruptly terminated parent cannot leave a listening orphan. Parent-driven
shutdown first requests graceful IPC closure, then sends SIGTERM and SIGKILL at
bounded intervals when necessary; the supervisor does not finish closing until
the child exit notification arrives.

Each spawned child owns one readiness result, a terminal result registered from
creation, and one shared cleanup operation. Readiness timeout (300 seconds),
pre-ready errors, post-ready errors, IPC disconnection, explicit close, and
restart all use that operation. Startup reports its original failure only after
cleanup confirms the child has stopped. A ready message followed by failure
before startup resolves cannot report successful startup. Close cancels pending
readiness; later ready messages and updates are ignored. Concurrent close/restart
calls share cleanup, and a separate start while the child is still owned fails
without spawning.

The native handle observes IPC disconnection from creation and retains that
event for late subscribers. Disconnection while waiting for readiness or while
serving starts the same cleanup immediately, without waiting for another update.
It reports one unexpected failure only after successful startup, so the watched
action queue can recover on the retained port. Transport loss never confirms
process exit: even a disconnected child stays owned through bounded escalation
and actual terminal confirmation. A disconnection during intentional shutdown
or after exit does not create a failure or duplicate recovery. An earlier startup
error retains precedence over a later disconnect. Tests include a real HTTP
child that disconnects itself, ignores SIGTERM, and is force-killed before its
replacement resumes receiving updates on the same port.

Terminal observation remains available after exit, including a failed native
spawn that emits `close` without `exit`. Cleanup for an already-terminal child
does not signal it or wait for another event. A failed IPC shutdown request or
signal cannot release ownership or skip the next escalation stage. All timers
are cancelled on terminal confirmation. Tests cover these event orders with
controlled children and prove real server termination and port reuse after an
injected transport failure.

See [the catalogue runtime](./mokly-runtime.md) and [Changes](./mokly-changes.md).
