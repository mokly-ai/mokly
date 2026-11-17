# Mokly Fixture Regeneration

This is the fixture sub-contract of [Artifact compatibility](./mokly-artifact-compatibility.md).
The procedure uses the exact-pinned 0.19.0 CLI and viewer.

## Ownership

Fixtures live under `crates/mkc-mokly-contract/fixtures`, beside the consumer
and its integration tests, so a package bump and its parser evidence share
one review diff. `cargo xtask mokly-fixtures` regenerates them;
`cargo xtask mokly-fixtures --check` regenerates in isolated temporary storage,
compares every byte and filename, and fails on missing, extra or changed files.
The `cloud-fixtures` suite runs check mode unconditionally. Neither mode
publishes a catalogue or
modifies the canonical dogfood catalogue.

The archives, JSON artifacts, checksum records, authored corpus and the
generated OpenAPI client are committed golden files. The frozen source trees
are source only. They use the 0.19 authoring API and a data-only
`mokly.config.json`. Build output exists only in the generator's
private temporary checkout. Changes to `docs/mockups`, its config or unrelated
docs must not change these fixtures. Regenerate only for deliberate package or
contract changes, including intentional improvements to the frozen coverage.
The complete export archive stays under 640 KiB, so the committed golden file
stays small while it holds the viewer shell bundle and its font.

The live smoke uses a separate producer-owned 0.19 fixture under
`scripts/cloud/fixtures/`, whose checked-in catalogue is source only.
It must not consume the product catalogue or the contract fixture, and the
deployed proof uses the same exact 0.19.0 pin. Changing the
published live smoke version requires a deliberate fixture and runbook
update. See [Publish smoke](../../ops/publish-smoke.md).

## Reproducible Output

Regeneration needs the installed lockfile (`npm ci`) and no
network afterwards. The generator builds in a private temporary Git checkout
with two fixed commits, `fixture baseline` and `fixture comparison`, by the
author and committer `Mokly fixture <fixture@example.invalid>` at
`2000-01-01T00:00:00Z`, with global and system Git configuration disabled and
no signing. The output is byte-identical from any absolute root and
independent of the caller's branch, HEAD, worktree changes and Git
configuration; a fixture commit never contains a dependency symlink. The two
commits share their dependency inputs, so the comparison reuses the installed
dependencies and installs nothing. The timestamp and Git
identity are fixture inputs, never fabricated product data.

The comparison must include direct screen, component, use-case, page and
document Changes, changed view states, CSS selector evidence and an affected
consumer of a component implementation change that Changes does not include.

`mokly build --strict --out` writes the complete export into an ignored
directory of the checkout, with Changes against the baseline commit.
`mokly publish --strict` then sends its Plan request to a
loopback receiver, which records the request body and refuses the upload.
The publish names repository `github.com/mokly-ai/mokly-cloud`,
branch `fixture`, config `mokly.config.json`, the same base and a null pull
request. The Plan's marker declares the files of the complete
export with the same digests and sizes, plus the envelope.

0.19.0 has no option that fixes the envelope's client time. The generator
therefore sets `exportedAt` to `2000-01-01T00:00:00.000Z` and updates the
digest of the envelope's marker entry to match. The envelope and
the marker differ from the producer's bytes only in `exportedAt` and in that
digest. The two archives use portable USTAR/PAX headers,
uid/gid 0, mode 0644 and epoch times, gzipped with no filename and a
deterministic header time. The complete export holds every file that the
Plan's marker declares plus the marker, in UTF-16 path order.
The plan holds exactly the envelope, the marker and the index, in the CLI's
Plan order. The pinned npm `tar` package packs them; the
generator imports no Mokly packer.

The checksum record names the release and lists each fixture's SHA-256,
ordered by UTF-16 code units without locale collation. JSON copies preserve
producer bytes. Prettier excludes golden JSON, while frozen source stays
format-checked. Archive and JSON bytes, comparison identity and package
assets are part of the drift comparison; it never hides a difference by
normalizing producer output. Check mode also runs the Rust consumer against
the regenerated artifacts and the published ownership and plan-response
cases, and a modified unrelated mockup or config must leave check mode clean.
Published ownership cases cover shape only; the cloud owns the cases for its
comparison namespace and its version rejection gates.

## Moves And Index Corpus

A second frozen source produces a comparison with moves, a case-only rename,
removals of each kind, dark views and a component variant that moves to
another parent. Its artifacts carry a `moves-` prefix and their
own checksum record, and it does not change the original catalogue and
archive bytes. The original checksum record also inventories the CLI-code
fixture below. Every declared comparison path lies within the generation that
its index names, and the complete export is refused as a plan.

The authored index Changes-count corpus stores one base index, JSON Pointer
set/remove operations and exact raw text for byte-sensitive cases; each case
checks its rendered input hash in both harnesses. Each case
records the changed, added, removed and moved counts of the
[Changes count](./publication-review.md#changes-count), or the cloud rejection
kind of an index that the receiver refuses. Check mode runs the
corpus, both real producer indexes and the published
`fixtures/catalogue-v9.json` through the Rust reader and through the public
`readCatalogueIndex` of `@mokly/viewer`. The rule for the two
readers is in
[Publication index](./publication-review.md#reader-conformance-and-cloud-checks).
Both package versions must equal the corpus versions, so a pin bump requires
a deliberate corpus update, and the moves checksum record includes the corpus
SHA-256, so a corpus edit requires regeneration. Regeneration and drift cover
every generated file; the corpus, its Node check, the README and the frozen
source trees are the only authored inputs, and any other file under the
fixture directory is an error.

## CLI Failure Codes

`cli-errors.json` is a committed golden file in the original
`checksums.json` inventory. It records `moklyVersion` and ordered `scenarios`
rows with `scenario`, observed `code`
and `exitCode`. It covers the codes in the runner's
[typed mapping](./cloud-build-runner.md#cli-failure-codes), through the public
CLI only, with no internal imports or copied Mokly implementation.

`cargo xtask mokly-fixtures` runs two failed `mokly publish` commands in a
private temporary repository, using the fixed fixture identity and clean
baseline:

1. Create an uncommitted, unignored file; capture `git-uncommitted` as
   `uncommitted-file`.
2. Restore a clean checkout and publish to a loopback exchange double that
   refuses the upload with a transient service failure until the CLI
   exhausts its retries; capture `upload-failed` as `refused-upload`.
   The double answers Plan
   with HTTP 503 and `Retry-After: 0`. It requires five POST requests to the
   loopback project URL with the test bearer. The first scenario must
   make no upload request.

0.19.0 has no `build-stale` code, so no stale-output scenario exists.

Require a nonzero exit and parse the actual plain stderr prefix for each
scenario. Save observed values, never constants supplied by the generator.
Use test credentials only; contact no external upload service. Path-dependent
detail text is not a fixture field.
Check mode repeats the CLI probes and compares the fixture and checksum bytes.
A Rust contract test requires every code mapped by the worker to occur in
this fixture. A missing or renamed code fails rather than silently becoming
`exit`. The existing artifact fixtures retain
their producer bytes and deterministic drift rules.
