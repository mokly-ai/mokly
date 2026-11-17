//! Repository automation entry point.

#![warn(unreachable_pub)]

mod application;
mod artifacts;
mod check;
mod child_environment;
mod cli;
mod command;
mod error;
mod executor;
mod policy;
mod remote;
mod rust_file_length;

use std::process::ExitCode;

fn main() -> ExitCode {
    cli::main()
}

#[cfg(test)]
#[path = "_tests_/boundary_mocks_tests.rs"]
mod boundary_mocks_tests;
