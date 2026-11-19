# Package Folder Reuse

These rules extend the
[reuse rules](./mokly-sidecar-recipes.md#reuse-and-identity) of compiled
recipes for each import that esbuild selects through a package folder mapping.
Each other import keeps the recipe rules alone.

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

## Private Folder Files

For each such import, the reuse evidence of a marked compilation records each
file that can change the selection: the manifest that defines the mapping, the
`package.json` candidate of each path that esbuild tries before the selection,
and each PnP state file that esbuild checks. Each entry records a present file
with its digest, an absent file, or a link with its target. The table holds no
directory entries, because directory membership stays in the live checks. A
marked compilation without such an import keeps an empty table. The evidence
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

## Metadata Bounds

The sidecar reads the package metadata of the importer's own package and of
installed, linked, and PnP packages within its existing metadata bounds. When
these bounds stop it before it can tell whether an import selects through a
folder mapping, the `full` evidence is incomplete, and a `serveEdit`
compilation carries no marker. This changes no compile result.
Decision of the performance orchestrator on 2026-11-19: correct output and
bounded memory outrank reuse at a bound. Reading past the bounds was rejected,
because edit reads would grow without limit.
