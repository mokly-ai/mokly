# Baseline Compatibility

## Delivery Status

Implemented as recorded in the
[id-derived routes plan](../../plans/id-derived-routes.md).

This contract owns the version gate between a current catalogue and the Git
comparison base used by Serve, export, and publication. Baseline storage and
rebuilding are defined by [Derived Baselines](./mokly-derived-baselines.md).

## Compatible Baseline

A comparison base is compatible only when its output contains the canonical
`mokly-generated/mokly-manifest.json` and that manifest is a valid schema-v8 manifest. The
historical boundary applies the same v8 shape, relationship, path, and source
inventory validation as the current manifest reader. It reads baseline bytes
but never executes baseline source through the current Mokly package.

The boundary does not translate earlier schemas. Every accepted entry and
artifact already has the identity-derived layout in
the [artifact path contract](./mokly-artifact-paths.md).

## Incompatible Earlier Baseline

A canonical manifest with an integer `schemaVersion` below `8` is incompatible
earlier output. A base that has no canonical manifest but contains
`mokabook-manifest.json` or `mockbook-manifest.json` is also incompatible;
those names are sentinels for earlier output, not fallback inputs. Mokly does
not parse their contents.

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

## Invalid Or Missing Data

The graceful branch above is only for recognized earlier output. An integer
`schemaVersion` above `8` is an unsupported newer baseline and follows the
invalid-baseline path. Invalid JSON, a non-object root, a missing or non-integer
version, or a schema-v8 file that fails validation follows the same path.
Absence of every recognized manifest selects a rebuild with that commit's own recipe under the [manifest selection contract](./mokly-generated-manifest.md#selection-cache-and-resource-addressing). None of these cases
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

Coverage must prove that a valid v8 base compares normally and that a lower
version or incompatible sentinel produces the command outcomes and single line
above. A newer-version base must make Serve report Changes unavailable with its
normal safe diagnostic and make explicit capture fail. Malformed v8, missing
history, current-manifest failure, output cleanup, and rollback remain separate
cases. The [v8 gate](./mokly-generated-manifest.md) defines committed-envelope
rejection before rebuild, rejection after the base's own build, old-cache
compatibility probes, and moved-root v8 inventory verification.
