//! Development GitHub double executable composition root.

use std::process::ExitCode;

use crate::cli::{CommandRunner, SystemCommandRunner};

mod cli;

fn main() -> ExitCode {
    let runner: &dyn CommandRunner = &SystemCommandRunner;
    match runner.run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            tracing::error!(?error, "recorded GitHub command failed");
            ExitCode::FAILURE
        }
    }
}
