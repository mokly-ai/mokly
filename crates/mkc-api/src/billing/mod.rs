//! Authenticated billing reads, hosted sessions, and durable webhook acceptance.

mod checkout;
mod checkout_input;
pub(crate) mod error;
mod portal;
mod read;
pub(crate) mod service;
pub(crate) mod views;
mod webhook;

#[cfg(test)]
#[path = "_tests_/mod.rs"]
mod tests;
