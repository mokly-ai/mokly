# Repository Generated Files

This is the generated-file sub-contract of
[Repository layout](./repository-layout.md).

## Mokly Output Ownership

The mockup root uses explicit `files` globs and path-derived entries. Mokly
writes nothing into the repository except build output.
`npm run mockups:build` writes the static catalogue to `mokly-static/` at the
repository root. `npm run mockups:check` writes its validation
output to a directory under `.context/`. Serve keeps its
documents in memory, and `publish` builds in a private directory outside the
repository. Mokly keeps its caches in the operating system's
cache directory. Every build and publish runs with `--strict`. See
[Mockup tooling](./mockup-tooling.md) for commands and asset delivery.

The root `.gitignore` contains `/mokly-static/` and the unanchored rule
`.mokly-export-reservations/`, which covers the reservation directory that a
build keeps beside its output. The `/.context/` rule covers the
validation output. No negation rule re-includes a path below these
directories, and the ordinary `node_modules/` and `dist/` rules remain.

The root `.gitignore` keeps its unanchored `mokly-generated/` and
`.mokly-cache/` rules, and `.prettierignore` keeps its `**/mokly-generated/`
rule, so output that an earlier release left in a checkout stays ignored.
Decision: keep these rules, not remove them, because `publish` refuses a
checkout with untracked files that Git does not ignore. Prettier reads the
root ignore files, so it never formats Mokly's bytes.

## Tracked Files

The build output stays untracked and ignored. A fresh clone builds it before
disk tests, visual inspection or site staging. The repository policy guard
requires zero indexed paths below `mokly-static/` at the repository root and
below any `.mokly-export-reservations/` or `mokly-generated/` directory, as
[Mockup verification](./mockup-verification.md) states.

Source, styles, authored assets, package pins and `package-lock.json` stay
tracked. Byte-checked archives, JSON and checksums under
`crates/mkc-mokly-contract/fixtures/` are committed golden files, with the
authored Changes-count corpus beside them. The generated OpenAPI
document `docs/api/openapi.json` and the generated TypeScript client under
`apps/app/src/api/generated/` are committed too. They are committed rather than
generated at build time so that the frontend builds without Rust, reviewers
can see contract changes, and the drift stages (18 for the fixtures, 17 for
the API document and the client) prove that the pinned generators still
produce the exact bytes the code consumes. They are not Mokly output trees.

`cargo xtask openapi` regenerates both API files. Never hand-edit either file.
Stage 17 regenerates both and rejects any difference from the committed bytes.
Checking only the client is rejected because a stale document would remain
undetected. Stage 18 continues to check the contract fixtures' exact bytes.

The fixture generator and the publish smoke commit only sources in their own
temporary Git repositories. Their builds write into directories
that those repositories ignore, and `publish` builds outside them.
See [Fixture regeneration](./mokly-fixture-regeneration.md)
and [Publish smoke](../../ops/publish-smoke.md).
