# CI Example Compilation Snapshot

This document supplements [CI suite evidence](./ci-suite-evidence.md) and the
[CI verification contract](./ci-verification.md). It defines the compiled
`examples/basic` catalogue that unit test files share, how it is produced and
kept fresh, and how tests fall back when it is not fresh.

## Snapshot File

Unit test files that read the compiled `examples/basic` catalogue share one
in-memory compilation per unit preparation. The snapshot is the Git-ignored
file `.context/verification/example-compilation.json`. It is one JSON object
with exactly these fields:

| Field                   | Value                                                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`         | `1`.                                                                                                                  |
| `key`                   | The freshness key, as 64 lowercase hexadecimal characters.                                                            |
| `diagnostics`           | The compilation's normalized build diagnostics as `{ code, route, message }` records.                                 |
| `manifest`              | The compilation's schema-v8 manifest object.                                                                          |
| `outputs`               | `[route, file]` pairs in compilation order. Text stays a string; binary output is `{ "kind": "bytes", "base64": … }`. |
| `deliveredStyleSources` | The compilation's repository-relative delivered style inputs.                                                         |
| `documentMarkdown`      | `[sourcePath, markdown]` pairs; omitted when the compilation has none.                                                |

Decoding requires the manifest object to serialize exactly to the snapshot's
`mokly-manifest.json` output. The compile writes that output only after its
strict schema-v8 validation, so decoding does not repeat the validation, which
costs seconds per test process. Diagnostics pass the build-warning validator.
Decoding rejects another schema version, a malformed key, unknown fields,
duplicate routes or document paths, and invalid binary transfer values. A decoded compilation equals the encoded one, with
binary outputs as plain `Uint8Array` values like a fresh compile. It has no
retained component runtime, so a test that needs `componentRuntime` compiles
instead.

## Freshness Key

The freshness key is a SHA-256 digest of the schema version followed by one
`[path, digest]` JSON line per input, in code-unit order of the
repository-relative `/`-separated path. `digest` is the SHA-256 of the file
bytes, `symlink:` plus the target of a symbolic link, or `missing` when the
path is absent or is not a regular file. The inputs are:

- every file that `git ls-files --cached --others --exclude-standard` lists
  under `examples/basic`, `docs/protocol` and `README.md`, so a tracked file
  deleted from the working tree hashes as `missing`;
- every regular file under `dist/` and `packages/viewer/dist/`, or the
  directory itself as `missing`;
- `package-lock.json` and `tsconfig.json`.

Ignored generated output never enters the key. The producer and the test
helper share one key function, so a mismatch means an input changed after the
snapshot was written.

## Producer

`node scripts/verification/example-snapshot.mjs` is the only writer. It exits
without compiling when the existing snapshot decodes and carries the current
key. Otherwise it compiles `examples/basic/mokly.config.ts` in memory and
computes the key again; when an input changed during the compile, it fails
without writing. It writes a temporary file beside the snapshot and renames it
into place, so a reader never sees a partial file. `npm run prepare:unit` runs
`npm run prepare:verification` and then the producer. `npm test` and the xtask
unit suite use it; the package, browser and hydration suites keep
`npm run prepare:verification` because they never read the snapshot.

## Test Helper

`tests/helpers/example_compilation.ts` loads the compilation at most once per
test process. It returns the decoded snapshot when the snapshot is fresh. When
the snapshot is missing, stale or invalid, it compiles the example in memory,
so a test file run by hand always works. Tests never write the shared snapshot
file; the round-trip test writes only a temporary copy.
`designCatalogue` and the default-mode before state of `designLibraryFixture`
use this helper. Fixtures that compile edited copies, other config profiles or
historical commits keep compiling, because that preparation is part of what
they verify. Each load emits `[mokly:fixture-timing]` lines with fixture
`example-compilation`: phase `snapshot` measures the lookup, and a fallback
adds phase `compile:missing`, `compile:stale` or `compile:invalid`.

## Unit Runners

Both unit runners require the snapshot file, the package outputs and the
example manifest to exist, and name `npm run prepare:unit` when one is missing.
They only check existence and never import the compiler; the helper owns
freshness and the compile fallback. Per-file report durations and the fixture
timing lines show when a fallback happened.
