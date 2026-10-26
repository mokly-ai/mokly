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
mod length;
mod remote;
mod rust_file_length;

fn main() -> std::process::ExitCode {
    cli::main()
}

#[cfg(test)]
#[path = "_tests_/boundary_mocks_tests.rs"]
mod boundary_mocks_tests;
