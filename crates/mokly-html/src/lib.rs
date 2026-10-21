//! Annotated HTML trees and catalogue document composition.
#![warn(unreachable_pub)]

pub mod composition;
pub mod controls;
pub mod diagnostic_code;
pub mod error;
pub mod fragment;
pub mod links;
pub mod markdown;
pub mod normalization;
pub mod parse;
pub mod props;
pub mod safety;
pub mod serialize;
pub mod source_checks;
pub mod tree;
pub mod url_safety;

mod assembly;
mod autolinks;
mod component_root;
mod components;
mod compose_finish;
mod compose_machine;
mod conditions;
mod context;
mod context_drop;
mod control_roots;
mod control_tiers;
mod elements;
mod expansion;
mod forwarded_slots;
mod fragment_rebase;
mod fragment_validation;
mod html_arena;
mod html_sink;
mod ignore_checks;
mod javascript;
mod link_destination;
mod link_targets;
mod marker_auth;
mod marker_regions;
mod marker_syntax;
mod markers;
mod normalization_annotate;
mod normalized_keys;
mod normalized_regions;
mod normalized_usage;
mod placeholders;
mod raw_markers;
mod regions;
mod relative_links;
mod slots;
mod source_locations;
mod tree_debug;
mod tree_equality;
mod tree_traits;
mod tree_transform;

#[cfg(test)]
#[path = "_tests_/control_output_sweep_tests.rs"]
mod control_output_sweep_tests;
#[cfg(test)]
#[path = "_tests_/control_tests.rs"]
mod control_tests;
#[cfg(test)]
#[path = "_tests_/control_tier_sweep_tests.rs"]
mod control_tier_sweep_tests;
#[cfg(test)]
#[path = "_tests_/fragment_tests.rs"]
mod fragment_tests;
#[cfg(test)]
#[path = "_tests_/marker_tests.rs"]
mod marker_tests;
#[cfg(test)]
#[path = "_tests_/navigation_sweep_tests.rs"]
mod navigation_sweep_tests;
#[cfg(test)]
#[path = "_tests_/parser_tests.rs"]
mod parser_tests;
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
#[cfg(test)]
#[path = "_tests_/text_mode_tests.rs"]
mod text_mode_tests;
#[cfg(test)]
#[path = "_tests_/url_safety_tests.rs"]
mod url_safety_tests;

#[cfg(test)]
#[path = "_tests_/deep_context_tests.rs"]
mod deep_context_tests;

#[cfg(test)]
#[path = "_tests_/style_metadata_tests.rs"]
mod style_metadata_tests;

#[cfg(test)]
#[path = "_tests_/ignore_parsing_tests.rs"]
mod ignore_parsing_tests;
