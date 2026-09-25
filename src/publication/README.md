# Repository preview publication

This internal module supplies typed boundaries used by the repository-only
`npm run preview:build` workflow. Consumers use `mokly export` or
`mokly publish`; they do not import these files.

`options.ts` validates the explicit Changes capability and command arguments.
`files.ts` and `resources.ts` capture confined inputs and public resources.
`removed_previews.ts` captures removed pages through the pinned baseline,
packages them into the comparison generation, and builds the same validated
screen/page descriptors that consumer export uses. Failures cross this boundary
as `MoklyError`. `shell_previews.ts` adds those descriptors only to captured
static shells after the immutable generation path is known, leaving Serve's
page descriptors absent.

The `.mjs` files under `scripts/preview/` remain repository orchestration: they
start and stop the capture server, call these typed operations, and hand the
result to the shared export transaction. `capture.mjs` owns static shell and
asset capture; `catalogue.mjs` owns generation and publication lifetime.
For derived preview publication, `scripts/preview/inputs.mjs` fingerprints
authored inputs without reading ignored generated output. Its ownership check
uses the captured manifest inventory so a later freshness check cannot change
the fingerprint by hydrating the in-memory configuration. The orchestrator
then compiles an accepted generation, requires its manifest to match the
checked manifest, and passes its HTML, stylesheet and binary asset bytes to
`resources.ts`; it recompiles before installation to reject intervening
source/output changes. Committed capture reads checked disk bytes. Both paths
validate staged CSS references, including scoped npm assets, and exclude
private source modules and PostCSS-discovered dependencies.

Focused verification:

```bash
npm run build
npx tsx --test tests/preview_removed_pages.test.ts tests/removed_preview_delivery.test.ts
```

See the [publication contract](../../docs/protocol/mokly-publication.md),
[removed-preview contract](../../docs/protocol/mokly-removed-previews.md), and
[export internals](../export/README.md).
