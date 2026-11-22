# Released Recipes

These rules extend the [compiled recipe rules](./mokly-sidecar-recipes.md) of
the [render sidecar](./mokly-sidecar.md).

Each `bundle` call starts an unevaluated lifetime, also when the content id
matches an earlier evaluated lifetime. The core installs its maps,
description, and bindings before rendering. Releasing a generation or a
PostCSS context reaches every process that used it and starts no sidecar.

After the final graph or request releases a captured compilation or a marked
one, the pool keeps its recipe in memory for later `bundle` calls. The pool
keeps at most one released recipe for each set of bundle settings: the last one
released. The pool compares settings without the evaluation digest. A later
`bundle` call can reuse that recipe. Equal settings, equal resolved roots, and
the [input rules](./mokly-sidecar-recipes.md#reuse-and-identity) are the only
reuse checks, for released, stored, and live compilations alike.

Before a `bundle` request, the pool sends no released recipe that the current
files already rule out. For each source whose recorded digest differs between
the released recipe and the newest live compilation of equal settings, the pool
reads the current content once and compares it with the released recipe. One
difference rules the recipe out. A source that both record with the same
digest, and a source that is missing or cannot be read, rule nothing out. So
the pool sends the released recipe as before. Without a live compilation of
equal settings, the pool also sends it as before. A recipe that is ruled out
changes no result, no event, no timing field except durations, and no order of
the released recipes, and the `cache` value stays `stamp-mismatch`.
Decision: the pool rules out a released recipe before it sends it. A send
before each request was rejected, because each warm forward edit of mokly-cloud
then transferred 5.96 MB for a reuse check that had to fail, about 50 to 75 ms
before the compile. A rule from the changed paths of the watch action was
rejected, because those paths do not reach the build and need a mapping to real
paths.

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
