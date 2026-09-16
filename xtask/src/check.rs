//! Complete local verification sequence.

use std::sync::Arc;

use crate::command::{CommandRunner, CommandSpec};
use crate::error::Result;

/// Runs the complete repository verification sequence.
pub(crate) trait CheckRunner: Send + Sync {
    /// Run every source, package, example, and Rust gate in dependency order.
    fn run(&self) -> Result<()>;
}

/// Verification implementation backed by an injected command runner.
pub(crate) struct DefaultCheckRunner {
    command_runner: Arc<dyn CommandRunner>,
}

impl DefaultCheckRunner {
    /// Construct the repository check runner.
    pub(crate) fn new(command_runner: Arc<dyn CommandRunner>) -> Self {
        Self { command_runner }
    }
}

impl CheckRunner for DefaultCheckRunner {
    fn run(&self) -> Result<()> {
        for command in commands() {
            self.command_runner.run(&command)?;
        }
        Ok(())
    }
}

fn commands() -> [CommandSpec; 13] {
    [
        npm(&["run", "dependencies:check"]),
        npm(&["run", "format:check"]),
        npm(&["run", "lint"]),
        npm(&["run", "typecheck"]),
        npm(&["test"]),
        npm(&["run", "example:check"]),
        npm(&["run", "package:check"]),
        npm(&["run", "package:smoke"]),
        npm(&["run", "site:check"]),
        npm(&["run", "test:browser"]),
        cargo(&["fmt", "--all", "--", "--check"]),
        cargo(&[
            "clippy",
            "--workspace",
            "--all-targets",
            "--",
            "-D",
            "warnings",
        ]),
        cargo(&["test", "--workspace"]),
    ]
}

fn npm(args: &[&str]) -> CommandSpec {
    CommandSpec::new("npm").args(args.iter().copied())
}

fn cargo(args: &[&str]) -> CommandSpec {
    CommandSpec::new("cargo").args(args.iter().copied())
}

#[cfg(test)]
#[path = "_tests_/check_tests.rs"]
mod check_tests;
