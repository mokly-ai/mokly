# Catalogue publishing

This internal module implements `mokly publish`. Consumers and self-hosted
receivers use the installed npm executable and the
[catalogue upload protocol](../../docs/protocol/mokly-upload.md) and
[exchange contract](../../docs/protocol/mokly-upload-exchange.md), never deep
imports. Both protocol documents are included in the npm package. Publishing
uses the content-addressed Plan → Blobs → Complete exchange over a schema 3
ownership marker and upload v2 envelope. HTTP 426 reports the fixed viewer
namespace compatibility message and stops without retry or downgrade.

Publish forwards the exporter's primary build diagnostics to its CLI reporter
before bundle capture and upload. With `--strict`, that callback raises the
typed build failure at the same boundary, so no archive or HTTP side effect can
begin.

`run.ts` composes injected Git, export, HTTP and time boundaries. It pins the
actual checkout HEAD, adds an owned manifest through the exporter, captures its
finalized bytes before installation and rechecks HEAD. `snapshot.ts` validates
that finalized map and indexes its blobs; `exchange.ts` owns Plan → Blobs →
Complete and the single re-plan. HTTP failure leaves the complete local export
intact. Capture failure happens before installation and retains the previous
export through the normal transaction.
Changes-enabled exports already contain removed-page metadata and its complete
historical resource closure under the comparison generation. Because publishing
uses the finalized export map rather than walking the output directory, those
files participate unchanged in ownership, deployment identity, Plan metadata
and Blob uploads. The upload manifest remains owned but is declared publication
metadata and excluded from deployment identity. `--no-changes` reaches the exporter's current-only branch and
therefore packages no removed entries or historical paths.
The finalized browser inventory carries previous-version handling in the shared
`react-shell.js` bundle. Publish transfers those already-validated export bytes;
it neither rebundles the controller nor duplicates the review parser.

`metadata.ts` handles repository remotes and Actions context. `manifest.ts` and
`validation.ts` define the upload envelope and same-endpoint HTTP(S) URL
invariants. `plan.ts` selects only the manifest, marker and optional review for
`bundle.ts`; `blobs.ts` owns bounded concurrency, `complete.ts` owns completion,
and `retry.ts` owns retries and expiry through exported schedule constants that
keep guide conformance tests aligned. `accounting.ts` is the sole owner of
digest-based command counts and per-round marker-entry progress, including Plan
files and Blob attempts. `http.ts` shares bounded response reads, media-type
handling, a 120-second timeout and redirect refusal; `errors.ts` owns every
fixed publish error factory, including typed cancellation and transport-failure
presentations with the shared `upload-failed` category. Git identity reads
preserve cancellation rather than converting it to `git-failed`.
Remote bodies and exceptions never become user diagnostics. `cli/secrets.ts`
also redacts tokens from parser/config/build errors and diagnostic stacks.
Shared CLI value parsing accepts `--name=value`, preserving leading dashes and
token padding; boolean flags retain their no-value syntax. The packed-consumer
smoke exercises a leading-dash token and both public upload fixtures without
importing package internals.

The CLI maps an explicitly marked cancellation or platform `AbortError` to the
publication-cancelled line while retaining the original typed failure for
diagnostic stacks. During the export recovery contract's pre-installation
window, it lets already-delivered signals run for one event-loop turn, then
marks the original `MoklyError` without replacing its class, fields, message or
stack. The cancellation mark uses a shared symbol as well as the local registry,
so the CLI recognizes the same typed failure after a package or bundle-copy
boundary. Every recovery or cleanup failure passes through unchanged with its
recovery paths; export transaction setup keeps its own reservation errors.
Publication never writes the catalogue generated tree. `runPublish` keeps a referenced handle from signal listener
installation through completion, so helper shutdown still reaches the Mokly
reporter and status 1. Outside that one window, cancellation is never inferred
from causes, aggregate members, messages or a later command signal.

```bash
npm run build
node --import tsx --test --test-concurrency=2 tests/publish*.test.ts tests/export_current.test.ts
npm run package:smoke
```

See the [action usage](../../.github/actions/publish/README.md),
[export internals](../export/README.md) and [implementation plans](../../plans/).
