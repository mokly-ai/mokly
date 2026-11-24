# mkc-live

The replica-local hub for the Mokly Cloud live channel. The API uses this
crate to register authorized project sockets and connect them to a relay.

## Responsibilities

- Deliver notices and client events to the sockets of their project.
- Coalesce and publish client events on the live channel tick.
- Enforce message limits and signal resync after an outbound queue overflow.
- Close registered sockets when the replica shuts down.

## What This Crate Does

`ReplicaHub` starts a tick task and subscribes to a `LiveRelay`. The API
registers each socket for its project and account. It passes client text to
the connection handle and reads the handle for messages and close codes.
Dropping the handle removes its registration.

The `test-support` feature provides `MemoryRelay`. Share one relay across
test hubs to pass client events and inject notices or gaps.

## Quick Start

Start a hub inside a Tokio runtime with time enabled. Pass the registered
client event kinds and set the capacity of each outbound queue.

```rust
use std::num::NonZeroUsize;
use std::sync::Arc;

use mkc_live::hub::{LiveHub, ReplicaHub};
use mkc_live_interface::error::Result;
use mkc_live_interface::relay::{LiveRelay, ReplicaId};

fn start_hub(
    replica: ReplicaId,
    relay: Arc<dyn LiveRelay + Send + Sync>,
    capacity: NonZeroUsize,
) -> Result<Arc<dyn LiveHub>> {
    Ok(Arc::new(ReplicaHub::start(replica, relay, &[], capacity)?))
}
```

## Development

```sh
cargo test -p mkc-live
cargo clippy -p mkc-live --all-targets --all-features -- -D warnings
```

### Key Code

- Hub startup, socket registration and shutdown. [hub.rs](./src/hub.rs)
- Client text and outbound items for one socket. [connection.rs](./src/connection.rs)
- The bounded outbound queue and overflow recovery. [outbound.rs](./src/outbound.rs)
- The relay that connects hubs in one process for tests. [memory.rs](./src/memory.rs)

### Related Docs

- [Live channel](../../docs/protocol/cloud/live-channel.md)
- [Cloud architecture](../../docs/architecture/cloud.md#the-live-channel)
- [mkc-live-interface](../mkc-live-interface/README.md)
