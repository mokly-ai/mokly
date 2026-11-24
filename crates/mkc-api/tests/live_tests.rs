//! Project WebSocket tests against the API and an isolated Postgres schema.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use mkc_api::contract;

#[path = "../src/contract/_tests_/response_validation.rs"]
mod response_validation;

#[expect(
    dead_code,
    reason = "The live tests start a listener with explicit shutdown."
)]
#[path = "support/server.rs"]
mod test_server;

#[path = "live/mod.rs"]
mod live;
