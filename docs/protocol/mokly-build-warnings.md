# Build Warnings

## Delivery Status

The structured warning channel and warnings below are planned by
[remove-source-path-evidence](../../plans/remove-source-path-evidence.md),
Milestone 14. They are not implemented yet. Existing browser-opening warnings
are unchanged. [CLI terminal output](./mokly-terminal-output.md) owns their
presentation.

## Warning Boundary

The [graceful-handling rule](./README.md#graceful-handling) applies when Mokly
can safely use a more specific input or discard an unnecessary one. A warning
is a diagnostic, not a registry violation, `MoklyError`, comparison reason,
manifest field, export file, or upload payload. It never changes an exit code,
prevents a valid build, or hides an independent error. Continue validating the
retained inputs normally. Warnings about removed fields are emitted even when
the field's value is `undefined`; the public TypeScript types still reject
those fields.

Collect structured warnings from configuration loading, registry preparation,
and each render, including on-demand and transient Serve renders. Use one
invocation-owned sink: `build`, `check`, `export`, and `publish` collect across
all internal phases, not just the final renderer call. Unwatched Serve collects
through startup and later on-demand renders for its lifetime. Watched Serve
collects for each startup or serialized rebuild/reconfiguration attempt; its
child sends render warnings to the parent through a typed IPC warning event.
The child never writes a second terminal copy. A failed attempt can still
report warnings before its failure; the next attempt has a fresh deduplication
scope. Resource-only reloads that do not render do not replay old warnings.
Historical derived-baseline build commands are separate executions: their
captured warnings are not current-generation warnings and are not replayed by
the caller. Their independent failures still surface through the existing
baseline error path.

Each warning has a stable code, safe message and identity context. Deduplicate
by the JSON serialization of `[code, ...context]`, using the context fields in
the table below in their listed order; do not deduplicate by display mode,
process, render count or phase. The internal warning record is
`{ code: WarningCode, context: readonly string[], message: string }`. A Serve
child sends `{ type: "warning", warning: BuildWarning }` over its validated IPC
channel; the parent feeds it to the same sink as configuration and registry
warnings. Emit one copy of each distinct warning per one-shot run,
per unwatched Serve lifetime, or per watched startup/rebuild attempt. Across
multiple views of one route, use the route shown in the table; sort collected
warnings by code and context. Flush one-shot warnings before the success
summary or failure diagnostic; flush watched-startup/rebuild warnings before
the ready or failed-action line. On-demand warnings after readiness are emitted
when discovered through the same sink. Redact secrets and apply
the terminal width rules at the presentation boundary.

## Exact Messages

Placeholders `<id>`, `<path>`, `<href>` and `<route>` below are substituted as
JSON-quoted strings (including their quotes and escaping). An entry id is the
id of the direct entry, nested marker, root collection, or variant that wrote
the field. A stylesheet `<path>` is the authored, `mockupsDir`-relative public
path; `<href>` is the configured href on that route; `<route>` is the generated
document route. The message has no `[mokly/...]` prefix; the reporter supplies
that framing.

| Code                                 | Deduplication context      | Exact message                                                                                                              |
| ------------------------------------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `removed-dependencies`               | Entry id                   | `dependencies has been removed; ignoring it on entry <id>. Delete the field.`                                              |
| `removed-owned-dependencies`         | Component id               | `ownedDependencies has been removed; ignoring it on component <id>. Delete the field.`                                     |
| `removed-shared-impact`              | Config path                | `review.sharedImpact has been removed; ignoring it. Delete the field.`                                                     |
| `duplicate-component-stylesheet`     | Component id and real file | `duplicate component stylesheet <path> on component <id> is ignored; it is linked once.`                                   |
| `missing-configured-stylesheet-link` | Route and configured href  | `configured stylesheet link <href> is absent from <route>; component stylesheets use another anchor.`                      |
| `ignored-declared-resource-owner`    | Route and real file        | `renderer resources for declared stylesheet <path> on <route> are ignored; Mokly derives owners from rendered components.` |

For a duplicate declaration, `<path>` is its first authored public path. For
an ignored renderer record, `<path>` is the first renderer-record public path
for that real file in authored record order. A renderer record for a declared
file warns even on a page
without a rendered declarer; ignoring it cannot grant ownership. No warning is
needed for a configured/declared overlap: the configured input supplies the
link and the declaration still supplies ownership. Repeated or reordered
renderer links remain authored output rather than discarded input, so only a
missing configured href emits the configured-link warning, and only when
component-link insertion needs an anchor. Invalid paths and
ambiguous inputs retain their existing typed errors.
