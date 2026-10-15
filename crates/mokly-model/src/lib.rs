//! Shared wire shapes and pure validation for the Mokly core.

#![warn(unreachable_pub)]

pub mod axes;
pub mod canonical;
pub mod catalogue;
pub mod controls;
pub mod data;
pub mod diagnostic;
pub mod error;
pub mod evidence;
pub mod inference;
pub mod limits;
mod numeric;
pub mod paths;
mod profile;
pub mod prop_schema;
pub mod public_detail;
pub mod public_index;
pub mod public_metadata;
pub mod public_records;
mod public_validation;
pub mod readers;
mod tree_validation;
pub mod type_modules;
pub mod typescript;
pub mod usage;
pub mod validation;
pub mod versions;
pub mod wire_decode;
pub mod wire_props;
