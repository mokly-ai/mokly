//! Contracts for one isolated cloud build attempt and its redacted output.

#![warn(unreachable_pub)]

pub mod cli_code;
pub mod error;
pub mod input;
pub mod log;
pub mod outcome;
pub mod request;
pub mod runner;
pub mod secret;
