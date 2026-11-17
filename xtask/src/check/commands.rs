//! Pure command definitions shared by selected and complete checks.

use crate::command::CommandSpec;

use super::cloud_commands::cloud_commands;
use super::request::{DependencyAudit, Shard, VerificationSuite};

/// Commands in dependency order for one validated suite.
pub(super) fn commands_for(
    suite: VerificationSuite,
    shard: Option<Shard>,
    dependency_audit: DependencyAudit,
) -> Vec<CommandSpec> {
    match suite {
        VerificationSuite::Repository => repository_commands(dependency_audit),
        VerificationSuite::Viewer => vec![
            npm(&["run", "build"]),
            npm(&["run", "typecheck:ci"]),
            npm(&["run", "test:viewer:prepared"]),
        ],
        VerificationSuite::Browser => vec![npm(&["run", "build"]), browser_test_command(shard)],
        VerificationSuite::Native => vec![
            cargo(&["xtask", "build-native"]),
            cargo(&["fmt", "--all", "--", "--check"]),
            rust_clippy(),
            npm(&["run", "build", "--workspace", "@mokly/ui"]),
            npm(&["run", "build", "--workspace", "@mokly/model"]),
            npm(&["run", "build", "--workspace", "@mokly/frame"]),
            npm(&["run", "build", "--workspace", "@mokly/viewer"]),
            npm(&["run", "build", "--workspace", "@mokly/mokly"]),
            mokly_cargo("test").args(["--no-fail-fast"]),
        ],
        cloud => cloud_commands(cloud, shard),
    }
}

/// Run the already-built browser suite, optionally selecting one shard.
pub(super) fn browser_test_command(shard: Option<Shard>) -> CommandSpec {
    let mut test = npm(&["run", "test:browser:prepared"]);
    if let Some(shard) = shard {
        test = test.args(["--".to_owned(), "--shard".to_owned(), shard.to_string()]);
    }
    test
}

fn repository_commands(dependency_audit: DependencyAudit) -> Vec<CommandSpec> {
    let audit = match dependency_audit {
        DependencyAudit::Baseline => npm(&["run", "dependencies:check", "--", "--baseline"]),
        DependencyAudit::Strict => npm(&["run", "dependencies:check"]),
    };
    vec![
        audit,
        npm(&["ci"]),
        npm(&["run", "dependencies:check:rust"]),
        cargo(&["xtask", "boundary"]),
        cargo(&["xtask", "whitespace"]),
        cargo(&["xtask", "check-generated-types"]),
        npm(&["run", "format:check"]),
        npm(&["run", "lint"]),
        CommandSpec::new("node_modules/.bin/ast-grep").args(["test", "--skip-snapshot-tests"]),
        CommandSpec::new("node_modules/.bin/ast-grep")
            .args(["scan", "crates", "xtask", "packages", "apps"]),
        node(&[
            "--test",
            "xtask/scripts/boundary-imports.test.mjs",
            "xtask/scripts/strict-command.test.mjs",
            "xtask/scripts/isolated-postgres.test.mjs",
        ]),
        CommandSpec::new("node").args(["scripts/verification/source-file-length.mjs"]),
        node(&["scripts/verification/repository-ratchets.mjs"]),
        cargo(&["fmt", "--all", "--", "--check"]),
        rust_clippy(),
        design_matrix_clippy(),
        cargo(&["xtask", "build-native"]),
        npm(&["run", "build", "--workspace", "@mokly/ui"]),
        npm(&["run", "build", "--workspace", "@mokly/model"]),
        npm(&["run", "build", "--workspace", "@mokly/frame"]),
        npm(&["run", "build", "--workspace", "@mokly/viewer"]),
        npm(&["run", "build", "--workspace", "@mokly/mokly"]),
        mokly_cargo("test"),
    ]
}

fn rust_clippy() -> CommandSpec {
    mokly_cargo("clippy").args(["--all-targets", "--", "-D", "warnings"])
}

/// Restrict native and MIT Rust work to the app-independent crates.
fn mokly_cargo(operation: &str) -> CommandSpec {
    cargo(&[operation, "--locked", "-p", "mokly-*", "-p", "xtask"])
}

/// Lint the feature-gated design matrix target that the workspace lint skips.
fn design_matrix_clippy() -> CommandSpec {
    cargo(&[
        "clippy",
        "-p",
        "mokly-cli",
        "--features",
        "design-matrix",
        "--all-targets",
        "--",
        "-D",
        "warnings",
    ])
}

fn npm(args: &[&str]) -> CommandSpec {
    CommandSpec::new("npm").args(args.iter().copied())
}

fn node(args: &[&str]) -> CommandSpec {
    CommandSpec::new("node").args(args.iter().copied())
}

fn cargo(args: &[&str]) -> CommandSpec {
    CommandSpec::new("cargo").args(args.iter().copied())
}
