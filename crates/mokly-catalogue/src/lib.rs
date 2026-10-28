//! Configuration, source discovery, and catalogue preparation.

#![warn(unreachable_pub)]
pub mod config;
mod config_links;
mod config_paths;
mod config_postcss;
pub mod config_types;
pub mod config_validation;
mod config_warnings;
mod control_order;
mod control_warnings;
mod declared_controls;
#[cfg(test)]
#[path = "_tests_/declared_controls_tests.rs"]
mod declared_controls_tests;
pub mod definition_provider;
pub mod diagnostic;
pub mod discovery;
mod discovery_walk;
mod documents;
mod entry_fields;
pub mod error;
mod folder_input;
mod folders;
mod front_matter;
mod globs;
pub mod html_driver;
mod html_driver_events;
pub mod html_input;
mod html_recording_sink;
mod html_token_types;
pub mod html_tokens;
mod identity;
#[cfg(test)]
#[path = "_tests_/ignore_parsing_tests.rs"]
mod ignore_parsing_tests;
pub mod input;
mod links;
mod locations;
mod moves;
pub mod numeric_warnings;
mod parsing;
pub mod preparation;
mod prepare_definitions;
mod prepare_entry;
mod prepare_parent;
mod prepare_sources;
mod props;
pub mod protection;
mod provided_entries;
mod references;
mod registry;
mod relationships;
pub mod render_sources;
mod template_role;
pub mod template_types;
mod templates;
mod validate_templates;
mod variants;
pub mod working_tree;
mod working_tree_read;
mod yaml;
mod yaml_aliases;
mod yaml_frame;
pub mod yaml_limits;
mod yaml_positions;
mod yaml_value;

#[cfg(test)]
#[path = "_tests_/html_token_span_tests.rs"]
mod html_token_span_tests;
mod working_tree_identity;
mod working_tree_stream;
