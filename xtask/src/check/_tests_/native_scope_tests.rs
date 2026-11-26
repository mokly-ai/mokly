//! The native scope leaves out the listed platform-neutral tests: whole test
//! units when every package's binary is listed, and the other listed tests
//! through a nextest filter.

use std::collections::BTreeSet;
use std::path::PathBuf;
use std::str::FromStr;
use std::sync::{Arc, Mutex};

use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::command::{CommandRunnerOutputMock, CommandRunnerRunMock, CommandSpec};

use super::native_scope::TestScope;
use super::request::Shard;
use super::runner::{CheckRunner, DefaultCheckRunner};
use super::rust_partition::Weights;
use super::rust_targets::TestUnit;

const NEXTEST: &str = "cargo nextest run --locked -p \"mokly-*\" -p xtask";

fn packages(names: &[&str]) -> BTreeSet<String> {
    names.iter().map(|name| (*name).to_owned()).collect()
}

fn test(name: &str) -> TestUnit {
    TestUnit::Test(name.into())
}

#[test]
fn the_native_scope_leaves_out_a_unit_only_when_every_package_binary_is_listed() {
    let native = TestScope::Native;
    let cli = packages(&["mokly-cli"]);
    assert!(native.leaves_out(&test("changes_containment_tests"), &cli));
    assert!(native.leaves_out(&test("scale_engine_tests"), &packages(&["mokly-compare"])));
    assert!(!native.leaves_out(
        &test("changes_containment_tests"),
        &packages(&["mokly-cli", "mokly-a"])
    ));
    assert!(!native.leaves_out(
        &test("changes_containment_tests"),
        &packages(&["mokly-compare"])
    ));
    assert!(!native.leaves_out(&test("changes_parent_death_tests"), &cli));
    assert!(!native.leaves_out(&test("integration_tests"), &packages(&["mokly-render"])));
    assert!(!native.leaves_out(&TestUnit::Libraries, &cli));
    assert!(!native.leaves_out(&TestUnit::Binary("changes_containment_tests".into()), &cli));
    assert!(!TestScope::Complete.leaves_out(&test("changes_containment_tests"), &cli));
}

#[test]
fn only_the_native_scope_filters_listed_binaries_modules_and_tests() {
    assert!(TestScope::Complete.nextest_args().is_empty());
    let args = TestScope::Native.nextest_args();
    let [flag, filter] = args.as_slice() else {
        panic!("expected one filterset option, got {args:?}");
    };
    assert_eq!(flag, "-E");
    assert!(filter.starts_with("not (binary_id(=mokly-cli::changes_containment_tests) | "));
    assert!(filter.contains(" | (binary_id(=mokly-render::integration_tests) & test(/^integration::containment_tests::/)) | "));
    assert!(filter.contains(
        " | (binary_id(=mokly-static) & test(=assembly_tests::rejects_a_current_index_above_the_output_file_limit))"
    ));
    assert!(!filter.contains("mokly-cli::changes_parent_death_tests"));
    assert!(
        !filter.contains("mokly-render::integration_tests) & test(/^integration::watch_tests::/)")
    );
}

/// A CLI package whose `changes_containment_tests` binary is listed and whose
/// `build_tests` binary is not, a compare package whose listed
/// `scale_engine_tests` unit leaves as a whole, and a third package whose
/// unlisted binary keeps the `changes_containment_tests` unit.
fn metadata() -> String {
    let target = |kind: &str, name: &str| json!({ "name": name, "kind": [kind], "test": true });
    json!({
        "workspace_members": ["cli", "compare", "other"],
        "packages": [
            { "id": "cli", "name": "mokly-cli", "targets": [
                target("lib", "mokly_cli"),
                target("test", "changes_containment_tests"),
                target("test", "build_tests"),
            ]},
            { "id": "compare", "name": "mokly-compare", "targets": [target("test", "scale_engine_tests")] },
            { "id": "other", "name": "mokly-other", "targets": [target("test", "changes_containment_tests")] },
        ],
        "resolve": { "nodes": [
            { "id": "cli", "features": [] },
            { "id": "compare", "features": [] },
            { "id": "other", "features": [] },
        ]},
    })
    .to_string()
}

/// The nextest commands of shard 1/1 of a scope over the fixture metadata.
fn shard_commands(scope: TestScope) -> Vec<String> {
    let observed = Arc::new(Mutex::new(Vec::new()));
    let captured = observed.clone();
    let runner = DefaultCheckRunner::new(
        Arc::new(Unimock::new((
            CommandRunnerOutputMock
                .next_call(matching!(_))
                .answers(&|_, _| Ok(metadata())),
            CommandRunnerRunMock
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, command: &CommandSpec| {
                    captured.lock().unwrap().push(command.display());
                    Ok(())
                })),
        ))),
        Arc::new(Unimock::new(())),
        PathBuf::from("/workspace"),
    )
    .with_rust_test_weights(
        Weights::parse(
            r#"{"defaultSeconds": 1, "docSeconds": 0, "compileSeconds": {}, "testSeconds": {}}"#,
        )
        .unwrap(),
    );
    runner
        .rust_test_shard(Shard::from_str("1/1").unwrap(), false, scope)
        .unwrap();
    observed.lock().unwrap().clone()
}

#[test]
fn a_native_shard_drops_units_that_leave_as_a_whole_and_filters_the_rest() {
    let targets = "--lib --test build_tests --test changes_containment_tests";
    let [native] = shard_commands(TestScope::Native).try_into().unwrap();
    let filter = CommandSpec::new("x")
        .args(TestScope::Native.nextest_args())
        .display();
    let filter = filter.strip_prefix("x ").unwrap();
    assert_eq!(native, format!("{NEXTEST} {filter} {targets}"));
    assert_eq!(
        shard_commands(TestScope::Complete),
        [format!("{NEXTEST} {targets} --test scale_engine_tests")]
    );
}
