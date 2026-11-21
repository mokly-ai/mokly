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
