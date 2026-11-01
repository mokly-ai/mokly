//! Deterministic static catalogues and ownership-protected output transactions.
#![warn(unreachable_pub)]

pub mod error;
pub mod filesystem;
pub mod inventory;
pub mod location;
pub mod transaction;

mod ownership;
mod reservation;

pub mod assembly;
pub mod changes;
mod comparison_details;
mod comparison_files;
mod comparison_output;
pub mod identity;
pub mod inspector;

pub mod fingerprint;
mod fingerprint_evidence;
mod fingerprint_observation;
mod fingerprint_walk;

pub mod modules;

mod artifact;

#[cfg(test)]
#[path = "_tests_/inventory_tests.rs"]
mod inventory_tests;

#[cfg(test)]
#[path = "_tests_/modules_tests.rs"]
mod modules_tests;

#[cfg(test)]
#[path = "_tests_/identity_tests.rs"]
mod identity_tests;

#[cfg(test)]
#[path = "_tests_/cleanup_tests.rs"]
mod cleanup_tests;

mod file_read;

#[cfg(windows)]
mod windows_identity;

#[cfg(test)]
#[path = "_tests_/inspector_tests.rs"]
mod inspector_tests;

mod input_selection;

#[cfg(test)]
#[path = "_tests_/input_selection_tests.rs"]
mod input_selection_tests;

#[cfg(test)]
#[path = "_tests_/fingerprint_tests.rs"]
mod fingerprint_tests;

#[cfg(test)]
#[path = "_tests_/fingerprint_boundary_tests.rs"]
mod fingerprint_boundary_tests;

#[cfg(test)]
#[path = "_tests_/fingerprint_discovery_tests.rs"]
mod fingerprint_discovery_tests;

pub mod inspector_error;

#[cfg(test)]
#[path = "_tests_/inspector_map_tests.rs"]
mod inspector_map_tests;

#[cfg(test)]
#[path = "_tests_/assembly_support.rs"]
mod assembly_support;

#[cfg(test)]
#[path = "_tests_/assembly_tests.rs"]
mod assembly_tests;

#[cfg(test)]
#[path = "_tests_/reservation_tests.rs"]
mod reservation_tests;

#[cfg(test)]
#[path = "_tests_/comparison/mod.rs"]
mod comparison_tests;

mod resource_bytes;

#[cfg(test)]
#[path = "_tests_/projection_forwarding_tests.rs"]
mod projection_forwarding_tests;
