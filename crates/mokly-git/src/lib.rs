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
pub mod extracted;
pub mod fingerprint;
pub mod identity;
pub mod repository;
pub mod tree;

pub mod access;

mod lookup;
mod repository_command;
mod repository_ops;

mod checkout;
mod checkout_batch;
mod checkout_bounds;
mod checkout_digest;
mod checkout_files;
mod checkout_index;
mod checkout_output;
mod checkout_stream;
mod conversion_paths;
mod extraction;
mod fetch;
mod history;
mod source_key;
