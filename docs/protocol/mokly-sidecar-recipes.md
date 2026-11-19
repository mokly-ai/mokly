# Compiled Recipes And Release

These rules belong to the `bundle` and `restoreGeneration` requests of the
[render sidecar](./mokly-sidecar.md), under the
[module source rules](./mokly-sidecar-modules.md).

## Compiled Recipe

Every private `bundle` result carries `compiled`: code, runtime import key,
captured entry text, resolved peers, physical input digests, logical metadata
digests, reuse evidence, the toolchain identity, and the compilation identity.
`restoreGeneration` installs that recipe with its original parameters, module
graph, and evaluated generation id. The bundle result carries the graph once. It
reads no current source file and invokes no compiler. Peer packages retain the
selected physical installation. Failed peer resolutions remain explicit and
raise `MODULE_NOT_FOUND`; native fallback cannot bypass that failure. Equal
compilations keep independent maps, bindings, and authoring registrations. A
`restoreGeneration` envelope above the [frame limit](./mokly-sidecar.md) fails
with `bundle-failed` before the sidecar installs anything.

## Capture Modes

A `bundle` request carries the optional request-only `capture` value: `full`,
the default, or `serveEdit`. The value is not a bundle setting. The sidecar
removes it before it compares settings, computes the compilation identity,
restores a recipe, or checks the recipe size. A `full` request records the
reuse evidence of the next section. A `serveEdit` request records no reuse
evidence and no capture witnesses. Every request still records the consumed
source digests, the module graph, the metadata digests, the directory lists,
and the preview selection.

Serve switches its head to `serveEdit` after it publishes its first state,
before it reports readiness. Each head preparation that starts after the
switch sends `serveEdit` in each `bundle` request. Earlier head
preparations, the base side of Serve, `build`, and `publish` send `full`.

A `serveEdit` compilation with a known toolchain identity carries the marker
`uncaptured: "serveEdit"` in its reuse evidence, with `complete` and `durable`
false and no inputs, unless a rule below withholds it. Only this marker marks
a deliberate omission. Evidence that is incomplete for any other reason
carries no marker, also evidence that the sidecar drops to fit the frame
limit. A compilation without a toolchain identity carries no marker.

The marker stays off when an authored absolute import specifier matches a
TypeScript `paths` key, or when the sidecar cannot tell whether it matches. An
authored specifier is one that a catalogue module writes. The imports of the
[virtual entry](./mokly-sidecar-modules.md#source-and-dependency-files) are
not authored. The marker also stays off when the sidecar cannot represent the
[live checks of a mapped authored bare import](#reuse-and-identity). A
`serveEdit` compilation without the marker is never reused.
Decision: a matching authored absolute specifier withholds the marker, so a
later request compiles again instead of reusing a stale `paths` selection. A
capture of the mapped targets in the `serveEdit` mode was rejected, because it
adds capture reads to each such edit compile.

Decision: a Serve edit compile captures nothing and stores nothing. This
removes the capture cost from every edit without new cancellation or
scheduling rules, and restarts keep the base hit and the hit of an unchanged
head. A capture at each graceful stop was rejected, because it delays every
graceful stop and gives nothing on a forced stop. Capture on every edit was
rejected, because it keeps that cost on every edit.

## Reuse And Identity

A compilation is reused only while its inputs stay unchanged. These inputs
include the ancestor `package.json` and `tsconfig.json` candidates of each
consumed module up to its source or selected dependency root, the resolved
`react/package.json`, and the Storybook preview candidates, each including
absent files. Added or removed files in a consumed-module directory invalidate
reuse, so a higher-priority module in that directory cannot remain hidden.
Manual `r` uses these same input checks. Resolution metadata and directory
membership remain observable. CSS bytes belong to stylesheet processing rather
than the JavaScript compilation.

Reuse of a captured compilation also requires an equal toolchain identity and
unchanged reuse evidence. The toolchain identity digests the Mokly, esbuild, and
Node versions, every file in the `dist/` directory of the Mokly package that
runs the sidecar, and the real root of that package. The reuse evidence records
each file and directory that can change how a bundled import or a peer resolves:

- the `jsconfig.json` candidate beside each `tsconfig.json` candidate, and
  each file that a tsconfig `extends` chain names;
- the package manifest of each resolved peer;
- each directory where the resolver can look for a candidate before it finds
  its result: relative paths with their extensions and index files, `paths`
  targets, `baseUrl`, each `node_modules` level, and each configured lookup
  root;
- the `package.json`, `tsconfig.json`, and `jsconfig.json` candidates above
  the source root, each up to the first present candidate or the filesystem
  root.

A recorded directory keeps every entry, the kind of each entry, and the real
target of each link. An absent file or directory is recorded as absent. A
candidate that cannot be read never matches a recorded absence. When the sidecar
cannot record the evidence of an import completely in a `full` request, the
compilation is never reused and never stored. When the binary reuses a bundle
result without a `bundle` request, it checks the same evidence. Reuse evidence
moves no render input key and is not a watch input. The compilation identity
includes the toolchain identity, the content of the recorded `jsconfig.json` and
`extends` files, the real path and the manifest content of each resolved peer,
and the content of each present `tsconfig.json` and `package.json` candidate
above the source root. So a change to one of them gives a new generation id. The
other reuse evidence stays out of the identity. An incomplete compilation,
marked or not, gets a fresh identity at each compile, also when the sidecar
drops its evidence to fit the frame limit. The binary then never reuses the
definitions of an earlier generation for it. A complete compilation keeps a
deterministic identity.
Decision: a reuse check compares recorded digests, directory entries, and link
targets with the filesystem, so it copies no resolver rule. A second resolve
with esbuild was rejected, because it runs an esbuild operation on each reuse.
Package-manager install state files were rejected, because a manual link change
keeps them.

A marked compilation is reused only by a `serveEdit` request. Its reuse
checks are the live checks alone: equal settings, equal resolved roots, an
equal toolchain identity, and the unchanged inputs and directory membership
of the first paragraph of this section. Its reuse evidence needs `complete`
and `durable` false and no recorded entries, and the compilation needs a
known toolchain identity. A `full` request never reuses a marked compilation.
A `serveEdit` request tries every captured compilation before a marked one.
At a `bundle` request, the sidecar compares the toolchain identity of each
candidate with its own. The binary keeps these rules when it reuses a
retained marked result without a `bundle` request, with one difference: it
checks only that the toolchain identity is not empty, because each retained
result comes from a sidecar of the same binary process.
Decision: a deliberate Serve edit omission keeps the live reuse checks. The
rule that no incomplete compilation is reused was rejected, because a
CSS-only or YAML-only rebuild after a JavaScript edit would then compile the
JavaScript again. Only stored entries need the full reuse evidence.

The directory membership of a marked compilation also covers the folders in
which esbuild looks for the `paths` targets of each authored bare import, up
to the selected target. When the import falls back to a package lookup, it
covers every target and the `baseUrl` candidate. When an alias gives the
import an absolute target, esbuild falls back to that written path, and the
checks cover every target. Its resolution metadata also covers the
`package.json` candidate of each target or `baseUrl` path that esbuild tries
before the selection. This holds only when the sidecar can read the
configuration chain that defines the mapping and its base folder. When the
sidecar can read the mapping but cannot place the selected module among these
candidates, in a package, or at the written path of an absolute alias target,
or cannot record these paths within its size bounds, the compilation carries
no marker. When the sidecar cannot read the
whole configuration chain, such as a chain with a package `extends`, no
`paths` or `baseUrl` of that chain adds anything, local or inherited, and the
compilation keeps its marker. A file that then appears at an earlier target of
such a mapping can keep the old module until another live input changes.
Decision: these folders join the live checks, so edit reuse stays fast while
an earlier target that appears ends the reuse. Withholding the marker for each
mapped bare import, or by target count, was rejected, because it removes
common edit reuse, and a single target can fall back to a package lookup.
Withholding it for configuration chains that the sidecar cannot read was
rejected, because it removes edit reuse from common package-extends
catalogues, such as `expo/tsconfig.base`.

## Released Recipes

Each `bundle` call starts an unevaluated lifetime, also when the content id
matches an earlier evaluated lifetime. The core installs its maps,
description, and bindings before rendering. Releasing a generation or a
PostCSS context reaches every process that used it and starts no sidecar.

After the final graph or request releases a captured compilation or a marked
one, the pool keeps its recipe in memory for later `bundle` calls. The pool
keeps at most one released recipe for each set of bundle settings: the last one
released. The pool compares settings without the evaluation digest. A later
`bundle` call can reuse that recipe. Equal settings, equal resolved roots, and
the input rules above are the only reuse checks, for released, stored, and live
compilations alike.

The pool counts each released recipe at the size of its serialized
`restoreGeneration` envelope. The released recipes of one pool use at most 64
MiB in total, the value of the frame limit. A release of an unmarked incomplete
recipe or of a recipe above that bound removes the older released recipe of
equal settings and keeps nothing. When a new recipe takes the total above the
bound, the pool removes the least recently used recipes until the total fits.
The pool discards every released recipe when it stops: on shutdown,
cancellation, and forced termination. A release after the stop keeps nothing.

Decision: the pool keeps the last released recipe of each set of bundle
settings, in practice one head and one base recipe. The bound equals the
frame limit, so every recipe that a sidecar can restore fits. In a measured
Serve session with two edits and two reverts, this served all 6 of 10
bundles that repeated an earlier compile, with about 6.4 MiB of recipes.
Stores of many recipes within 16, 32, or 64 MiB were rejected. A `bundle`
call restores only one released recipe of its settings, so older recipes
would hold memory and never serve a bundle. A 128 MiB bound was rejected,
because it differs from 64 MiB only for a recipe above 32 MiB.

## Bundle Cache Seeding

The binary also keeps the latest compilation that it served in the `full` mode
for each set of bundle settings in the
[bundle cache](./mokly-base-cache.md#bundle-entries), so a later process can
reuse it. A `full` request takes only a captured live or released seed. A
`serveEdit` request also takes a marked seed, after every captured one.
Without such a seed, the pool installs the stored compilation with
`restoreGeneration` before the request. The reuse check then accepts it, or the
sidecar compiles. A replay still restores a live incomplete generation. In
the `full` mode, the binary stores each served compilation with complete and
[stable](./mokly-base-cache.md#stable-capture) evidence that the bundle cache
lacks, also one served from memory. A failed bundle stores nothing. A Serve
head preparation in the `serveEdit` mode offers nothing to the bundle cache,
also for a retained state that the binary serves without a `bundle` request.
A marked compilation never reaches the disk.
Decision: a stored compilation reaches a sidecar only through
`restoreGeneration` and the reuse check. A check of the stored compilation in
the binary was rejected, because it needs new pool methods and the toolchain
identity in the binary. A sidecar that reads and writes the cache was rejected,
because the sidecar performs no file writes.

## Serve Edit Plans

The [Serve edit plan rules](./mokly-sidecar-plans.md) define the resolution
plan of a captured compile, its bounds, its use by a `serveEdit` request, and
its use after a warm start.

## Operation Events

A worker emits an `operation` event for each catalogue `esbuild` call and each
PostCSS worker start or stop. The payload contains the operation and sidecar
PID. The core uses these events for exact counts, including failed calls.
They carry no source, CSS, props, or file paths.
