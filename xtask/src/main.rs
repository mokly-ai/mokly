//! Repository automation entry point.

#![warn(unreachable_pub)]

mod application;
mod check;
mod child_environment;
mod cli;
mod command;
mod error;
mod executor;
mod remote;
mod rust_file_length;

fn main() -> std::process::ExitCode {
    cli::main()
}
