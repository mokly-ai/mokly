//! Billing policy, lifecycle, verification, and worker services.

#![warn(unreachable_pub)]

pub mod entitlements;
pub mod error;
pub mod lifecycle;
pub mod prices;
pub mod recovery;
mod retry;
pub mod seats;
pub mod worker;

#[cfg(test)]
#[path = "_tests_/mod.rs"]
mod tests;
