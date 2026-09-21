# Mokly MCP Server

## Scope

`mokly mcp` runs a local Model Context Protocol (MCP) server over standard
input and output so coding agents can search the catalogue, render screens and
components, read Changes, compare a view with its Git baseline, validate the
catalogue and read the packaged guides without a browser. It is a host over
the existing Serve runtime: the process supervises the same watched Serve
child, reaches it over loopback HTTP under the same admission rules as the
Browse shell, and exposes the results through typed tools and resources. The
[tools and resources contract](./mokly-mcp-tools.md) and the
[rendering and comparison tools contract](./mokly-mcp-render-tools.md) define
every tool, resource, schema and error.

The server never writes source files, generated output, Git state or
publication artifacts. It adds no public JavaScript API, HTTP transport,
network listener beyond Serve's loopback socket, or runtime dependency.

## Delivery Status

Approved target tracked by the [Mokly MCP server plan](../../plans/mokly-mcp-server.md).
Nothing in this document is implemented yet. Serve, Browse, export and publish
behavior is unchanged until the plan's milestones deliver it.

## Command

```text
mokly mcp [--config <path>] [--port <port>] [--base <ref>] [--debug-timings]
```

`mcp` is a public command with its own CLI guide. `--config`, `--port`,
`--base` and `--debug-timings` have their Serve meanings. `--watch`,
`--no-watch`, `--open`, `--out` and the publish options are refused by name
with `cli-invalid`. There are no positional arguments. The command runs until
its client closes standard input or the process receives `SIGINT` or
`SIGTERM`.

The process always uses the watched Serve lifecycle. Like `mokly serve`, the
host evaluates the consumer entry graph to build the live catalogue index and
never renders a document itself; rendering runs only in the supervised child
and its workers, so a failing renderer cannot end the agent's session. A
rejected candidate graph keeps the last-good generation active. Edits made by
the agent are adopted through the normal watch, replacement and reload rules
of the [watched development contract](./mokly-watch.md).

## Transport And Output Discipline

Messages are JSON-RPC 2.0 objects, one per line, UTF-8, without embedded
newlines, following the MCP stdio transport. Standard output carries only
those messages. Every reporter line, diagnostic, timing record and child
message goes to standard error. `--debug-timings` keeps its documented JSON
lines on standard error.

The watched child is forked with standard input ignored and both standard
output and standard error mapped to the parent's standard error, so a consumer
renderer, worker or dependency that prints cannot corrupt the protocol stream.
Ordinary Serve keeps inheriting the terminal; only this host selects the
mapping. Standard input belongs to the transport, so the interactive Serve
shortcuts are never started. Output mode selection is unchanged for other
commands; `mcp` always reports in plain mode on standard error.

Invalid JSON answers `-32700`. A request whose envelope is not JSON-RPC 2.0
answers `-32600`. Unknown methods answer `-32601`. Invalid parameters answer
`-32602`. Notifications with unknown methods are ignored. A line longer than
one MiB is rejected with `-32600` and the connection stays open.

## Handshake And Versions

The server answers `initialize` immediately, before the Serve child is ready,
so clients see the tool list without waiting for a build. It negotiates
protocol revision `2025-11-25` and also accepts `2025-06-18` and `2025-03-26`
when a client requests one of them; any other requested revision receives the
server's latest. It advertises `tools` with `listChanged: false`, `resources`
with `subscribe: true` and `listChanged: false`, and `serverInfo` with name
`mokly` and the installed package version. The `instructions` string tells the
agent to search before guessing entry ids, to render a view after editing it,
and to run `check_catalogue` before finishing.

The server implements `ping`, `tools/list`, `tools/call`, `resources/list`,
`resources/templates/list`, `resources/read`, `resources/subscribe`,
`resources/unsubscribe` and honors `notifications/cancelled`. It sends
`notifications/resources/updated` as defined in the tool contract. It does not
implement prompts, sampling, roots, logging, elicitation, completion or tasks.

## Readiness

`get_status` never waits; it reports the current phase. Every other tool waits
for the child to be ready for up to 60 seconds, then fails with `not-ready`
and the phase. Startup allows the child up to the five-minute readiness budget
of the [watched contract](./mokly-watch.md); a startup failure ends the
process with the underlying `MoklyError` on standard error and exit status 1.
After a replacement or unexpected child exit, tools wait for the replacement
under the same rule; in-flight requests to the old child fail with
`not-ready` instead of returning mixed generations.

## Loopback Gateway

Tools do not call Serve services in process. They send HTTP requests to the
child's loopback URL through one gateway with the Host, Origin and
`X-Mokly-Render-Token` rules of the
[component controls contract](./mokly-component-controls.md). The gateway
uses only these routes: `/__mokly/catalogue.json`, `/static/<fragment path>`,
`/__mokly/components/render`, `/__mokly/components/renders/<id>/…`,
`/__mokly/diffs/review.json` and its immutable generation files, and
`/__mokly/events`. The manifest, source files, `.mokly-cache/` and every other
protected path remain private; the gateway never constructs a request from a
caller-supplied path.

The child sends its render capability to the parent through one typed IPC
message whenever its render service is created or replaced. The parent
validates the message, retains only the latest `{ token, generation }`, and
exposes it to the gateway. The token never enters tool results, resources,
diagnostics, timings or the public catalogue.

The gateway consumes `/__mokly/events` for the lifetime of each child and
reconnects after a replacement. Each `ready` or `update` event refreshes the
catalogue snapshot and drives resource notifications. Notifications never
carry evidence; subscribers read the resource again.

## Security Boundary

- Serve binds `127.0.0.1` and the gateway connects only to that socket with an
  exact `localhost:<port>` or `127.0.0.1:<port>` Host.
- Tool inputs are catalogue ids, routes, viewports, color schemes, variant ids
  and declared prop overrides. No tool accepts a filesystem path, module,
  URL, shell command, Git ref or render token.
- Result bodies are bounded as defined per tool; oversized documents are
  truncated with an explicit flag, never silently.
- `check_catalogue` runs the CLI `check` as a captured plain-mode subprocess
  for the same configuration and returns its outcome; the MCP process never
  renders or validates documents itself.
- Protected sources, the private manifest and comparison inputs keep every
  rule of the [source protection contract](./mokly-source-protection.md).

## Shutdown

Standard input reaching end of file, `SIGINT` and `SIGTERM` start one
shutdown: pending tool calls fail with `closing`, the event stream closes, and
the watched Serve lifecycle drains its child through the graceful, terminate
and force-kill stages before the process exits with status 0. A second
shutdown request shares the first.

## Verification

- Framing: one message per line, invalid JSON, invalid envelopes, unknown
  methods, oversized lines and ignored unknown notifications.
- Version negotiation for each accepted revision and for an unknown revision.
- Standard output contains only JSON-RPC lines while a fixture renderer and a
  fixture worker write to standard output and standard error.
- Deterministic `tools/list`, `resources/list` and `resources/templates/list`.
- Readiness: `initialize` before child readiness, `get_status` phases, a tool
  call waiting for readiness, and `not-ready` after the bounded wait.
- Render-capability IPC parsing, rejection of malformed messages, replacement
  and absence from diagnostics.
- Child stdio mapping for `mcp` and unchanged inheritance for Serve.
- Shutdown on stdin end and on each signal, including with a pending call.
- The packed-consumer smoke starts `mokly mcp` from the installed package,
  completes the handshake and calls `get_status`.

## Related Docs

- [MCP tools and resources](./mokly-mcp-tools.md)
- [MCP rendering and comparison tools](./mokly-mcp-render-tools.md)
- [Package and authoring contract](./mokly-package.md)
- [On-demand Serve](./mokly-on-demand.md)
- [Live catalogue evidence updates](./mokly-live-evidence.md)
- [Component controls](./mokly-component-controls.md)
- [Selected live comparisons](./mokly-selected-comparisons.md)
- [Public catalogue read model](./mokly-catalogue.md)
