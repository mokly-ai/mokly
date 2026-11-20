//! Authorized viewer reads, artifact projections and canonical sharing.

pub(crate) mod artifacts;
pub(crate) mod cursor;
pub(crate) mod input;
pub(crate) mod projection;
pub(crate) mod publication_state;
pub(crate) mod service;
mod share_validation;
mod snapshot;
mod transaction;
pub(crate) mod views;

#[cfg(test)]
#[path = "_tests_/mod.rs"]
mod tests;
