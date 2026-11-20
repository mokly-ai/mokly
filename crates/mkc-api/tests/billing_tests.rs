//! Recorded Stripe billing smoke tests against a live API and native Postgres.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use mkc_api::contract;

mod billing;
mod support;

#[expect(
    dead_code,
    reason = "Billing reads byte bodies; GitHub also uses text, JSON and headers."
)]
#[path = "support/client.rs"]
mod contract_client;

#[path = "support/installed.rs"]
mod installed;

#[path = "support/server.rs"]
mod test_server;
