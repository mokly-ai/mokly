//! Immutable publication snapshots and the Mokly upload exchange v1.

#![warn(unreachable_pub)]

pub mod accounting;
mod archive;
pub mod build;
pub mod build_failure;
pub mod checkout;
pub mod command;
pub mod completion;
pub mod error;
pub mod exchange;
pub mod hints;
pub mod http;
pub mod identity;
mod json;
pub mod metadata;
mod numbers;
pub mod ownership;
pub mod plan;
mod retry;
pub mod runtime;
mod semver;
pub mod settings;
pub mod snapshot;
pub mod validation;

#[cfg(test)]
#[path = "_tests_/mod.rs"]
mod tests;
