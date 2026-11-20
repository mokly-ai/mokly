//! mkc-publications boundary.

#![warn(unreachable_pub)]

pub mod access;
mod blob_upload;
pub mod blob_writer;
mod build_check_delivery;
pub mod build_check_rerequests;
mod build_check_summary;
pub mod build_check_worker;
pub mod build_eligibility;
pub mod build_head;
pub mod build_log_text;
pub mod build_maintenance;
pub mod build_reconciliation;
pub mod build_scheduler;
mod build_upload;
pub mod build_worker;
pub mod capability;
pub mod check_provider;
pub mod check_rerequests;
pub mod check_summary;
pub mod check_worker;
mod completion;
mod completion_outcome;
mod envelope;
pub mod error;
pub mod garbage_collection;
pub mod ingest;
pub mod lifecycle;
pub mod locations;
pub mod maintenance;
pub mod policy;
mod preflight;
mod reservation;
pub mod retention;
mod screen_observation;
pub mod screens;
pub mod transaction;
mod upload_authorization;

#[cfg(test)]
#[path = "_tests_/mod.rs"]
mod tests;

pub mod check_delivery;
pub mod check_recovery;
