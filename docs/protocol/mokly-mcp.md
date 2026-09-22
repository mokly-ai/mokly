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
publication artifacts beyond what watched Serve already writes. It adds no
public JavaScript API, HTTP transport, network listener beyond Serve's
loopback socket, or runtime dependency.

## Delivery Status

Approved target tracked by the [Mokly MCP server plan](../../plans/mokly-mcp-server.md).
Nothing in this document is implemented yet. Serve, Browse, export and publish
behavior is unchanged until the plan's milestones deliver it.

## Command

```text
mokly mcp [--config <path>] [--port <port>] [--base <ref>] [--debug-timings]
```

`mcp` is a public command with its own CLI guide, which lands in the same
change as the command. `--config`, `--port`, `--base` and `--debug-timings`
have their Serve meanings. `--watch`, `--no-watch`, `--open`, `--out` and the
publish options are refused by name with `cli-invalid`. There are no
positional arguments. The command runs until its client closes standard input
or the process receives `SIGINT` or `SIGTERM`.

The process is a watched Serve parent. Like `mokly serve`, it evaluates the
consumer entry graph to build the live catalogue index and runs exhaustive
background rendering in a parent-owned worker; requested documents render in
the supervised child and its workers. A rejected candidate graph keeps the
last-good generation active, so a broken edit does not end the agent's
session. Edits are adopted through the normal watch, replacement and reload
rules of the [watched development contract](./mokly-watch.md).

## Transport And Output Discipline

Messages are JSON-RPC 2.0 objects, one per line, UTF-8, without embedded
newlines, following the MCP stdio transport. Standard output carries only
those messages. Consumer code can print from three places in this process
tree, and each is contained:

1. Before any consumer module is loaded, the host takes a private stream on
   file descriptor 1 for the transport and redirects `process.stdout` writes to
   standard error, so entry-module evaluation and config loading cannot reach
   the protocol stream.
2. Parent-owned workers, including the exhaustive background worker, are
   created with their standard output and standard error piped and forwarded
   to the host's standard error.
3. The watched child is forked with standard input ignored and both standard
   output and standard error mapped to the host's standard error. Ordinary
   Serve keeps inheriting the terminal; only this host selects the mapping.

Every reporter line, diagnostic and timing record goes to standard error in
plain mode. Standard input belongs to the transport, so the interactive Serve
shortcuts never start. `--debug-timings` keeps its documented JSON lines on
standard error.

A line that is not valid JSON answers `-32700` with `id: null`. A line above
one MiB answers `-32600` with `id: null` and the connection stays open. JSON
that is not a JSON-RPC 2.0 request or notification object, including batch
arrays, answers `-32600`. Unknown request methods answer `-32601`; unknown
notification methods are ignored. Invalid parameters of a protocol method
answer `-32602`. Tool argument failures are tool results with `isError: true`,
never protocol errors. The complete error-code table is below.

## Handshake And Versions

The server answers `initialize` immediately, before the Serve child is ready,
so clients see the tool list without waiting for a build. It negotiates
protocol revision `2025-11-25` and also accepts `2025-06-18` and `2025-03-26`
when a client requests one of them; any other requested revision receives the
server's latest. It advertises `tools` with `listChanged: false`, `resources`
with `subscribe: true` and `listChanged: false`, and `serverInfo` with name
`mokly` and the installed package version. The `instructions` string is the
exact text in the tools contract.

The server implements `ping`, `tools/list`, `tools/call`, `resources/list`,
`resources/templates/list`, `resources/read`, `resources/subscribe`,
`resources/unsubscribe` and honors `notifications/cancelled`. It sends
`notifications/resources/updated` as defined in the tools contract. It does
not implement prompts, sampling, roots, logging, elicitation, completion or
tasks.

## Error Codes

| Code     | Meaning                                                          |
| -------- | ---------------------------------------------------------------- |
| `-32700` | The line was not valid JSON                                      |
| `-32600` | Not a JSON-RPC 2.0 request or notification, a batch, or too long |
| `-32601` | Unknown request method                                           |
| `-32602` | Invalid protocol parameters, unknown tool name, or malformed URI |
| `-32002` | A well-formed resource URI that names no resource                |
| `-32001` | The catalogue is not ready after the bounded wait; `data.phase`  |
| `-32603` | An internal failure; the message is generic and the cause logged |

Tool-level failures use the `isError` result codes in the tools contract.

## Readiness

`get_status` never waits; it reports the current phase. Every other tool, and
a `mokly://catalogue` read, waits for the child to be ready for up to 20
seconds, then fails with `not-ready` (tools) or `-32001` (resources) carrying
the phase, so agents poll `get_status` instead of hanging on a client tool
timeout. Startup allows the child the five-minute readiness budget of the
watched contract; a startup failure ends the process with the underlying
`MoklyError` on standard error and exit status 1. After a replacement or
unexpected child exit, calls wait for the replacement under the same rule;
in-flight requests to the old child fail with `not-ready` instead of returning
mixed generations.

## Loopback Gateway

Tools do not call Serve services in process. They send HTTP requests to the
child's loopback URL through one gateway with the Host, Origin and
`X-Mokly-Render-Token` rules of the
[component controls contract](./mokly-component-controls.md). The gateway
uses only these route families: `/__mokly/catalogue.json`, `/static/**` for
read-model `PublicPath` values, `/__mokly/components/render`,
`/__mokly/components/renders/<id>/**`, `/__mokly/diffs/review.json` and its
immutable generation files, and `/__mokly/events`. The manifest, source
files, `.mokly-cache/` and every other protected path remain private; the
gateway never constructs a request from a caller-supplied path, and response
bodies from failed requests are logged to standard error but never forwarded
into a tool result.

The gateway holds one catalogue snapshot. It re-reads
`/__mokly/catalogue.json` after each `ready` or `update` event, after every
successful `render_view` or `render_component` call, and before any tool that
reports `revision`, because accepted on-demand documents advance the evidence
revision without an event. GET on that route triggers no Git or rendering
work, so these reads are cheap.

The child sends its render capability to the parent through one typed IPC
message whenever its render service is created or replaced. The parent
validates the message, retains only the latest `{ token, generation }`, and
exposes it to the gateway. The token never enters tool results, resources,
diagnostics, timings or the public catalogue.

## Security Boundary

- Serve binds `127.0.0.1` and the gateway connects only to that socket with an
  exact `localhost:<port>` or `127.0.0.1:<port>` Host.
- Tool inputs are catalogue ids, viewports, color schemes, variant ids and
  declared prop overrides. No tool accepts a filesystem path, route, module,
  URL, shell command, Git ref or render token.
- Result bodies are bounded as defined per tool; oversized documents are
  truncated with an explicit flag, never silently.
- `check_catalogue` runs the CLI `check` as a captured subprocess for the same
  configuration and returns its outcome; the host never renders or validates
  documents itself.
- Protected sources, the private manifest and comparison inputs keep every
  rule of the [source protection contract](./mokly-source-protection.md).

## Sharing A Checkout With Serve

Running `mokly serve` and `mokly mcp` on one checkout is expected. Both are
watched Serve parents: ports advance independently, the derived baseline cache
is shared under its existing lock, and each process serves its own
comparisons. Both write generated output to the same `mockupsDir` through the
transactional store after a source edit, so two rebuilds can overlap; the
loser reports the existing "could not commit generated output" diagnostic and
retains its last-good generation, then adopts the next edit. This is the same
behavior as two `serve` processes and is not silent data loss. Removing the
disk write from the MCP host in derived mode is post-merge work.

## Shutdown

Standard input reaching end of file, `SIGINT` and `SIGTERM` start one
shutdown: pending tool calls fail with `closing`, the event stream closes, and
the watched Serve lifecycle drains its child through the graceful, terminate
and force-kill stages before the process exits with status 0. A second
shutdown request shares the first.

## Verification

- Framing: one message per line, invalid JSON, invalid envelopes, batches,
  unknown methods, oversized lines and ignored unknown notifications.
- Version negotiation for each accepted revision and for an unknown revision.
- Standard output contains only JSON-RPC lines while a fixture entry module
  prints during evaluation, a fixture renderer prints during the exhaustive
  background pass, and a fixture worker prints in the child.
- Deterministic `tools/list`, `resources/list` and `resources/templates/list`
  matching the shipped fixture.
- Readiness: `initialize` before child readiness, `get_status` phases, a tool
  call waiting for readiness, `not-ready` and `-32001` after the bounded wait.
- Snapshot refresh after a successful render advances `revision.evidence`.
- Render-capability IPC parsing, rejection of malformed messages, replacement
  and absence from diagnostics.
- Child stdio mapping and worker piping for `mcp`, unchanged inheritance for
  Serve.
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
