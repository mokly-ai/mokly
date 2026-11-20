//! Standalone catalogue executable composition root.

use std::process::ExitCode;

use crate::cli::{CommandRunner, SystemCommandRunner};

mod cli;

fn main() -> ExitCode {
    let runner: &dyn CommandRunner = &SystemCommandRunner;
    match runner.run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            tracing::error!(?error, "catalogue command failed");
            ExitCode::FAILURE
        }
    }
}
