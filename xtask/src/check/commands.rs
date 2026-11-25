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
        VerificationSuite::Native => native_commands(shard),
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

/// Build the host binary, then run the Rust tests or one nextest partition of
/// them. The unsharded suite and shard 1 also check formatting and Clippy and
/// run the doc tests, so a sharded run checks each of them once. The doc tests
/// also run after failed tests, so one job reports both kinds of failure.
fn native_commands(shard: Option<Shard>) -> Vec<CommandSpec> {
    let first = shard.is_none_or(Shard::is_first);
    let mut commands = vec![require_nextest(), cargo(&["xtask", "build-native"])];
    if first {
        commands.extend([cargo(&["fmt", "--all", "--", "--check"]), rust_clippy()]);
    }
    commands.extend(
        [
            "@mokly/ui",
            "@mokly/model",
            "@mokly/frame",
            "@mokly/viewer",
            "@mokly/mokly",
        ]
        .map(|package| npm(&["run", "build", "--workspace", package])),
    );
    let [mut tests, doc] = mokly_tests(&["--no-fail-fast"]);
    if let Some(shard) = shard {
        tests = tests.args(["--partition".to_owned(), format!("slice:{shard}")]);
    }
    commands.push(tests.keep_going());
    if first {
        commands.push(doc);
    }
    commands
}

fn repository_commands(dependency_audit: DependencyAudit) -> Vec<CommandSpec> {
    let audit = match dependency_audit {
        DependencyAudit::Baseline => npm(&["run", "dependencies:check", "--", "--baseline"]),
        DependencyAudit::Strict => npm(&["run", "dependencies:check"]),
    };
    let mut commands = vec![
        audit,
        npm(&["ci"]),
        npm(&["run", "dependencies:check:rust"]),
        require_nextest(),
        cargo(&["xtask", "boundary"]),
        cargo(&["xtask", "whitespace"]),
        cargo(&["xtask", "check-generated-types"]),
        npm(&["run", "palette:check"]),
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
    ];
    commands.extend(mokly_tests(&[]));
    commands
}

/// Fail early, with install steps, when the Rust test runner is missing.
pub(super) fn require_nextest() -> CommandSpec {
    node(&["xtask/scripts/require-nextest.mjs"])
}

/// Run every Mokly test target in parallel with nextest, then the doc tests,
/// which nextest does not run.
fn mokly_tests(options: &[&str]) -> [CommandSpec; 2] {
    [
        mokly_cargo(&["nextest", "run"]).args(options.iter().copied()),
        mokly_cargo(&["test"])
            .args(["--doc"])
            .args(options.iter().copied()),
    ]
}

fn rust_clippy() -> CommandSpec {
    mokly_cargo(&["clippy"]).args(["--all-targets", "--", "-D", "warnings"])
}

/// Restrict native and MIT Rust work to the app-independent crates.
fn mokly_cargo(operation: &[&str]) -> CommandSpec {
    cargo(operation).args(["--locked", "-p", "mokly-*", "-p", "xtask"])
}

/// Lint the feature-gated design matrix target that the workspace lint skips.
fn design_matrix_clippy() -> CommandSpec {
    cargo(&[
        "clippy",
        "--locked",
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
