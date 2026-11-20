//! API executable composition root.

use std::process::ExitCode;

use crate::cli::{CommandRunner, SystemCommandRunner};

mod cli;
mod cli_maintenance;
mod cli_recovery;

fn main() -> ExitCode {
    let runner: &dyn CommandRunner = &SystemCommandRunner;
    match runner.run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            tracing::error!(?error, "API command failed");
            ExitCode::FAILURE
        }
    }
}
