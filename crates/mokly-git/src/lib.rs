//! Bounded Git command execution and deterministic argument batching.

#![warn(unreachable_pub)]

pub mod batches;
pub mod command;
pub mod control;
pub mod error;
pub mod system;

mod cancellation;
mod pipes;
mod system_command;
mod system_runner;

pub mod changes;
pub mod disk;
pub mod identity;
pub mod repository;
pub mod tree;

pub mod access;

mod lookup;

mod checkout;
mod checkout_bounds;
mod checkout_index;
mod checkout_output;
mod conversion_paths;
mod extraction;
mod fetch;
mod history;
mod source_key;
