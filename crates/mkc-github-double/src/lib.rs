//! The recorded GitHub the cloud develops and tests against.
//!
//! It answers the exact API and OAuth requests `mkc-github` makes, from
//! recordings captured once from GitHub, so a deployment configured with
//! `MKC_GITHUB_API_ORIGIN` and `MKC_GITHUB_WEB_ORIGIN` can install, authorize
//! and read repositories without reaching the provider. Never depend on this
//! crate outside development and test wiring.

#![warn(unreachable_pub)]

mod checks;
pub mod error;
mod installations;
pub mod mode;
pub mod received;
pub mod recording;
mod repos;
pub mod routes;
pub mod server;
