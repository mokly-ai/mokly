# Build Warnings

## Scope

A build warning is a non-fatal diagnostic raised while a catalogue is
validated or rendered. It reports an ignored input or a structure that
builds and works but degrades accessibility or conformance, so the author
can decide whether to change it. A warning never alters document bytes, the
catalogue index, an entry detail, an HTTP response, or a timing record. This
contract defines the record, who produces it, which command reports it, and
the `--strict` option, including the exact warning lines. The broader
terminal rules are in the
[terminal output contract](./mokly-terminal-output.md).

## Record

A warning has a `code`, a `message`, and exactly one of a `route` or a
`subject`. A subject has a kind, `entry`, `component`, `folder`, or
`configuration`, and a path. The table below lists every code.

- `code` is a stable kebab-case identifier that automation may branch on.
- `route` is the document route of the view that produced the warning under
  the [artifact path contract](./mokly-artifact-paths.md), such as
  `account/home/index.mobile.html`.
- `subject` replaces `route` for a warning that does not concern one
  document. Exactly one is present. Entry and component subjects use their
  complete resolved path, including a variant path. Folder subjects use the
  folder path (`""` names the root). Configuration subjects use the
  configuration file path relative to the repository root, or its basename
  when that root does not contain the file. Paths use POSIX separators. A
  subject never contains an absolute or traversing path.
- `message` is one line of plain text without the route or subject prefix.
  It does not repeat the subject.
- The printed subject is `<kind> <JSON-quoted-path>`, for example
  `entry "account/home"`, `component "ui/action"`, `folder "account"`,
  `folder ""`, or `configuration "tools/mokly.config.json"`.

Raw C0 and C1 control characters are invalid in a diagnostic. Producers
render authored controls as visible lowercase JSON-style `\uXXXX` escapes
before normalization. Reporters escape any remaining control character in
the printed subject and message in the same way.

A generation's diagnostics are sorted by their printed route or subject,
then `message`, then `code`, using lexical string comparison, with a final
subject-kind tie-break that is empty for a route. Duplicates have equal code,
route or subject, and message. The order does not depend on the rendering
order, the operating system, or the absolute checkout path.

| Code                             | Producer                                                                                                                                                                                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `base-conversion`                | A base resource that could not complete checkout conversion ([comparison](./mokly-comparison.md#resources))                                                                                                                                         |
| `base-dependencies`              | A base-side install that fell back to the working tree ([comparison](./mokly-comparison.md#sides)), or changed governing inputs for dependency directories used by the HTML head ([HTML package styles](./mokly-comparison.md#html-package-styles)) |
| `duplicate-component-stylesheet` | A component that declares one real file twice ([component stylesheets](./mokly-component-stylesheets.md))                                                                                                                                           |
| `html-foster-parented`           | HTML5 parsing moved a component element or its composed content ([HTML screens](./mokly-html-screens.md#diagnostics))                                                                                                                               |
| `html-unused-props`              | A declared prop that no body reference reads ([HTML screens](./mokly-html-screens.md#diagnostics))                                                                                                                                                  |
| `html-ignore-attribute`          | An unknown attribute on an ignore wrapper ([HTML screens](./mokly-html-screens.md#links-and-markers))                                                                                                                                               |
| `link-control-ancestor`          | A styled link control inside a warning-tier ancestor ([link controls](./mokly-link-controls.md))                                                                                                                                                    |
| `link-control-descendant`        | A styled link control containing a warning-tier descendant ([link controls](./mokly-link-controls.md))                                                                                                                                              |
| `marker-in-raw-text`             | A marker inside raw text of a sidecar fragment ([comparison](./mokly-comparison.md#markers))                                                                                                                                                        |
| `props-not-data`                 | A non-data prop value excluded from an inferred schema ([entry props](./mokly-entry-props.md#schema-inference))                                                                                                                                     |
| `props-unsafe-integer`           | An unsafe integer in props, schema keywords, or authored control metadata ([entry props](./mokly-entry-props.md#schema-inference))                                                                                                                  |
| `props-control-bounds`           | A saved prop or story arg outside its editing bounds ([component controls](./mokly-component-controls.md))                                                                                                                                          |
| `stylesheet-extglob`             | A configuration stylesheet matcher with unsupported extglob syntax ([configuration](./mokly-configuration.md#shape))                                                                                                                                |
| `stylesheet-owner`               | A renderer `resources` seed that names a stylesheet ([rendering](./mokly-rendering.md#renderer-module))                                                                                                                                             |

Each producing contract defines its own message. A new producer adds a row
here and defines its message in its own contract.

## Producers And Transport

Warnings arise at three points: catalogue validation, which parses front
matter, infers schemas, and registers definitions; composition, which
adapts link controls, resolves component elements, and grafts sidecar
fragments; and the base side's preparation for Changes. Warnings that the
sidecar raises during a bundle or a render use this record too. A document's
warnings belong to the generation that rendered it. A document reused from
an earlier render keeps the warnings of that render. A referenced
document keeps its own diagnostics; they do not become the requesting
document's. A later validation or link failure keeps the warnings already
produced without inventing a result. Warnings are never written into a
document, never served over HTTP, never part of the index or a detail, and
never uploaded.

## Reporting

Each command reports the diagnostics of exactly one build or attempt:

| Command   | Reported                                                                          |
| --------- | --------------------------------------------------------------------------------- |
| `build`   | The build whose output is written, after rendering and before the summary         |
| `publish` | Its build, before any upload                                                      |
| `serve`   | Each attempt, once, under [Watched Serve Generations](#watched-serve-generations) |

Base catalogue and composition warnings are not current-build warnings.
Report only base preparation warnings, such as `base-conversion` and
`base-dependencies`. [Strict mode](#strict-mode) counts `base-conversion` but
not `base-dependencies`. Collect current-build and base preparation warnings
before applying `--strict`, so an earlier head warning cannot hide a
preparation warning.

Publish applies the [checkout rules](./mokly-upload.md) before it builds. A
checkout refusal can prevent the build; diagnostics already produced still
flush. Configuration, registry, and render warnings discovered before a
failure print before the failure diagnostic. Without strict mode, a warning
never changes the exit status by itself. Secrets are redacted at
presentation.

Reporters write warning lines to stderr. A warning adds nothing to stdout.
Plain reporters write exactly:

```text
[mokly/warning] <route>: <message>\n
```

Rich reporters write exactly the following unstyled text before
terminal-width truncation; supported terminals may style the surrounding
presentation:

```text
  ! <route>: <message>\n
```

For a non-document subject, substitute the printed subject for `<route>` in
both lines. For example:

```text
[mokly/warning] component "ui/action": duplicate component stylesheet "design/components/action.css" is ignored; it is linked once.
  ! component "ui/action": duplicate component stylesheet "design/components/action.css" is ignored; it is linked once.
```

## Watched Serve Generations

Serve numbers its attempts. Startup, a rebuild, manual `r`, and a reconfiguration each
start a new attempt before they prepare inputs. Serve reports the warnings of
the current attempt only: starting a
newer attempt discards pending older records at once, and a late record from
a sidecar or a background render cannot revive them, even when a failed
attempt leaves the older generation serving. A successful attempt prints its
collected warnings once, sorted and deduplicated, immediately before its
`Catalogue ready` line. A failed attempt flushes its own records before its
failure line and keeps its seen set, so a repair prints only new warnings. A
view that first renders on demand after readiness prints its warnings once
when they appear, while its attempt is current; a request for an already
reported document repeats nothing. Reconfiguration follows the same rules.
Snapshot Serve (`--no-watch`) has one lifetime scope, and a one-shot command
has one invocation scope. The base side's preparation follows the same
attempt rules.

On-demand, background, and temporary renders report their warnings in the
attempt that published their document, also when the render fails. The
background pass reports them in catalogue order under the
[on-demand contract](./mokly-on-demand.md#background-work-and-replacement). A render
or preview failure flushes pending records before its diagnostic. It does not
make a successful preparation attempt failed. The next attempt after a
successful repair starts with an empty seen set. Resource-only reloads keep
the current scope.

When preparation repeats under the
[readiness rule](./mokly-watch.md#watch-targets-and-readiness), success
reports only the final pass's warnings. A failure of the second pass or its recheck
also retains the first pass's warnings. A fatal Serve error flushes the
current attempt's pending records before its diagnostic only when
cancellation has not been requested. Cancelled attempts emit no warnings.

## Strict Mode

`--strict` is accepted by `build` and `publish` and refused by `serve` with
`cli-invalid` and the message `--strict belongs to build or publish`. With
`--strict`, the command counts every producer except `base-dependencies`,
still prints every warning, and fails when it counted a warning. The failure
has `build-invalid` and the message `1 build warning with --strict` for one
counted warning or `<n> build warnings with --strict` otherwise. The failure
is the next action after reporting: `build` fails before it writes its output
directory, and `publish` before it uploads anything, so the existing output
directory and the published catalogue stay unchanged. Without counted
warnings, `--strict` changes nothing, so a build whose only warnings are
`base-dependencies` exits `0`. A validation-only run is `build --strict` into
a temporary directory.

`base-dependencies` describes how the comparison prepared the base, not a
fault in the catalogue, so `--strict` does not count it; counting it would
make a valid catalogue fail a strict build because of its base preparation. A
strict build therefore also passes after a failed base installation, and its
comparison can then hide changes that packages cause.
