//! Mokly command grammar and pure terminal presentation.

#![warn(unreachable_pub)]

pub mod build;
pub mod build_output;
pub mod cancellation;
pub mod cancelled_work;
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
pub mod serve;
pub mod serve_errors;
pub mod serve_output;
pub mod serve_settings;
pub mod version;

pub mod static_build;
pub mod watch_output;

pub mod pre_installation;

pub mod static_errors;

pub mod static_admission;

pub mod publication_signals;

pub mod watch_diagnostics;
