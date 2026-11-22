# Package Folder Reuse

These rules extend the
[reuse rules](./mokly-sidecar-recipes.md#reuse-and-identity) of compiled
recipes for each import that esbuild selects through a package folder mapping.
Each other import keeps the recipe rules alone, apart from the exceptions of
[metadata bounds](#metadata-bounds) and [PnP package roots](#pnp-package-roots).

## Folder Mappings

A folder mapping is a package `exports` or `imports` key without `*` that
ends in `/`. esbuild matches it as a prefix of the request. A bare `imports`
target starts a package lookup, and the candidates of the selection then start
inside the package that it selects.

## Marked Live Checks

For each such import, the directory membership of a marked compilation also
covers each folder in which esbuild can look for a candidate after the mapping
and before it finds the selected module. The compilation carries no marker
when the sidecar cannot place the selected module among these candidates,
cannot represent its checks, or cannot record them within its size bounds.
Decision of the performance orchestrator on 2026-11-19: these folders join the
live checks, so edit reuse stays fast while an earlier candidate that appears
ends the reuse. Withholding the marker for these imports was rejected, because
their compilations would lose edit reuse. An accepted gap, as for the
unreadable configuration chains of the recipe rules, was rejected, because
Serve could show a stale module until a restart.

For each such import, the recorded directory lists of a marked compilation,
which a later reuse compares with the disk, must certify the selected
module. The candidates of each target follow the order in which esbuild tries
them. An import whose kind must resolve to CSS uses the CSS extension order.
For any other import, a target whose written path has a `node_modules`
component uses the `node_modules` extension order. The main fields are the
effective ones, and a repeated key counts by its first property. A target
reaches the selected module only when one of its candidates equals the
module path as text or through its canonical path.

Each target that reaches the module must pass, also in each reachable PnP
root. A target passes when no candidate before the selected module matches a
name in the recorded directory list of the folder of that candidate. A
candidate matches a name when its last path component and the name are equal
after the lowercase fold of esbuild. That fold maps each code point alone to
its simple lowercase. A matching name is exempt only when the recorded checks
prove that esbuild cannot treat it as a file.

A dangling candidate link has
this proof through its link entry and the absent entry of its target in the
[private folder files](#private-folder-files). Neither the canonical target of
a resolving link nor an empty directory list proves alone that a path is a
folder. The compilation carries no marker when no target reaches the module,
when a needed directory list is missing, or when a reaching target fails.

Decision of the user on 2026-11-20: the recorded directory lists certify each
marked folder selection. A candidate that appears during or after the
compile cannot keep a stale module. A check that passes when any one reaching
target passes was rejected, because another reaching target can still select
an earlier candidate. Directory lists taken right after the compile and
invalidation by watch events were rejected, because each keeps a window for a
stale module.

## Private Folder Files

For each such import, the reuse evidence of a marked compilation records each
file that can change the selection: the manifest that defines the mapping, the
`package.json` candidate of each path that esbuild tries before the selection,
and each PnP state file that esbuild checks. Each entry records a present file
with its digest, an absent file, or a link with its target. The table holds no
directory entries, because directory membership stays in the live checks. A
marked compilation without such an import keeps an empty table, apart from
the exceptions of [PnP package roots](#pnp-package-roots). The evidence
keeps `complete` and `durable` false and the `uncaptured: "serveEdit"` marker.

A reuse check compares each entry with the filesystem by the rules of the
captured reuse evidence. The sidecar makes this check at a `serveEdit`
request. The binary makes it when it reuses a retained marked result. One
changed entry ends the reuse. When the sidecar drops the table to fit the
frame limit, the compilation carries no marker. These entries move no render
input key, are not watch inputs, and never reach the disk. Neither mode adds
them to the metadata digests. A `full` request keeps recording its folder
candidates in its own reuse evidence before resolution.
Decision of the performance orchestrator on 2026-11-19: folder files stay in
the private reuse evidence of a marked compilation, so render keys, published
identities, and Changes stay equal. Adding them to the metadata digests of
both modes was rejected, because a change of an inactive manifest or PnP state
would then change shared render keys. A new result field was rejected,
because it changes the wire format.

The table also records each link at a candidate path that esbuild tries
before the selection. The entry of a link that resolves records its canonical
target. The entry of a dangling link, whose real path fails, records its
lexical final target. That target is the first path in its chain of links
that is not a link, with each link target resolved as text against the folder
of its link. The table then also records that target as absent. A link entry
matches only a link at its path. When that link resolves, its canonical target
must equal the recorded target. When its real path fails, its lexical final
target must equal the recorded target, and the table must record that target
as absent. The sidecar and the binary apply this rule alike.
Decision of the performance orchestrator on 2026-11-20: the table pins a
dangling candidate link by its lexical final target, so the compilation keeps
the marker and edit reuse, and a change that lets esbuild select the candidate
ends the reuse. Withholding the marker for such a link was rejected, because
it removes working edit reuse.

## Metadata Bounds

The sidecar reads the package metadata of the importer's own package and of
installed, linked, and PnP packages within its existing metadata bounds: a
byte bound for each metadata file, a byte bound for all of them together, and
a depth bound of 32 nested levels for its walk of a package `imports` map.
That walk continues in the package map of the package that a bare target of
an `imports` folder mapping selects, so the depth bound also applies there.
When a bound stops it before it can tell whether an import selects through a
folder mapping, the `full` evidence is incomplete, and a `serveEdit`
compilation carries no marker. So a compilation loses edit reuse when such a
walk reaches the depth bound, also for an import that selects through no
folder mapping. This changes no compile result.
Decision of the performance orchestrator on 2026-11-19: correct output and
bounded memory outrank reuse at a bound. Reading past the bounds was rejected,
because edit reads would grow without limit.
Decision of the performance orchestrator on 2026-11-20: the depth bound
withholds the marker as the byte bounds do, because a walk that stops early
can hide a target that selects through a folder mapping. Correct output
and unchanged bounds outrank reuse in a layout that real catalogues almost
never have. A walk without the depth bound was rejected, because it changes a
bound for a rare case. A deferral was rejected, because Serve would keep a
stale module on this route.

## PnP Package Roots

In a PnP project, the `full` capture and the marked checks take the package
roots of a bare import from the PnP registry. Both keep only the reachable
roots. A root is reachable when its package reference, or an alias to it, is
the target of the requested name in the dependencies of a registry package
that contains a folder from which esbuild resolves the import, of the
top-level package, or of the fallback pool. These folders include each folder
from which the sidecar resolves the import again under the
[module source rules](./mokly-sidecar-modules.md#source-and-dependency-files).
For a resolve folder that the sidecar cannot cover, it keeps every root of the
name. Reachable roots overlap when the package maps of two or more of them can
place the same selected module. The folder mappings of each overlapping root
then add their checks. So an import that native resolution selects without a
folder mapping can carry these checks in both modes, and a change in those
folders ends its reuse.
Decision of the performance orchestrator on 2026-11-20: the `full` capture
and the marked checks keep the reachable roots, a sound superset that never
omits a real folder candidate, because reliability comes before speed. Exact
native ownership was rejected, because one wrong parity rule could drop a
real candidate and keep a stale module. Ownership from the native compile was
rejected, because the pinned esbuild interface does not expose it.

When the filter removes a root whose folder mapping matches the request, both
modes drop the folder checks of that root, but they keep their observation of
the PnP state file. A marked compilation then keeps that observation in its
private table, also for an import that selects through no folder mapping. A
change of the registry ends the reuse, and a change in a folder of the
removed root does not. The filter and this observation read no new file, add
no field and no bound, and add no process or native operation. They change
no compile result, no metadata digest, and no render key.
Decision of the performance orchestrator on 2026-11-20: the state-file
observation stays when the filter removes a matching root, because a
registry edit can make that root the native owner, and correct output comes
first. The filter alone was rejected, because a registry-only edit could then
keep a stale module.
