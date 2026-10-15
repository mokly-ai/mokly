//! Mokly command grammar and pure terminal presentation.

#![warn(unreachable_pub)]

pub mod build;
pub mod build_output;
pub mod changes_output;
pub mod codes;
pub mod errors;
pub mod grammar;
pub mod options;
pub mod output;
pub mod parsing;
pub mod publication;
pub mod publish_errors;
pub mod redaction;
mod render_errors;
pub mod version;

mod changes_diagnostics;
