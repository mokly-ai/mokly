//! Bounded Git command execution and deterministic argument batching.

#![warn(unreachable_pub)]

pub mod batches;
pub mod command;
pub mod control;
pub mod error;
pub mod system;

mod pipes;

pub mod changes;
pub mod disk;
pub mod identity;
pub mod repository;
pub mod tree;

mod blob_batches;
