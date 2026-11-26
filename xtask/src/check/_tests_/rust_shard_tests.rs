//! Repository and native shards: shard 1 runs the checks, and the later shards
//! split the Mokly Rust tests between them.

use std::collections::BTreeSet;
use std::path::PathBuf;
use std::str::FromStr;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::command::{CommandRunnerRunConcurrentlyMock, CommandRunnerRunMock, CommandSpec};
use crate::rust_file_length::RustFileLengthAuditorRunMock;

use super::commands::commands_for;
use super::request::{CheckRequest, DependencyAudit, Shard, VerificationSuite};
use super::runner::{CheckRunner, DefaultCheckRunner};

const NEXTEST: &str = "cargo nextest run --locked -p \"mokly-*\" -p xtask";
const SHARD: &str = "cargo xtask rust-test-shard --partition";
const DOC: &str = "cargo test --locked -p \"mokly-*\" -p xtask --doc";
const CLIPPY: &str = "cargo clippy --locked -p \"mokly-*\" -p xtask --all-targets -- -D warnings";
const BUILDS: [&str; 7] = [
    "node xtask/scripts/require-nextest.mjs",
    "cargo xtask build-native",
    "npm run build --workspace \"@mokly/ui\"",
    "npm run build --workspace \"@mokly/model\"",
    "npm run build --workspace \"@mokly/frame\"",
    "npm run build --workspace \"@mokly/viewer\"",
    "npm run build --workspace \"@mokly/mokly\"",
];

fn display(suite: VerificationSuite, shard: Option<&str>) -> Vec<String> {
    let shard = shard.map(|shard| Shard::from_str(shard).unwrap());
    CheckRequest::new(Some(suite), shard, None).unwrap();
    commands_for(suite, shard, DependencyAudit::Baseline)
        .iter()
        .map(CommandSpec::display)
        .collect()
}

/// What a test shard runs before its tests: the library shard runs only the
/// nextest preflight, and every other test shard installs and builds first.
#[derive(Clone, Copy)]
enum Before {
    Preflight,
    Builds(&'static [&'static str]),
}

/// The commands of one test shard. `scope` is the scope option of the shard
/// command, which the doc tests do not take.
fn test_shard(
    before: Before,
    partition: &str,
    options: &str,
    scope: &str,
    doc: bool,
) -> Vec<String> {
    let commands: Vec<&str> = match before {
        Before::Preflight => BUILDS[..1].to_vec(),
        Before::Builds(first) => first.iter().chain(&BUILDS).copied().collect(),
    };
    let mut expected: Vec<String> = commands.into_iter().map(Into::into).collect();
    expected.push(format!("{SHARD} {partition}{options}{scope}"));
    if doc {
        expected.push(format!("{DOC}{options}"));
    }
    expected
}

/// Native shard 1 runs the lints and the library shard, test partition 1, and
/// each later shard runs the test partition of its own index.
#[test]
fn native_shard_one_lints_and_runs_the_library_shard_and_later_shards_build_and_split_the_rest() {
    let native = VerificationSuite::Native;
    let options = " --no-fail-fast";
    let lints = ["cargo fmt --all -- --check".to_owned(), CLIPPY.to_owned()];
    let library = test_shard(Before::Preflight, "1/3", options, " --native", true);
    assert_eq!(
        display(native, Some("1/3")),
        [&lints[..], &library[..]].concat()
    );
    assert_eq!(
        display(native, Some("2/3")),
        test_shard(Before::Builds(&[]), "2/3", options, " --native", false)
    );
    assert_eq!(
        display(native, Some("3/3")),
        test_shard(Before::Builds(&[]), "3/3", options, " --native", false)
    );
    assert_eq!(display(native, Some("1/1")), display(native, None));
}

#[test]
fn repository_shard_one_checks_and_later_shards_split_the_tests_and_only_the_library_shard_skips_the_builds()
 {
    let repository = VerificationSuite::Repository;
    let checks = display(repository, Some("1/3"));
    assert_eq!(
        checks.first().map(String::as_str),
        Some("npm run dependencies:check -- --baseline")
    );
    assert!(checks.iter().any(|command| command == CLIPPY));
    assert!(
        !checks
            .iter()
            .any(|command| BUILDS.contains(&command.as_str()))
    );
    assert!(!checks.iter().any(|command| {
        [NEXTEST, SHARD, DOC]
            .iter()
            .any(|prefix| command.starts_with(prefix))
    }));
    assert_eq!(
        display(repository, Some("2/3")),
        test_shard(Before::Preflight, "1/2", "", "", true)
    );
    assert_eq!(
        display(repository, Some("3/3")),
        test_shard(Before::Builds(&["npm ci"]), "2/2", "", "", false)
    );
    assert_eq!(display(repository, Some("1/1")), display(repository, None));
}

/// Every command of the complete suite runs on some shard. The test shards
/// replace the complete nextest run with each test partition exactly once.
#[test]
fn the_shards_of_a_suite_run_every_command_and_test_partition_of_the_complete_suite() {
    for suite in [VerificationSuite::Repository, VerificationSuite::Native] {
        let complete: BTreeSet<_> = display(suite, None)
            .into_iter()
            .filter(|command| !command.starts_with(NEXTEST))
            .collect();
        for total in 2..=7_u64 {
            let mut covered = BTreeSet::new();
            let mut partitions = Vec::new();
            for index in 1..=total {
                for command in display(suite, Some(&format!("{index}/{total}"))) {
                    match command.strip_prefix(&format!("{SHARD} ")) {
                        Some(partition) => partitions.push(
                            partition
                                .replace(" --no-fail-fast", "")
                                .replace(" --native", ""),
                        ),
                        None => {
                            covered.insert(command);
                        }
                    }
                }
            }
            let missing: Vec<_> = complete.difference(&covered).collect();
            assert!(
                missing.is_empty(),
                "{suite} {total} shards miss {missing:?}"
            );
            // Repository shard 1 runs no test partition; native shard 1 runs
            // the first one.
            let expected: Vec<_> = match suite {
                VerificationSuite::Native => (1..=total)
                    .map(|index| format!("{index}/{total}"))
                    .collect(),
                _ => (1..total)
                    .map(|index| format!("{index}/{}", total - 1))
                    .collect(),
            };
            assert_eq!(partitions, expected, "{suite} with {total} shards");
        }
    }
}

/// An auditor or a lane runner without mocks panics when a shard calls it.
#[test]
fn only_the_checks_shard_of_the_repository_audits_rust_file_length() {
    let run = || {
        CommandRunnerRunMock
            .each_call(matching!(_))
            .answers(&|_, _| Ok(()))
    };
    let checks = DefaultCheckRunner::new(
        Arc::new(Unimock::new((
            run(),
            CommandRunnerRunConcurrentlyMock
                .each_call(matching!(_))
                .answers(&|_, _| Ok(())),
        ))),
        Arc::new(Unimock::new(
            RustFileLengthAuditorRunMock
                .next_call(matching!(_))
                .returns(Ok(())),
        )),
        PathBuf::from("/workspace"),
    );
    let tests = DefaultCheckRunner::new(
        Arc::new(Unimock::new(run())),
        Arc::new(Unimock::new(())),
        PathBuf::from("/workspace"),
    );
    for (runner, shard) in [(&checks, "1/3"), (&tests, "2/3"), (&tests, "3/3")] {
        let shard = Shard::from_str(shard).unwrap();
        runner
            .run(CheckRequest::new(Some(VerificationSuite::Repository), Some(shard), None).unwrap())
            .unwrap();
    }
}
