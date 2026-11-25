//! Rust check, build, and test commands of the repository and native suites.

use crate::command::CommandSpec;

use super::request::Shard;

/// Leading shards of a sharded repository or native suite that run checks
/// instead of Rust tests.
const CHECK_SHARDS: u64 = 1;

/// The JavaScript packages that the Mokly Rust tests run, in build order.
const PACKAGES: [&str; 5] = [
    "@mokly/ui",
    "@mokly/model",
    "@mokly/frame",
    "@mokly/viewer",
    "@mokly/mokly",
];

/// The part of a repository or native suite that one selection runs.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) enum RustPart {
    /// No shard, or one shard of one: the complete suite.
    Complete,
    /// Shard 1 of several: every check of the suite except the Rust tests.
    Checks,
    /// A later shard: one weighted share of the Mokly Rust test units.
    Tests(Shard),
}

impl RustPart {
    /// Select the part of a repository or native suite for an optional shard.
    pub(super) fn of(shard: Option<Shard>) -> Self {
        match shard.filter(|shard| shard.total() > 1) {
            None => Self::Complete,
            Some(shard) => shard.after(CHECK_SHARDS).map_or(Self::Checks, Self::Tests),
        }
    }

    /// Whether this part runs the checks that are not Rust tests.
    pub(super) fn runs_checks(self) -> bool {
        !matches!(self, Self::Tests(_))
    }
}

/// Build the host binary and the JavaScript packages that the Rust tests run.
pub(super) fn test_builds() -> Vec<CommandSpec> {
    let mut commands = vec![build_native()];
    commands.extend(package_builds());
    commands
}

fn build_native() -> CommandSpec {
    cargo(&["xtask", "build-native"])
}

fn package_builds() -> [CommandSpec; 5] {
    PACKAGES.map(|package| npm(&["run", "build", "--workspace", package]))
}

/// Build the inputs of the Rust tests, then run the test units of one test
/// shard. The first test shard also runs the doc tests.
pub(super) fn test_shard(shard: Shard, no_fail_fast: bool) -> Vec<CommandSpec> {
    let [_, doc] = rust_tests(no_fail_fast);
    let mut tests = cargo(&["xtask", "rust-test-shard", "--partition"]).args([shard.to_string()]);
    if no_fail_fast {
        tests = tests.args(["--no-fail-fast"]).keep_going();
    }
    let mut commands = vec![require_nextest()];
    commands.extend(test_builds());
    commands.push(tests);
    if shard.is_first() {
        commands.push(doc);
    }
    commands
}

/// Run every Mokly test target in parallel with nextest, then the doc tests,
/// which nextest does not run. With `no_fail_fast`, both commands report
/// every failure, and the doc tests run after failed tests.
pub(super) fn rust_tests(no_fail_fast: bool) -> [CommandSpec; 2] {
    let tests = nextest(&[], no_fail_fast);
    let doc = mokly_cargo(&["test"])
        .args(["--doc"])
        .args(fail_fast_options(no_fail_fast).iter().copied());
    [tests, doc]
}

/// Run the given Cargo target selections of the Mokly packages with nextest.
/// Every shard selects the same packages, so Cargo resolves the same
/// dependency features as the complete suite.
pub(super) fn nextest(targets: &[String], no_fail_fast: bool) -> CommandSpec {
    let tests = mokly_cargo(&["nextest", "run"])
        .args(fail_fast_options(no_fail_fast).iter().copied())
        .args(targets.iter().cloned());
    if no_fail_fast {
        tests.keep_going()
    } else {
        tests
    }
}

fn fail_fast_options(no_fail_fast: bool) -> &'static [&'static str] {
    if no_fail_fast {
        &["--no-fail-fast"]
    } else {
        &[]
    }
}

/// Read the targets and the resolved features of every workspace package
/// without building them.
pub(super) fn cargo_metadata() -> CommandSpec {
    cargo(&["metadata", "--format-version=1", "--locked"])
}

/// Build the host binary, then run the Rust tests. A sharded suite runs the
/// formatting and Clippy checks on shard 1 and one weighted share of the test
/// units on each later shard; the first test shard also runs the doc tests.
/// The doc tests also run after failed tests, so one job reports both kinds
/// of failure.
pub(super) fn native_commands(shard: Option<Shard>) -> Vec<CommandSpec> {
    match RustPart::of(shard) {
        RustPart::Complete => {
            let mut commands = vec![require_nextest(), build_native()];
            commands.extend(rust_lints());
            commands.extend(package_builds());
            commands.extend(rust_tests(true));
            commands
        }
        RustPart::Checks => rust_lints().into(),
        RustPart::Tests(tests) => test_shard(tests, true),
    }
}

/// Check Rust formatting of every crate, then run Clippy for the Mokly crates.
pub(super) fn rust_lints() -> [CommandSpec; 2] {
    [cargo(&["fmt", "--all", "--", "--check"]), rust_clippy()]
}

/// Fail early, with install steps, when the Rust test runner is missing.
pub(super) fn require_nextest() -> CommandSpec {
    CommandSpec::new("node").args(["xtask/scripts/require-nextest.mjs"])
}

/// Lint the feature-gated design matrix target that the workspace lint skips.
pub(super) fn design_matrix_clippy() -> CommandSpec {
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

fn rust_clippy() -> CommandSpec {
    mokly_cargo(&["clippy"]).args(["--all-targets", "--", "-D", "warnings"])
}

/// Restrict native and MIT Rust work to the app-independent crates.
fn mokly_cargo(operation: &[&str]) -> CommandSpec {
    cargo(operation).args(["--locked", "-p", "mokly-*", "-p", "xtask"])
}

fn npm(args: &[&str]) -> CommandSpec {
    CommandSpec::new("npm").args(args.iter().copied())
}

fn cargo(args: &[&str]) -> CommandSpec {
    CommandSpec::new("cargo").args(args.iter().copied())
}
