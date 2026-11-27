//! mkc-auth platform boundary.

#![warn(unreachable_pub)]

mod desktop_grant;
mod desktop_grant_policy;
pub mod error;
mod links;
mod preview;
pub mod preview_verifier;
pub mod prune;
pub mod runtime;
pub mod service;
pub mod session_policy;
mod sessions;
mod transaction;

#[cfg(test)]
#[path = "_tests_/mod.rs"]
mod tests;
