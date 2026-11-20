//! Shared tracing captures and isolated filesystem fixtures for the workspace's tests.

#![warn(unreachable_pub)]

pub mod capture;
mod capture_layer;
pub mod durable_fixture;
mod fields;
mod interest_guard;
pub mod records;
pub mod subscriber;
