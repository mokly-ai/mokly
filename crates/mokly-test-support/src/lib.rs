//! Shared scoped tracing captures for the workspace's Rust tests.

#![warn(unreachable_pub)]

pub mod capture;
mod capture_layer;
mod fields;
mod interest_guard;
pub mod records;
pub mod subscriber;
