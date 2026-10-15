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
pub mod identity;
pub mod inspector;

pub mod fingerprint;

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

pub mod input_selection;

#[cfg(test)]
#[path = "_tests_/input_selection_tests.rs"]
mod input_selection_tests;

#[cfg(test)]
#[path = "_tests_/fingerprint_tests.rs"]
mod fingerprint_tests;

pub mod inspector_error;

#[cfg(test)]
#[path = "_tests_/inspector_map_tests.rs"]
mod inspector_map_tests;

#[cfg(test)]
#[path = "_tests_/assembly_tests.rs"]
mod assembly_tests;

#[cfg(test)]
#[path = "_tests_/reservation_tests.rs"]
mod reservation_tests;
