//! GitHub account and installation policy, separate from provider transport.

pub(crate) mod callback;
pub(crate) mod input;
pub(crate) mod service;
pub(crate) mod views;

mod acceptance;
mod flow;
mod identity;
mod installation;
mod listing;
pub(crate) mod listing_input;
mod mapping;
mod policy;
pub(crate) mod reconciliation;
pub(crate) mod transaction;

#[cfg(test)]
#[path = "_tests_/mod.rs"]
mod tests;
