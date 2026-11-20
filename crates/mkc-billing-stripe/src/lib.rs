//! Stripe billing adapters for Mokly Cloud.

#![warn(unreachable_pub)]

pub mod client;
pub mod runtime;
pub mod security;
pub mod transport;

mod response;

#[cfg(test)]
#[path = "_tests_/mod.rs"]
mod tests;
