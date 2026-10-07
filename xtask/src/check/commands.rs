//! Pure command definitions shared by selected and complete checks.

use crate::command::CommandSpec;

use super::request::{DependencyAudit, Shard, VerificationSuite};

const PACKAGE_ARTIFACTS: &str = ".context/verification/package-artifacts";

/// Commands in dependency order for one validated suite.
pub(super) fn commands_for(
    suite: VerificationSuite,
    shard: Option<Shard>,
    dependency_audit: DependencyAudit,
) -> Vec<CommandSpec> {
    match suite {
        VerificationSuite::Repository => repository_commands(dependency_audit),
        VerificationSuite::Package => package_commands(),
        VerificationSuite::Unit => prepared_suite("test:prepared", shard),
        VerificationSuite::Browser => prepared_suite("test:browser:prepared", shard),
        VerificationSuite::Hydration => prepared_suite("test:hydration:prepared", shard),
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

fn npm(args: &[&str]) -> CommandSpec {
    CommandSpec::new("npm").args(args.iter().copied())
}

fn node(args: &[&str]) -> CommandSpec {
    CommandSpec::new("node").args(args.iter().copied())
}

fn cargo(args: &[&str]) -> CommandSpec {
    CommandSpec::new("cargo").args(args.iter().copied())
}
