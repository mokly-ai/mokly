# Consumer PostCSS Contexts And Evidence

## Contexts

`processCss` runs consumer PostCSS in an owned child process with `sourceRoot` as its working directory.
The core selects `repositoryRoots` and `moduleResolution` for each context.
`sourcePath` is a logical repository or dependency path. The child resolves
it against `sourceRoot` or the selected dependency root before setting PostCSS
`from`. Request labels keep the logical path. Each context and module pair has
isolated plugin state. The core sends the same source root, repository roots,
and resolution settings in every request of one context. `disposeContext`
kills and reaps only that context's process. Bundle creation and generation
disposal do not reset a context that a `processCss` request used.
[Used Contexts](#used-contexts) defines when such a context ends.
CSS-only catalogues need no bundle. The result
contains transformed text, resolved packages, and plugin dependencies for watching.
Class-map changes and restored JavaScript generations follow the
[bundling contract](./mokly-sidecar.md#bundling). Expected PostCSS errors carry a typed
`postcss` failure in the error envelope. The core selects its exact code and text
from [stylesheet diagnostics](./mokly-imported-styles-errors.md).
Child startup errors, exit, IPC disconnection, and failed request writes settle
affected requests without waiting for the request deadline. Errors raised before
request attachment remain failures of that request. A failed child cannot accept
later work; a later request starts a new child for the context.
The core sends one request of a context at a time. An effective input whose
request failed fails again with the same diagnostic for the rest of its
context, without another request. When a request times out or its child exits
on both attempts, every request of that context that already waits for its
turn fails with the same diagnostic. A request that arrives later starts a new
child. Decision: a failure stays with its input and reaches the waiting
requests, so a hung plugin delays a failed preparation by one deadline pair.
Failing every later request of the context after a timeout was rejected,
because one transient fault would then fail every new stylesheet of a live
generation until the next rebuild.
When a PostCSS request reaches its deadline, the timeout diagnostic includes
deterministic timings for child spawn, configuration load, plugin construction,
and the latest stylesheet run. Each phase reports its elapsed milliseconds or
its running state. A running timeout also names the last module URL observed by
the child. The diagnostic does not include authored CSS text.

## Prepared Contexts

A `bundle` request can carry an optional PostCSS `preparation`. It names one
`context` and its `postcss` module. The prepared child takes the source root,
repository roots, and resolution settings of the `bundle` request. They equal
those of the later `processCss` requests of that context. Like
[`capture`](./mokly-sidecar-recipes.md#capture-modes), the preparation is a
request-only value and not a bundle setting. No settings comparison,
compilation identity, generation id, recipe, `restoreGeneration` request, or
bundle cache entry contains it. A preparation changes neither the `capture`
value of its request nor the reuse evidence that the request records.
Decision: the preparation stays outside the bundle settings. A preparation
inside them was rejected, because each preparation names a new context, so no
recipe, cache entry, or generation id would match an earlier one.

An attempt is one head graph preparation of Serve, in either
[capture mode](./mokly-sidecar-recipes.md#capture-modes). A startup attempt is
an attempt that starts before Serve publishes its first state. Every other
attempt is a later attempt. The core adds a preparation only for the context
of an attempt. The configuration must name a PostCSS module. The head of a
later attempt must also keep a PostCSS stylesheet bundle that the attempt
cannot reuse under the
[dependency retention rules](./mokly-imported-styles-postcss.md#dependency-retention).
A startup attempt needs no such bundle. Only one `bundle` request of the
attempt carries the preparation, and only when no `processCss` request of the
context came before it. No older used head context of the same configuration
may still be live under the [used context rules](#used-contexts). A catalogue
without PostCSS, the base side, `build`, `publish`, and a return warm-up
prepare no context. A context without a preparation starts its child at its
first `processCss` request.
Decision: a later attempt prepares a context only when its head keeps a stale
PostCSS stylesheet bundle. A preparation in every later attempt was rejected,
because an attempt whose stylesheets all stay reusable would start a child
that no request uses. A startup attempt needs no stale bundle, because a new
process starts with no kept stylesheet bundle. A startup check for a
PostCSS stylesheet root was rejected, because the module graph that names the
roots comes with the `bundle` result. So a startup attempt whose stylesheets
need no `processCss` request starts a child that ends unused with its attempt.
Decision: an attempt prepares no context while an older used head context of
its configuration stays live. A preparation beside that context was rejected,
because the attempt would then hold two children during its bundle.

For a `bundle` request with a preparation, the pool first sends a
`prepareContext` request to the sidecar of the `bundle` request. It carries the
preparation, source root, repository roots, and resolution settings. It comes
before the bundle cache read and any seed, so a new sidecar receives it directly
after `hello`. The sidecar starts the preparation then and answers at once. A
`bundle` request starts the preparation only when no earlier request did. The
prepared child loads the PostCSS module and constructs its plugins. It processes
no stylesheet before the first `processCss` request of its context. Neither
request waits for that load. A preparation failure never changes the result or
the error of the `bundle` request.
Decision: the child starts before the bundle cache read and runs no stylesheet
early. Processing the stylesheet roots during the bundle was rejected, because
it needs speculative roots and later evidence checks. A start at the `bundle`
request was rejected, because the child then starts after the bundle cache read.

A prepared context gives each `processCss` request the text, dependencies,
read evidence, and failure that a context without preparation gives. Its read
evidence includes the reads of its configuration load. A configuration that
fails to load fails the first `processCss` request of the context with its
typed `postcss` failure. Preparation changes no published byte. It changes no
deadline, retry, or failure rule of this page, and it moves or reorders no
`processCss` request.

When a prepared child fails or exits before the first `processCss` request of
its context, that request fails with the failure of the child. The sidecar
starts no replacement child for that request. Later requests of the context
follow the failed-child rule in [Contexts](#contexts).
Decision: the first request receives the failure of its prepared child. A
silent replacement child was rejected, because it could hide a failure that a
child started by the request reports.

Each attempt prepares a new context. The child loads the consumer modules only
after its attempt starts, in the fresh isolated module context of the
[PostCSS module rules](./mokly-imported-styles-postcss.md#postcss-module). No
module, plugin instance, or plugin state passes to another context or attempt.
A newer attempt never uses the prepared context of an older attempt. A change
to the PostCSS module, a plugin, a dependency, or the toolchain reaches each
later attempt as it does without preparation.
Decision: every attempt loads the consumer modules again. Processors or module
instances kept across edits were rejected, because Tailwind keeps removed
candidates in module-level state. A load before the edit also cannot prove
that opaque native load-time inputs stayed unchanged.

No process keeps a stylesheet bundle or a PostCSS result for a later process.
So the startup attempt of each Serve process processes every stylesheet root
that it needs from the current inputs.
Decision: stylesheet processing results stay inside their process. A store
for later processes was rejected, because no result has complete and stable
evidence, so a later process cannot check every input of a result. Reuse under
an age limit and reuse that compiles again after readiness were rejected,
because stale styles or wrong Changes could then reach the user.

A prepared context is live from its `prepareContext` request. The
[source root workers](./mokly-sidecar-modules.md#source-root-workers) place it.
It is unused until its first `processCss` request. The core releases an unused
prepared context at once when its `bundle` request fails, when its attempt is
cancelled, or when a newer attempt replaces its attempt. An unused prepared
context also ends when its attempt ends, also when the attempt succeeds and
its graph stays retained. A used context follows the
[used context rules](#used-contexts). When a release comes before the child starts, the
preparation starts no child. A later `processCss` request of a released context
starts a new child. A prepared child counts toward its sidecar under the
[memory sampling rules](./mokly-sidecar-memory.md#sampling-and-recycling).
Decision: an unused prepared context ends with its attempt. The lifetime of the
retained graph was rejected, because the unused child would then stay idle
after its edit.

## Used Contexts

A used context is a context that a `processCss` request used. In Serve, each
head graph preparation, at startup or after an edit, uses its own context. That
context ends when its graph preparation succeeds, if the graph kept every
stylesheet bundle that it compiled or reused. The graph keeps these bundles
under the existing 64 MiB stylesheet cache bound and keeps no bundle beyond it.
A later request of the graph receives its unchanged kept bundle before any
compile, also after the
[render cache](./mokly-runtime.md#render-graph-and-cache) drops its bytes. So
the end changes no published byte, dependency, read evidence, or failure. It
changes only when the child process ends.

When that bound drops a kept bundle or refuses an oversize bundle, the context
stays live until the final graph or request that holds it releases it. Every
other used context keeps the same graph lifetime. This covers the base side,
`build`, `publish`, other commands, and a failed or cancelled graph
preparation. So when each graph preparation succeeds and keeps its bundles, a
Serve head holds no PostCSS child while it waits for a change, and at most one
while it rebuilds.

Decision: a used head context ends with its graph preparation when no later
request can reach it. The lifetime of the retained graph was rejected, because
the next graph preparation would then hold the idle old child beside its new
child. An end without the kept-bundle condition was rejected, because a compile
after the bound drops a bundle needs the plugin state of the old context, and a
new child can give other bytes.

## Read Evidence

Each result returns `readEvidence` separately from its dependency declarations.
Its coverage is always `incomplete`. Its `reads` contain `whole-file` and `byte-range` records,
with the absolute child-side path and the SHA-256 digest of the raw delivered
bytes. Its `modules` identify known module inputs, including files without
an observed read. A declaration or a module path alone is not a read witness.
Runtime builtins use runtime identity and have no invented file digest.
Each byte range retains its offset, delivered length, and any observed end of file.
Never compare a range digest with a whole-file digest or infer unread bytes.
When available, each witness retains the native identity of the descriptor
that supplied its bytes. Keep a resolved name only when its metadata matches
that open descriptor. Equal bytes cannot hide a changed target.

A digest covers the raw bytes before BOM handling and text decoding.
Observation preserves the encodings, errors, cancellation, and return values
of the observed reads. It does not raise the supported Node minimum.

A result returns its observations with the transformed CSS. It keeps every
distinct witnessed version of the current generation, including configuration
reads of earlier stylesheet requests in that generation. A new generation
drops the witnesses of earlier generations. A reused result keeps its
witnesses, also after its worker is replaced or disposed. Conflicting versions
use the static build's [input-change outcome](./mokly-export.md).

The core keeps each observed read that maps through the side's source root or
selected dependency roots, including a read that no plugin declares as a
dependency. It retains the read as private stylesheet evidence. A read alone
does not add a file to the catalogue source inventory or to plugin public-file
protection. Known readable inputs retain an explicitly late digest beside their
witnesses. A late digest cannot overwrite an observed digest. A byte-range
witness keeps its range and is checked against that late whole-file baseline
without claiming an observed whole-file read.

The core maps module evidence through the selected source and dependency roots
for each side. Base source witnesses compare with the pinned Git bytes. They
never use a head source baseline. Module evidence does not add installed
packages to the catalogue or to plugin public-file protection. Unread
declarations and directory matches remain declarations, not read records.

Read evidence counts toward the 64 MiB PostCSS and stylesheet cache bounds and
the frame bound. The stylesheet cache keeps one copy of a context's private
evidence for all bundles of that context and counts it once.

## Incomplete Coverage

Native addons, helper processes, and uninstrumented workers remain compatible.
Their reads can escape observation, even when they report a dependency
correctly. A read that Mokly cannot observe keeps its native behavior and gets
no guessed or invented witness. Known inputs retain their late opaque
baseline, which detects only edits after capture. One JavaScript read does not
prove that an opaque reader used the same bytes. No file, plugin, or context
becomes complete because a witness exists.

File modules supplied by consumer module hooks retain their resolved paths,
including when a hook supplies a module without delegating. Their bytes remain
opaque without raw provenance. Modules that Node loads in its asynchronous
loader thread, such as the modules that define asynchronous hooks, have no
module path. They have no late baseline unless another input report names
their paths. Decision: Mokly observes module paths only on the main thread. A
loader-thread observer was rejected, because main-thread observation already
reports every module that PostCSS code loads, and a loader-thread observer adds
work to each module resolution.

Decision: Mokly keeps native plugins compatible. It records a read witness
only for the reads that it observes, and it reports its coverage as
`incomplete`. Enforced immutable inputs were rejected because they need a
separate isolation and input-domain contract.

## Related Docs

- [Sidecar transport and lifecycle](./mokly-sidecar.md).
- [Static build fingerprints](./mokly-export.md).
