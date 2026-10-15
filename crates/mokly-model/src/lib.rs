//! Shared wire shapes and pure validation for the Mokly core.

#![warn(unreachable_pub)]

pub mod axes;
pub mod canonical;
pub mod catalogue;
pub mod controls;
pub mod data;
mod detail_validation;
pub mod diagnostic;
pub mod error;
pub mod evidence;
pub mod inference;
pub mod limits;
pub mod material;
mod numeric;
pub mod output;
pub mod paths;
mod profile;
pub mod prop_schema;
pub mod public_detail;
pub mod public_index;
pub mod public_metadata;
pub mod public_records;
mod public_validation;
pub mod read_contract;
pub mod readers;
mod removed_validation;
pub mod routes;
mod tree_validation;
pub mod type_modules;
pub mod typescript;
pub mod usage;
pub mod validation;
pub mod versions;
pub mod wire_decode;
pub mod wire_props;

pub mod review;
pub mod review_affected;
pub mod snapshot;
pub mod snapshot_records;

pub mod review_order;
pub mod review_validation;

mod snapshot_validation;

mod review_affected_validation;

mod record_validation;

mod snapshot_order;

mod snapshot_source_order;
