# mkc-live-interface

Message types and the relay contract for the Mokly Cloud live channel.
The hub and relay adapters use this crate to exchange events between replicas.

## Responsibilities

- Define the JSON messages that project sockets send and receive.
- Pass each tick to the relay as one batch.
- Deliver notices, relayed client events and subscription gaps to the hub.

## What This Crate Does

`ServerMessage` carries a notice, a resync signal or an event from another
socket of the project. `ClientEvent` carries a kind and its fields in one JSON
object. The `openapi` feature exposes schemas for both socket message types.

`LiveRelay` accepts batches grouped by project. Its subscription delivers
notices, relayed events and gaps as they occur.

## Quick Start

Turn a relay notice into the text of a socket message.

```rust
use mkc_live_interface::messages::{ServerMessage, ServerSignal};
use mkc_live_interface::relay::ProjectNotice;

fn notice_text(inbound: ProjectNotice) -> serde_json::Result<String> {
    serde_json::to_string(&ServerMessage::Signal(ServerSignal::Notice(inbound.notice)))
}
```

## Development

```sh
cargo test -p mkc-live-interface --features openapi
cargo clippy -p mkc-live-interface --all-targets --all-features -- -D warnings
```

### Key Code

- The socket message envelopes and their schemas. [messages.rs](./src/messages.rs)
- `LiveRelay` and the batches and events it exchanges. [relay.rs](./src/relay.rs)
- The errors shared by the hub and relay. [error.rs](./src/error.rs)

### Related Docs

- [Live channel](../../docs/protocol/cloud/live-channel.md)
- [Cloud architecture](../../docs/architecture/cloud.md#the-live-channel)
- [mkc-live](../mkc-live/README.md)
