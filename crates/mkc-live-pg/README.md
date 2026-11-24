# mkc-live-pg

The Postgres relay for the Mokly Cloud live channel. Use it in a server that
composes a live hub and needs to exchange messages with other API replicas.
The adapter implements the contract in `mkc-live-interface`. `mkc-live` runs
the hub and uses the relay through that contract.

## Responsibilities

Receive committed project notices and relay client events between replicas
over Postgres `LISTEN` and `NOTIFY`.

## What This Crate Does

`PostgresRelay::connect` opens two dedicated connections using the API's
database URL. One listens on both live channels. The other splits each hub
tick into payloads and sends them in one transaction. It drops each event
whose own payload would reach 7,900 bytes. One warning per affected tick
records the project and serialized size of the largest dropped event.
Publishing hands the tick to the sender without waiting for Postgres.

The subscription stays open when the listener loses its database connection.
The listener reports a gap after it reconnects and subscribes again. The hub
uses the gap to tell its sockets to read again.

## Quick Start

Create the relay on the Tokio runtime that serves the hub.

```rust
use std::sync::Arc;

use mkc_live_interface::error::Result;
use mkc_live_interface::relay::LiveRelay;
use mkc_live_pg::relay::PostgresRelay;

async fn live_relay(database_url: &str) -> Result<Arc<dyn LiveRelay>> {
    Ok(Arc::new(PostgresRelay::connect(database_url).await?))
}
```

## Development

```sh
MKC_TEST_DATABASE_URL=postgres://postgres:postgres@localhost/mkc_test cargo test -p mkc-live-pg
cargo clippy -p mkc-live-pg --all-targets -- -D warnings
```

The integration tests migrate a scratch schema and use distinct project and
replica IDs because Postgres notification channels span the database.

### Key Code

- Creates `PostgresRelay` and owns the two connection tasks. [relay.rs](./src/relay.rs)
- Subscribes to both channels and reports a gap after reconnecting. [listener.rs](./src/listener.rs)
- Sends all messages of one tick in one transaction. [sender.rs](./src/sender.rs)
- Splits and decodes notification payloads. [payload.rs](./src/payload.rs)

### Related Docs

- [Live channel](../../docs/protocol/cloud/live-channel.md)
- [Cloud architecture](../../docs/architecture/cloud.md#the-live-channel)
- [mkc-live-interface](../mkc-live-interface/README.md)
- [mkc-api](../mkc-api/README.md)
