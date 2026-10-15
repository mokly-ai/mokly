//! Configuration, source discovery, and catalogue preparation.

#![warn(unreachable_pub)]
pub mod config;
mod config_paths;
pub mod config_types;
pub mod config_validation;
pub mod definition_provider;
pub mod diagnostic;
pub mod discovery;
mod discovery_walk;
mod documents;
pub mod error;
mod folder_input;
mod folders;
mod front_matter;
mod globs;
mod identity;
pub mod input;
mod links;
mod locations;
mod moves;
mod parsing;
pub mod preparation;
mod prepare_entry;
mod prepare_sources;
mod props;
pub mod protection;
mod references;
mod registry;
mod relationships;
pub mod template_types;
mod templates;
mod validate_templates;
mod variants;
pub mod working_tree;
mod yaml;
