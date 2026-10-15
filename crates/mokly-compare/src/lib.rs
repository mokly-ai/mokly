//! Base-side sources, extraction and dependency preparation for Changes.

#![warn(unreachable_pub)]

pub mod cache;
pub mod cache_types;
pub mod commands;
pub mod dependencies;
pub mod error;
pub mod extraction;
pub mod inputs;
pub mod locations;
pub mod process;
pub mod sources;
pub mod storage;
mod storage_tree;
pub mod working_inputs;

mod manifest;
