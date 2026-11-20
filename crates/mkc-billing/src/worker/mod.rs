//! Durable Stripe delivery processing with fenced leases and bounded retries.

mod handlers;
mod plan;
mod reconcile;
mod reconcile_commands;
mod retry;
#[expect(
    clippy::module_inception,
    reason = "the billing protocol names worker/worker.rs as the public worker boundary"
)]
pub mod worker;
