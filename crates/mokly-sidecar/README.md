# mokly-sidecar

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

`mokly-sidecar` is the Rust client of Mokly's optional Node render sidecar.
It owns the wire protocol. The core owns catalogue decisions and rendering
schedules. `mokly-model` supplies shared schemas; The pool receives process ownership from `mokly-platform`. The protocol client has no platform dependency.

## Responsibilities

- Type every method, response, and diagnostic event.
- Frame UTF-8 JSON with LF delimiters and a 64 MiB JSON-byte limit.
- Require an exact-version hello before command traffic.
- Match each response id to the outstanding request.
- Return typed protocol, version, process, and render failures.

## What This Crate Does

`Decoder` handles arbitrary chunks, including split UTF-8 sequences. It
rejects malformed or oversized frames and partial frames at EOF. Responses
contain exactly one result or error. The client decodes each result against
the pending method before a caller uses it.

`Client` consumes `dyn Transport` and `dyn Events`. Hello uses request id 0.
Its response must report the binary's exact package version. The first
response cannot be a diagnostic event. After hello, requests run in order;
events go to the injected reporter while a response is pending.

`Call::timeout_ms` supplies the protocol defaults. The process pool owns
spawning, deadline overrides, retry, recycling, and shutdown. The Node
sidecar implementation lives in `@mokly/mokly`.

## Quick Start

```bash
cargo test -p mokly-sidecar
```

Implement `Transport` with the pool's bounded pipe reader and writer. Construct
`Client::new(transport, events, version)`, consume it through
`dyn SidecarClient`, and call `handshake` before `request`.

## Development

```bash
cargo clippy -p mokly-sidecar --all-targets -- -D warnings
```

Tests use `unimock` for the framed transport and event sink. They check hello,
version mismatch, correlation, diagnostic forwarding, chunk boundaries, and
both sides of the frame-size limit.

### Key Code

- [Methods](./src/methods.rs), [results](./src/results.rs), and
  [wire envelopes](./src/wire.rs).
- [Framing](./src/codec.rs), [client](./src/client.rs), and
  [error categories](./src/error.rs).

### Related Docs

- [Sidecar contract](../../docs/protocol/mokly-sidecar.md).
- [Rust architecture](../../docs/architecture/rust-core.md).
- [Entry props](../../docs/protocol/mokly-entry-props.md).

`cargo xtask generate-types` writes the Node declarations under
`packages/mokly/src/generated/sidecar/`. Each wire type has its own module,
with dependency imports. Integer fields use TypeScript `number`. Authored
schemas remain JSON until the core validates them. Describe diagnostics keep
their authoring codes. Definition metadata and warning codes have typed fields.
Consumers enable the `mock` feature to use the public unimock boundaries.
