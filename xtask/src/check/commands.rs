//! Pure command definitions shared by selected and complete checks.

use crate::command::CommandSpec;

use super::request::{DependencyAudit, Shard, VerificationSuite};

/// Commands in dependency order for one validated suite.
pub(super) fn commands_for(
    suite: VerificationSuite,
    _shard: Option<Shard>,
    dependency_audit: DependencyAudit,
) -> Vec<CommandSpec> {
    match suite {
        VerificationSuite::Repository => repository_commands(dependency_audit),
        VerificationSuite::Viewer => vec![
            npm(&["run", "build"]),
            npm(&["run", "typecheck"]),
            npm(&["run", "test:viewer:prepared"]),
        ],
        VerificationSuite::Native => vec![
            cargo(&["xtask", "build-native"]),
            cargo(&["fmt", "--all", "--", "--check"]),
            rust_clippy(),
            npm(&["run", "build", "--workspace", "@mokly/viewer"]),
            npm(&["run", "build", "--workspace", "@mokly/mokly"]),
            cargo(&["test", "--workspace"]),
        ],
    }
}

fn repository_commands(dependency_audit: DependencyAudit) -> Vec<CommandSpec> {
    let audit = match dependency_audit {
        DependencyAudit::Baseline => npm(&["run", "dependencies:check", "--", "--baseline"]),
        DependencyAudit::Strict => npm(&["run", "dependencies:check"]),
    };
    vec![
        audit,
        npm(&["run", "format:check"]),
        npm(&["run", "lint"]),
        CommandSpec::new("node").args(["scripts/verification/source-file-length.mjs"]),
        node(&["scripts/verification/repository-ratchets.mjs"]),
        cargo(&["fmt", "--all", "--", "--check"]),
        rust_clippy(),
        npm(&["run", "build", "--workspace", "@mokly/viewer"]),
        npm(&["run", "build", "--workspace", "@mokly/mokly"]),
        cargo(&["test", "--workspace"]),
    ]
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

fn npm(args: &[&str]) -> CommandSpec {
    CommandSpec::new("npm").args(args.iter().copied())
}

fn node(args: &[&str]) -> CommandSpec {
    CommandSpec::new("node").args(args.iter().copied())
}

fn cargo(args: &[&str]) -> CommandSpec {
    CommandSpec::new("cargo").args(args.iter().copied())
}
