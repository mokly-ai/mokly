//! Pure command definitions shared by selected and complete checks.

use crate::command::CommandSpec;

use super::request::{DependencyAudit, Shard, VerificationSuite};

/// One step of a suite: a subprocess or an in-process audit.
#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) enum Step {
    /// Run one subprocess at the workspace root.
    Command(CommandSpec),
    /// Audit the length of changed source and protocol files.
    SourceFileLength,
    /// Run the protocol cap ratchet, then the Node ratchet runner, and fail
    /// after both when either fails.
    Ratchets(CommandSpec),
}

/// Steps in dependency order for one validated suite.
pub(super) fn commands_for(
    suite: VerificationSuite,
    shard: Option<Shard>,
    dependency_audit: DependencyAudit,
) -> Vec<Step> {
    match suite {
        VerificationSuite::Repository => repository_steps(dependency_audit),
        VerificationSuite::Viewer => commands(vec![
            npm(&["run", "build"]),
            npm(&["run", "typecheck"]),
            npm(&["run", "test:viewer:prepared"]),
        ]),
        VerificationSuite::Browser => {
            commands(vec![npm(&["run", "build"]), browser_test_command(shard)])
        }
        VerificationSuite::Native => commands(vec![
            cargo(&["xtask", "build-native"]),
            cargo(&["fmt", "--all", "--", "--check"]),
            rust_clippy(),
            npm(&["run", "build", "--workspace", "@mokly/viewer"]),
            npm(&["run", "build", "--workspace", "@mokly/mokly"]),
            cargo(&["test", "--workspace", "--no-fail-fast"]),
        ]),
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

fn repository_steps(dependency_audit: DependencyAudit) -> Vec<Step> {
    let audit = match dependency_audit {
        DependencyAudit::Baseline => npm(&["run", "dependencies:check", "--", "--baseline"]),
        DependencyAudit::Strict => npm(&["run", "dependencies:check"]),
    };
    let mut steps = commands(vec![
        audit,
        npm(&["run", "dependencies:check:rust"]),
        cargo(&["xtask", "check-generated-types"]),
        npm(&["run", "format:check"]),
        npm(&["run", "lint"]),
    ]);
    steps.push(Step::SourceFileLength);
    steps.push(Step::Ratchets(node(&[
        "scripts/verification/repository-ratchets.mjs",
    ])));
    steps.extend(commands(vec![
        cargo(&["fmt", "--all", "--", "--check"]),
        rust_clippy(),
        design_matrix_clippy(),
        npm(&["run", "build", "--workspace", "@mokly/viewer"]),
        npm(&["run", "build", "--workspace", "@mokly/mokly"]),
        cargo(&["test", "--workspace"]),
    ]));
    steps
}

fn commands(commands: Vec<CommandSpec>) -> Vec<Step> {
    commands.into_iter().map(Step::Command).collect()
}

fn rust_clippy() -> CommandSpec {
    cargo(&[
        "clippy",
        "--workspace",
        "--all-targets",
        "--",
        "-D",
        "warnings",
    ])
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
