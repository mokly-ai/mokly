# Baseline Compatibility

## Delivery Status

Identity-derived panes are implemented. Historical metadata normalization and
the older-layout availability guard follow the
[source-path removal plan](../../plans/remove-source-path-evidence.md).

This contract owns the version gate between a current catalogue and the Git
comparison base used by Serve, export, and publication. Baseline storage and
rebuilding are defined by [Derived Baselines](./mokly-derived-baselines.md).

## Compatible Baseline

A comparison base contains current manifest v8 or supported historical metadata
from v3 to v7. Read `mokly-manifest.json` first; if it is absent, try
`mokabook-manifest.json`, then `mockbook-manifest.json`. Normalize historical
metadata to v8: strip the removed path fields, drop collection records, flatten
earlier component variants, and preserve the private source inventory. The
boundary never executes baseline source through the current Mokly package.

After metadata validation, every stored v3–v6 entry route and light/dark view
path must equal its identity-derived path from the
[artifact path contract](./mokly-artifact-paths.md). Compare component variant
paths against their normalized global ids. Collection routes are irrelevant
because collections are not output entries. Absent old path fields mean the
normalized identity-derived shape. A supplied fragment map must contain both
mobile and desktop paths. Unsafe paths or malformed maps remain invalid data.

Keep main's pane contract: snapshot addresses derive from identity, and captured
HTML bytes stay unchanged. Do not rewrite old relative URLs, move resources to
simulate an older origin, add origin fields, or invent missing pane documents.
Compatible metadata does not make a missing or invalid required document valid.

## Incompatible Earlier Baseline

A manifest with an integer `schemaVersion` below `3` is incompatible earlier
output. Supported v3–v6 metadata with a safe stored route or view path that
differs from the identity-derived layout is also incompatible. This includes
nested folders and the former component-variant directory layout, even when
copies happen to exist at current paths. A former filename alone is not an
incompatibility signal: supported contents in that file can compare normally.

An incompatible base is an expected comparison-availability outcome, not a
current-build failure:

| Command                     | Required result                                                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Serve                       | Keep All usable, publish `changesStatus: "unavailable"`, expose no changed or removed entries, and provide no comparison or previous-version data. |
| `mokly export`              | Complete successfully with `changesStatus: "unavailable"`, delivery `comparisonUrl: null`, and no comparison generation or historical files.       |
| Publication with Changes    | Complete successfully with the same unavailable state and current-only files.                                                                      |
| Publication without Changes | Keep its existing `disabled` state and perform no baseline work.                                                                                   |

Serve, export, and Changes-enabled publication each print this exact line once
when they reject the selected base:

```text
Changes are unavailable because the comparison base was built with an earlier version of Mokly. Changes will return once the base includes this version.
```

The line is product copy. It does not include schema numbers, filenames,
validation types, or internal error names. Watched Serve does not repeat it for
content generations that retain the same incompatible base. A later ref update
to a compatible base follows the normal preparing/pending/ready lifecycle and
restores Changes without restarting Serve.

Derived rebuilding may cache a recognized incompatible layout as completed
output, retaining its original manifest version. Reuse does not rerun trusted
commands. The comparison reader applies the same availability guard on every
read. No historical resource closure or ownership attribution runs for that base.

## Invalid Or Missing Data

The graceful branch above is only for recognized earlier output. An integer
`schemaVersion` above `8` is an unsupported newer baseline and follows the
invalid-baseline path. Invalid JSON, a non-object root, a missing or non-integer
version, or admitted metadata that fails validation follows the same path.
Absence of every recognized manifest is missing history. None of these cases
falls back or becomes a successful empty comparison.

This includes a baseline document that cannot prove its recorded component
ranges. Comments with the former marker spelling are ordinary content, so they
cannot prove those ranges. This is invalid data, not an earlier-layout outcome.

Serve reports invalid or missing history as Changes unavailable and logs its
normal safe diagnostic. A command that explicitly captures Changes fails under
its existing transactional rules unless the failure is the incompatible case
defined above. Current output validation remains fatal for every command.

## Output Ownership Is Independent

Rejecting an earlier comparison base does not weaken generated-output
ownership. A current build still inventories owned files, reports pending
orphans in Check, and removes proven old generated files transactionally in
Build. Static export replacement likewise removes files owned only by the
previous artifact. These operations inspect current ownership metadata and the
installed output; they do not parse or convert an incompatible baseline.

## Verification

Coverage must prove that v8 and normalized identity-layout v3–v7 data can
compare, including supported former filenames. Nested entry routes, either
viewport or scheme, and former component-variant paths produce the unavailable
outcome before resource reads. Test watched and unwatched Serve, export,
publication, and derived cache reuse. Unsupported newer data, malformed maps,
unsafe paths, missing history, current-manifest failure, output cleanup and
rollback keep their separate diagnostics. Derived mode builds the base with
that commit's tooling before this gate; committed mode reads Git blobs directly.
