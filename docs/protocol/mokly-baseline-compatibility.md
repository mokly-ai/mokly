# Baseline Compatibility

## Delivery Status

Current and historical readers accept manifest v9. Earlier baselines use the
established Changes-unavailable outcome without conversion.

This contract owns the version gate between a current catalogue and the Git
comparison base used by Serve, export, and publication. Baseline storage and
rebuilding are defined by [Derived Baselines](./mokly-derived-baselines.md).

## Compatible Baseline

A comparison base is compatible only when its output contains the canonical
`mokly-generated/mokly-manifest.json` and that manifest is a valid schema-v9 manifest. The
historical boundary applies the same v9 shape, relationship, path, and source
inventory validation as the current manifest reader. It reads baseline bytes
but never executes baseline source through the current Mokly package.

The boundary does not translate earlier schemas. Every accepted entry and
artifact already has the path-derived layout in the
[artifact path contract](./mokly-artifact-paths.md), and the
[move contract](./mokly-moves.md) pairs its entries with the current ones.

## Incompatible Earlier Baseline

At the selected generated location, a canonical manifest with an integer
`schemaVersion` below `9` is incompatible earlier output. A committed
root-level manifest does not decide selection: a missing generated manifest
selects a rebuild. After that build, canonical root-level output below v9
produces this same outcome without a flat-layout reader or cache entry.
Only `mokly-manifest.json` is recognized. Former manifest names do not prove
incompatibility. If the selected canonical generated manifest is absent, use
the normal absence/rebuild path regardless of those other files.

An incompatible base is an expected comparison-availability outcome, not a
current-build failure:

| Command                     | Required result                                                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Serve                       | Keep All usable, publish `changesStatus: "unavailable"`, expose no changed or removed entries, and provide no comparison or previous-version data. |
| `mokly export`              | Complete successfully with `changesStatus: "unavailable"`, delivery `comparisonUrl: null`, and no comparison generation or historical files.       |
| Publication with Changes    | Complete successfully with the same unavailable state and current-only files.                                                                      |
| Publication without Changes | Keep its existing `disabled` state and perform no baseline work.                                                                                   |

Build and Check validate current output without reading the comparison base.
An incompatible base does not change their result.

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

## Invalid Or Missing Data

The graceful branch above is only for recognized earlier output. An integer
`schemaVersion` above `9` is an unsupported newer baseline and follows the
invalid-baseline path. Invalid JSON, a non-object root, a missing or non-integer
version, or a schema-v9 file that fails validation follows the same path.
A current manifest with missing required root ranges or stylesheet provenance,
stored CSS owner records, removed fields or stored artifact paths is invalid.
A document that cannot prove its recorded component ranges is invalid data.
Absence of the canonical generated manifest at the requested root selects a rebuild with that commit's own recipe under the [manifest selection contract](./mokly-generated-manifest.md#selection-cache-and-resource-addressing). None of these cases
falls back or becomes a successful empty comparison.

Serve reports invalid or missing history as Changes unavailable and logs its
normal safe diagnostic. A command that explicitly captures Changes fails under
its existing transactional rules unless the failure is the incompatible case
defined above. Current output validation remains fatal for every command.

## Output Ownership Is Independent

Rejecting an earlier comparison base does not weaken generated-output
ownership. A current build inventories the whole generated tree. Tracked Check reports
missing, stale and extra files; Build replaces the tree transactionally. Static export replacement likewise removes files owned only by the
previous artifact. These operations inspect current ownership metadata and the
installed output; they do not parse or convert an incompatible baseline.

## Verification

Coverage must prove that a valid v9 base compares normally and that a lower
version in the selected generated location or rebuilt root-level output produces the command outcomes and single line
above. A newer-version base must make Serve report Changes unavailable with its
normal safe diagnostic and make explicit capture fail. Malformed v9, missing
history, current-manifest failure, output cleanup, and rollback remain separate
cases. The [v9 gate](./mokly-generated-manifest.md) defines committed-envelope
selection from the generated subtree, rejection after the base's own build,
partial-cache rebuilding, and moved-root v9 inventory verification.
