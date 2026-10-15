//! Annotated HTML trees and catalogue document composition.
#![warn(unreachable_pub)]

pub mod composition;
pub mod controls;
pub mod error;
pub mod fragment;
pub mod links;
pub mod markdown;
pub mod parse;
pub mod props;
pub mod safety;
pub mod serialize;
pub mod source_checks;
pub mod tree;

mod assembly;
mod autolinks;
mod components;
mod conditions;
mod context;
mod control_roots;
mod control_tiers;
mod elements;
mod forwarded_slots;
mod fragment_rebase;
mod fragment_validation;
mod javascript;
mod link_targets;
mod marker_auth;
mod marker_syntax;
mod markers;
mod raw_markers;
mod regions;
mod relative_links;
mod slots;
mod source_locations;

#[cfg(test)]
#[path = "_tests_/control_tests.rs"]
mod control_tests;
#[cfg(test)]
#[path = "_tests_/fragment_tests.rs"]
mod fragment_tests;
#[cfg(test)]
#[path = "_tests_/marker_tests.rs"]
mod marker_tests;
#[cfg(test)]
#[path = "_tests_/props_tests.rs"]
mod props_tests;
#[cfg(test)]
#[path = "_tests_/safety_tests.rs"]
mod safety_tests;
#[cfg(test)]
#[path = "_tests_/substitution_tests.rs"]
mod substitution_tests;
#[cfg(test)]
#[path = "_tests_/support.rs"]
mod support;
