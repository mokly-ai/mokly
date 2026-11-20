//! Provider contracts for GitHub App authentication, repositories and check delivery.

#![warn(unreachable_pub)]

pub mod check;
pub mod checks;
pub mod credentials;
pub mod error;
pub mod http;
pub mod identity;
pub mod pull_requests;
pub mod repositories;
pub mod webhooks;
