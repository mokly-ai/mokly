# Baseline Compatibility

## Delivery Status

Approved contract. The gate currently accepts manifest v7; the
[path identity plan](../../plans/path-identity.md) moves it to v8.

This contract owns the version gate between a current catalogue and the Git
comparison base used by Serve, export, and publication. Baseline storage and
rebuilding are defined by [Derived Baselines](./mokly-derived-baselines.md).

## Compatible Baseline

A comparison base is compatible only when its output contains the canonical
`mokly-manifest.json` and that manifest is a valid schema-v8 manifest. The
historical boundary applies the same v8 shape, relationship, path, and source
inventory validation as the current manifest reader. It reads baseline bytes
but never executes baseline source through the current Mokly package.

The boundary does not translate earlier schemas. Every accepted entry and
artifact already has the path-derived layout in the
[artifact path contract](./mokly-artifact-paths.md), and the
[move contract](./mokly-moves.md) pairs its entries with the current ones.

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
Absence of every recognized manifest is missing history. None of these cases
falls back or becomes a successful empty comparison.

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

Coverage must prove that a valid v8 base compares normally and that a lower
version or incompatible sentinel produces the command outcomes and single line
above. A newer-version base must make Serve report Changes unavailable with its
normal safe diagnostic and make explicit capture fail. Malformed v8, missing
history, current-manifest failure, output cleanup, and rollback remain separate
cases. Derived mode builds the base with that commit's tooling before this gate;
committed mode applies it directly to Git blobs.
