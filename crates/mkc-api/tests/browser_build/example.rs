//! Test-only API composition for the App's real build browser journey.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use mkc_api::contract;

#[path = "../github/build_exchange.rs"]
mod build_exchange;
#[expect(
    dead_code,
    reason = "The browser target uses only the publishing runner mode."
)]
#[path = "../github/build_provider.rs"]
mod build_provider;
#[expect(
    dead_code,
    reason = "The shared contract client also serves other API suites."
)]
#[path = "../support/client.rs"]
mod contract_client;
#[path = "../support/mod.rs"]
mod support;

mod server;

fn main() {
    server::run();
}
