//! Complete and independently selectable verification suites.

use std::fmt;
use std::path::PathBuf;
use std::str::FromStr;
use std::sync::Arc;

use clap::ValueEnum;

use crate::command::{CommandRunner, CommandSpec};
use crate::error::{Error, Result};
use crate::rust_file_length::RustFileLengthAuditor;

const PACKAGE_ARTIFACTS: &str = ".context/verification/package-artifacts";
/// Largest shard value that Node and Playwright can represent exactly.
const MAX_JAVASCRIPT_SAFE_INTEGER: u64 = 9_007_199_254_740_991;

/// Independently executable verification ownership areas.
#[derive(Clone, Copy, Debug, Eq, PartialEq, ValueEnum)]
pub(crate) enum VerificationSuite {
    /// Audit, formatting, lint, and Rust verification.
    Repository,
    /// Declarations, example, package inspection, and packed consumers.
    Package,
    /// Node unit and integration tests.
    Unit,
    /// Playwright browser tests.
    Browser,
}

impl VerificationSuite {
    /// Suites in authoritative complete-gate order.
    pub(crate) const ALL: [Self; 4] = [Self::Repository, Self::Package, Self::Unit, Self::Browser];

    /// Stable CLI name for the suite.
    pub(crate) const fn as_str(self) -> &'static str {
        match self {
            Self::Repository => "repository",
            Self::Package => "package",
            Self::Unit => "unit",
            Self::Browser => "browser",
        }
    }

    fn supports_shards(self) -> bool {
        matches!(self, Self::Unit | Self::Browser)
    }
}

impl fmt::Display for VerificationSuite {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

/// One-based whole-file shard selection.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct Shard {
    index: u64,
    total: u64,
}

impl fmt::Display for Shard {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{}/{}", self.index, self.total)
    }
}

impl FromStr for Shard {
    type Err = Error;

    fn from_str(value: &str) -> Result<Self> {
        let Some((index, total)) = value.split_once('/') else {
            return Err(invalid_shard(value));
        };
        if total.contains('/') {
            return Err(invalid_shard(value));
        }
        let Ok(index) = index.parse::<u64>() else {
            return Err(invalid_shard(value));
        };
        let Ok(total) = total.parse::<u64>() else {
            return Err(invalid_shard(value));
        };
        if index == 0
            || total == 0
            || index > total
            || index > MAX_JAVASCRIPT_SAFE_INTEGER
            || total > MAX_JAVASCRIPT_SAFE_INTEGER
        {
            return Err(invalid_shard(value));
        }
        Ok(Self { index, total })
    }
}

/// Validated complete or partial verification selection.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct CheckRequest {
    suite: Option<VerificationSuite>,
    shard: Option<Shard>,
}

impl CheckRequest {
    /// Validate suite and shard compatibility before subprocesses start.
    pub(crate) fn new(suite: Option<VerificationSuite>, shard: Option<Shard>) -> Result<Self> {
        if shard.is_some() {
            let Some(suite) = suite else {
                return Err(Error::ShardRequiresSuite);
            };
            if !suite.supports_shards() {
                return Err(Error::UnsupportedShard { suite });
            }
        }
        Ok(Self { suite, shard })
    }
}

/// Runs complete or selected repository verification.
pub(crate) trait CheckRunner: Send + Sync {
    /// Execute the validated request in dependency order.
    fn run(&self, request: CheckRequest) -> Result<()>;
}

/// Verification implementation backed by injected side-effect boundaries.
pub(crate) struct DefaultCheckRunner {
    command_runner: Arc<dyn CommandRunner>,
    rust_file_length_auditor: Arc<dyn RustFileLengthAuditor>,
    workspace: PathBuf,
}

impl DefaultCheckRunner {
    /// Construct the repository check runner.
    pub(crate) fn new(
        command_runner: Arc<dyn CommandRunner>,
        rust_file_length_auditor: Arc<dyn RustFileLengthAuditor>,
        workspace: PathBuf,
    ) -> Self {
        Self {
            command_runner,
            rust_file_length_auditor,
            workspace,
        }
    }

    fn run_suite(&self, suite: VerificationSuite, shard: Option<Shard>) -> Result<()> {
        for command in commands_for(suite, shard) {
            self.command_runner.run(&command)?;
        }
        if suite == VerificationSuite::Repository {
            self.rust_file_length_auditor.run(&self.workspace)?;
        }
        Ok(())
    }
}

impl CheckRunner for DefaultCheckRunner {
    fn run(&self, request: CheckRequest) -> Result<()> {
        if let Some(suite) = request.suite {
            return self.run_suite(suite, request.shard);
        }
        self.command_runner
            .run(&npm(&["run", "dependencies:check"]))?;
        match self
            .command_runner
            .run(&CommandSpec::new("node").args(["scripts/verification/local-check.mjs"]))
        {
            Ok(()) => Ok(()),
            Err(Error::CommandFailed { status, .. }) if status == "75" => {
                eprintln!("Local snapshots unavailable; running the full sequential gate");
                for suite in VerificationSuite::ALL {
                    self.run_suite(suite, None)?;
                }
                Ok(())
            }
            Err(error) => Err(error),
        }
    }
}

fn commands_for(suite: VerificationSuite, shard: Option<Shard>) -> Vec<CommandSpec> {
    match suite {
        VerificationSuite::Repository => repository_commands(),
        VerificationSuite::Package => package_commands(),
        VerificationSuite::Unit => prepared_suite("test:prepared", shard),
        VerificationSuite::Browser => prepared_suite("test:browser:prepared", shard),
    }
}

fn repository_commands() -> Vec<CommandSpec> {
    vec![
        npm(&["run", "dependencies:check"]),
        npm(&["run", "format:check"]),
        npm(&["run", "lint"]),
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

fn package_commands() -> Vec<CommandSpec> {
    vec![
        npm(&["run", "prepare:verification"]),
        npm(&["run", "typecheck:prepared"]),
        npm(&["run", "example:check"]),
        npm(&["run", "package:artifacts", "--", "--out", PACKAGE_ARTIFACTS]),
        npm(&[
            "run",
            "package:check:prepared",
            "--",
            "--artifacts",
            PACKAGE_ARTIFACTS,
        ]),
        npm(&[
            "run",
            "package:smoke:prepared",
            "--",
            "--artifacts",
            PACKAGE_ARTIFACTS,
        ]),
    ]
}

fn prepared_suite(script: &str, shard: Option<Shard>) -> Vec<CommandSpec> {
    let mut command = npm(&["run", script]);
    if let Some(shard) = shard {
        command = command.args(["--", "--shard", &shard.to_string()]);
    }
    vec![npm(&["run", "prepare:verification"]), command]
}

fn invalid_shard(shard: &str) -> Error {
    Error::InvalidShard {
        shard: shard.to_owned(),
    }
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
