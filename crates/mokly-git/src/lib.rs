//! Bounded Git command execution and deterministic argument batching.

#![warn(unreachable_pub)]

pub mod batches;
pub mod command;
pub mod error;
pub mod system;

mod cancellation;
