# Build Warnings

## Delivery Status

The warning channel is implemented. Extending the ignored-owner warning to
all stylesheets is implemented in [M19](../../plans/remove-source-path-evidence.md#milestone-19-classify-css-by-where-its-rules-match) of the
[source-path removal plan](../../plans/remove-source-path-evidence.md).

Generation-scoped watched Serve warnings are planned for
[M29](../../plans/remove-source-path-evidence.md#milestone-29-fix-serve-warnings-and-startup-cleanup).
The `sharedImpact?: never` config guard and stronger warning/type regression
tests are planned for
[M30](../../plans/remove-source-path-evidence.md#milestone-30-strengthen-tests-the-docs-guard-and-removed-field-types).

## Warning Boundary

The [graceful-handling rule](./README.md#graceful-handling) applies when Mokly
can safely use a more specific input or discard an unnecessary one. A warning
is a diagnostic, not a registry violation, `MoklyError`, comparison reason,
manifest field, export file, or upload payload. It never changes an exit code,
prevents a valid build, or hides an independent error. Continue validating the
retained inputs normally. Warnings about removed fields are emitted even when
the field's value is `undefined`. Public TypeScript inputs use `?: never` to
reject a removed field with a value, including in spread objects. An explicit
`undefined` is rejected only with `exactOptionalPropertyTypes`; otherwise the
build warning covers it. The configuration guard's delivery is recorded above.

Collect structured warnings from configuration loading, registry preparation,
and each render, including on-demand and transient Serve renders. Use one
invocation-owned sink: `build`, `check`, `export`, and `publish` collect across
all internal phases, not just the final renderer call. Unwatched Serve collects
through startup and later on-demand renders for its lifetime. Watched Serve
uses the generation scope below. Its child never writes a second terminal
copy. Resource-only reloads that do not render do not replay old warnings.
Historical derived-baseline build commands are separate executions: their
captured warnings are not current-generation warnings and are not replayed by
the caller. Their independent failures still surface through the existing
baseline error path.

Each warning has a stable code, safe message and identity context. Deduplicate
by the JSON serialization of `[code, ...context]`, using the context fields in
the table below in their listed order; do not deduplicate by display mode,
process, render count or phase. The internal warning record is
`{ code: WarningCode, context: readonly string[], message: string }`. Emit one
copy of each distinct warning per one-shot run,
per unwatched Serve lifetime, or per watched startup/rebuild attempt. Across
multiple views of one route, use the route shown in the table; sort collected
warnings by code and context. Flush one-shot warnings before the success
summary or failure diagnostic; flush watched-startup/rebuild warnings before
the ready or failed-action line. On-demand warnings after readiness are emitted
when discovered through the same sink. Redact secrets and apply
the terminal width rules at the presentation boundary.

## Watched Serve Generations

Each warning belongs to the build generation that produced it. Allocate a
unique generation when startup or a serialized rebuild/reconfiguration attempt
starts, before loading config or evaluating consumer code. That attempt becomes
the current warning scope immediately, even before its output is accepted.
Use a 32-character lowercase hexadecimal build-generation identifier;
allocate it before preparation and carry it with the accepted rendering inputs.
Capture the generation at the producer's start; never label a late warning
with whichever generation is current when it arrives.

Carry `{ generation: string, warning: BuildWarning }` through configuration,
registry, background workers, on-demand document renders and transient Props
renders. A preview-process child sends
`{ type: "warning", generation: string, warning: BuildWarning }` over validated
IPC. The generation is the one attached to its rendering inputs, not the
process id or a browser update version. Reject a malformed or missing generation
and validate the warning before forwarding. The parent is the sole terminal owner.

The sink accepts only warnings whose generation equals the current attempt.
Deduplicate their code/context identity once across all phases and processes.
At the start of a newer attempt, discard pending older warnings and retire
their scope. An older warning must never print after that boundary, whether
it was queued before it or arrives later. Cancellation alone is insufficient.
Background compilation streams each warning through this channel. Completion
must not add `compilation.warnings` a second time. Failure still flushes the
current attempt's pending warnings before its failed-action line.

| Attempt outcome    | Warning behavior                                                                                                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Successful rebuild | Keep the new generation's sink and seen identities after adoption. Late background or child warnings from earlier inputs are discarded. A cause fixed by this build produces no new warning.                                                           |
| Failed rebuild     | Report this attempt's warnings once before its failure. The older accepted generation may continue serving previews and finishing work, but its warnings remain suppressed. Never restore its warning scope or relabel its warnings as this attempt's. |
| Reconfiguration    | Start a new scope before candidate loading. Success adopts that generation; failure retains the previous config/output/child without restoring their warning scope.                                                                                    |

Warnings discovered after readiness or a failed action print immediately only
if they belong to the still-current attempt and have not been seen. The next
attempt starts a fresh identity set, so a cause it encounters again can warn
once again. A resource-only reload, Git refresh or child restart does not reset
this set unless it starts a rebuild/reconfiguration attempt. These warning
rules do not change last-good output, work cancellation or command exit codes.
One-shot commands and unwatched Serve retain their invocation/lifetime scopes.

## Exact Messages

Placeholders `<id>`, `<path>`, `<href>` and `<route>` below are substituted as
JSON-quoted strings (including their quotes and escaping). An entry id is the
id of the direct entry, nested marker, root path, or variant that wrote
the field. A stylesheet `<path>` is the authored, `mockupsDir`-relative public
path; `<href>` is the configured href on that route; `<route>` is the generated
document route. The message has no `[mokly/...]` prefix; the reporter supplies
that framing.

| Code                                 | Deduplication context      | Exact message                                                                                                        |
| ------------------------------------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `removed-dependencies`               | Entry id                   | `dependencies has been removed; ignoring it on entry <id>. Delete the field.`                                        |
| `removed-owned-dependencies`         | Component id               | `ownedDependencies has been removed; ignoring it on component <id>. Delete the field.`                               |
| `removed-shared-impact`              | Config path                | `review.sharedImpact has been removed; ignoring it. Delete the field.`                                               |
| `duplicate-component-stylesheet`     | Component id and real file | `duplicate component stylesheet <path> on component <id> is ignored; it is linked once.`                             |
| `missing-configured-stylesheet-link` | Route and configured href  | `configured stylesheet link <href> is absent from <route>; component stylesheets use another anchor.`                |
| `ignored-stylesheet-resource-owner`  | Route and file identity    | `Stylesheet ownership for <path> on <route> is ignored. Changes follow the elements that each changed rule matches.` |

For a duplicate declaration, `<path>` is its first authored public path. For
removed root or folder metadata, the `removed-dependencies` code uses context
`["root path:" + JSON.stringify(navPath)]` or
`["folder:" + JSON.stringify(navPath)]`. Paths include the root labels and every
ancestor folder title. The messages are exactly
`dependencies has been removed; ignoring it on root path <path>. Delete the field.`
and `dependencies has been removed; ignoring it on folder <path>. Delete the field.`,
where `<path>` is the JSON-quoted path joined with `/`. A component variant
that supplies a removed field uses its own global id, never its parent's id.

For an ignored renderer record, `<path>` is the first renderer-record public
path for that file identity in authored order. This warning replaces the old
`ignored-declared-resource-owner` code; never emit both. It covers every CSS
record, including unlinked files and pages with no rendered declarer. For an
authored public file, identity is its confined real path. Generated CSS uses
`generated:` followed by its canonical public route, whether pending or already
written. This keeps one identity across all phases of a run. Repeated
records and realpath aliases warn once per route and invocation scope. Invalid
paths or unavailable generated routes still fail validation before a warning.

No warning is needed for a configured/declared overlap: keep the link and its
placement. Declarations do not supply resource ownership. Repeated or reordered
renderer links remain authored output rather than discarded input, so only a
missing configured href emits the configured-link warning, and only when
component-link insertion needs an anchor. Non-CSS resource owners and document
`styles` records retain their existing rules.
