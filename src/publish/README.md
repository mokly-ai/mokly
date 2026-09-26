# Catalogue publishing

This internal module implements `mokly publish`. Consumers and self-hosted
receivers use the installed npm executable and the
[upload v1 protocol](../../docs/protocol/mokly-upload.md), never deep imports.
The protocol documents are included in the npm package.
Publish passes its export's structured warnings through the same CLI sink as
configuration loading. It emits each distinct warning once before the success
summary or failure without placing warnings in the upload archive.

`run.ts` composes injected Git, export, HTTP and time boundaries. It pins the
actual checkout HEAD, adds an owned manifest through the exporter, compresses
its finalized bytes before installation, rechecks HEAD and uploads once. HTTP
failure leaves the complete local export intact. Archive failure happens before
installation and retains the previous export through the normal transaction.
Changes-enabled exports already contain removed-page metadata and its complete
historical resource closure under the comparison generation. Because publishing
bundles the finalized export map rather than walking the output directory,
those files participate unchanged in ownership, deployment identity and the
upload archive. `--no-changes` reaches the exporter's current-only branch and
therefore packages no removed entries or historical paths.
The finalized browser inventory carries previous-version handling in the shared
`react-shell.js` bundle. Publish archives those already-validated export bytes;
it neither rebundles the controller nor duplicates the review parser.

`metadata.ts` handles repository remotes and Actions context. `manifest.ts` and
`validation.ts` define the upload envelope invariants. `bundle.ts` uses
`tar-stream` without filesystem traversal, enforcing file/path limits and bounded
uncompressed/compressed streams. `http.ts` accepts an injectable fetch function,
uses a 120-second timeout, disables redirects and maps statuses to fixed errors.
Remote bodies and exceptions never become user diagnostics. `cli/secrets.ts`
also redacts tokens from parser/config/build errors and diagnostic stacks.
Shared CLI value parsing accepts `--name=value`, preserving leading dashes and
token padding; boolean flags retain their no-value syntax. The packed-consumer
smoke exercises a leading-dash token and the public ownership fixtures without
importing package internals.

```bash
npm run build
node --import tsx --test --test-concurrency=2 tests/publish*.test.ts tests/export_current.test.ts
npm run package:smoke
```

See the [action usage](../../.github/actions/publish/README.md),
[export internals](../export/README.md) and [plan index](../../plans/README.md).
