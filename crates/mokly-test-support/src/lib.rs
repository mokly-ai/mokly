//! Shared tracing captures, isolated filesystem fixtures, and process reap
//! observations for the workspace's tests.

#![warn(unreachable_pub)]

pub mod capture;
mod capture_layer;
pub mod durable_fixture;
mod fields;
mod interest_guard;
#[cfg(unix)]
pub mod reap_order;
pub mod records;
pub mod subscriber;
