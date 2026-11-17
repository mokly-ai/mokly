//! mkc-auth platform boundary.

#![warn(unreachable_pub)]

pub mod error;
mod links;
mod preview;
pub mod prune;
pub mod runtime;
pub mod service;
pub mod session_policy;
mod sessions;
mod transaction;

#[cfg(test)]
#[path = "_tests_/mod.rs"]
mod tests;
