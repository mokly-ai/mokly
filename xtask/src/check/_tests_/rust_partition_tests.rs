//! Rust test shards: the units come from Cargo metadata, and the weighted
//! partition gives every unit to exactly one shard.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::str::FromStr;
use std::sync::Arc;

use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::command::{CommandRunnerOutputMock, CommandRunnerRunMock};
use crate::error::Error;

use super::native_scope::TestScope;
use super::request::Shard;
use super::runner::{CheckRunner, DefaultCheckRunner};
use super::rust_partition::{Piece, partition};
use super::rust_targets::{TestUnit, test_units};
use super::rust_weights::{Host, WeightFile, Weights};

fn target(kind: &str, name: &str) -> serde_json::Value {
    json!({ "name": name, "kind": [kind], "test": true })
}

fn package(id: &str, name: &str, targets: Vec<serde_json::Value>) -> serde_json::Value {
    json!({ "id": id, "name": name, "targets": targets })
}

/// Two Mokly workspace packages, one cloud package, and one crates.io package
/// with a Mokly name, with every kind of target that the default nextest
/// selection includes or leaves out. Cargo resolves `extra` for xtask, as a
/// dependency or a dev-dependency can enable it, and leaves `matrix` off. It
/// enables `test-util` of the `tokio-util` dependency of xtask, not `rt`.
fn metadata() -> String {
    json!({
        "workspace_members": ["a", "x", "cloud"],
        "packages": [
            package("a", "mokly-a", vec![
                target("lib", "mokly_a"),
                target("bin", "a"),
                target("test", "only_a"),
                target("test", "shared"),
                target("test", "integration_tests"),
                target("custom-build", "build-script-build"),
            ]),
            package("x", "xtask", vec![
                target("lib", "xtask"),
                target("test", "shared"),
                json!({ "name": "gated", "kind": ["test"], "test": true, "required-features": ["matrix"] }),
                json!({ "name": "enabled", "kind": ["test"], "test": true, "required-features": ["extra"] }),
                json!({ "name": "untested", "kind": ["test"], "test": false }),
                json!({ "name": "dependency_enabled", "kind": ["test"], "test": true, "required-features": ["tokio-util/test-util"] }),
                json!({ "name": "dependency_gated", "kind": ["test"], "test": true, "required-features": ["tokio-util/rt"] }),
            ]),
            package("cloud", "mkc-cloud", vec![target("test", "cloud")]),
            package("registry", "mokly-registry", vec![target("test", "registry")]),
        ],
        "resolve": { "nodes": [
            { "id": "a", "features": [] },
            { "id": "x", "features": ["extra"], "deps": [{ "name": "tokio_util", "pkg": "registry-tokio-util" }] },
            { "id": "registry-tokio-util", "features": ["test-util"] },
            { "id": "cloud", "features": [] },
        ]},
    })
    .to_string()
}

fn test(name: &str) -> TestUnit {
    TestUnit::Test(name.into())
}

/// The whole units of each shard; a slice of a split unit fails the test.
fn whole(shards: Vec<Vec<Piece>>) -> Vec<Vec<TestUnit>> {
    shards
        .into_iter()
        .map(|shard| {
            shard
                .into_iter()
                .map(|piece| {
                    assert_eq!(piece.slice, None, "{piece:?}");
                    piece.unit
                })
                .collect()
        })
        .collect()
}

/// The Linux weights of a weight file.
fn linux(text: &str) -> Weights {
    WeightFile::parse(text).unwrap().host(Host::Linux)
}

#[test]
fn units_are_the_default_nextest_targets_of_the_mokly_packages() {
    let expected: BTreeSet<_> = [
        TestUnit::Libraries,
        TestUnit::Binary("a".into()),
        test("dependency_enabled"),
        test("enabled"),
        test("integration_tests"),
        test("only_a"),
        test("shared"),
    ]
    .into();
    let units = test_units(&metadata()).unwrap();
    assert_eq!(units.keys().cloned().collect::<BTreeSet<_>>(), expected);
    let shared: BTreeSet<_> = ["mokly-a".to_owned(), "xtask".to_owned()].into();
    assert_eq!(units[&test("shared")], shared);
}

/// A unit weighs its compile seconds plus its test seconds, and a part that
/// only the other map names counts zero: here `heavy` weighs 10, `light` 4,
/// and `--lib` 1. The unknown unit `new` takes the default weight of 5. The
/// first shard holds only `--lib`, also when it is the lightest.
#[test]
fn the_heaviest_units_spread_first_and_unknown_units_take_the_default_weight() {
    let weights = linux(
        r#"{"defaultSeconds": 5, "docSeconds": 0, "compileSeconds": {"--test heavy": 6, "--lib": 1}, "testSeconds": {"linux": {"--test heavy": 4, "--test light": 4}}}"#,
    );
    let units: BTreeSet<_> = [
        test("heavy"),
        test("light"),
        test("new"),
        TestUnit::Libraries,
    ]
    .into();
    assert_eq!(
        whole(partition(&units, &weights, 3)),
        [
            vec![TestUnit::Libraries],
            vec![test("heavy")],
            vec![test("light"), test("new")]
        ]
    );
}

/// The first shard runs `--lib` also when another shard is lighter, so its
/// build holds every crates.io dependency that the cache must keep.
#[test]
fn the_library_unit_tests_run_on_the_first_shard() {
    let weights = linux(
        r#"{"defaultSeconds": 1, "docSeconds": 5, "compileSeconds": {"--test heavy": 10, "--lib": 1}, "testSeconds": {}}"#,
    );
    let units: BTreeSet<_> = [test("heavy"), TestUnit::Libraries].into();
    assert_eq!(
        whole(partition(&units, &weights, 2)),
        [vec![TestUnit::Libraries], vec![test("heavy")]]
    );
}

/// The doc test weight of the first shard counts as work, so each unit can
/// still get a shard of its own.
#[test]
fn the_doc_tests_leave_room_for_one_unit_on_each_later_shard() {
    let weights =
        linux(r#"{"defaultSeconds": 1, "docSeconds": 5, "compileSeconds": {}, "testSeconds": {}}"#);
    let units: BTreeSet<_> = [test("a"), test("b")].into();
    assert_eq!(
        whole(partition(&units, &weights, 3)),
        [vec![], vec![test("a")], vec![test("b")]]
    );
}

/// A split unit becomes one piece for each slice, with an equal share of its
/// weight, so the slices of a heavy unit can run on different shards.
#[test]
fn a_split_unit_runs_each_slice_on_its_own_shard() {
    let weights = linux(
        r#"{"defaultSeconds": 1, "docSeconds": 0, "compileSeconds": {}, "testSeconds": {"linux": {"--test heavy": 10}}, "splits": {"--test heavy": 2}}"#,
    );
    let units: BTreeSet<_> = [test("heavy")].into();
    let slice = |index| Piece {
        unit: test("heavy"),
        slice: Some((index, 2)),
    };
    assert_eq!(
        partition(&units, &weights, 2),
        [vec![slice(1)], vec![slice(2)]]
    );
}

/// Fixed weights of the metadata units, the same on every host: `--lib`
/// outweighs every other unit together, so it runs alone on the first of two
/// shards, and `integration_tests` runs as three slices.
const FIXTURE_WEIGHTS: &str = r#"{"defaultSeconds": 1, "docSeconds": 0, "compileSeconds": {"--lib": 100}, "testSeconds": {"linux": {"--test integration_tests": 30}, "macos": {"--test integration_tests": 30}, "windows": {"--test integration_tests": 30}}, "splits": {"--test integration_tests": 3}}"#;

/// A check runner over the metadata units, placed by the fixture weights.
fn runner(run: impl unimock::Clause) -> DefaultCheckRunner {
    let output = CommandRunnerOutputMock
        .next_call(
            matching!((spec) if spec.display() == "cargo metadata --format-version=1 --locked"),
        )
        .answers(&|_, _| Ok(metadata()));
    DefaultCheckRunner::new(
        Arc::new(Unimock::new((output, run))),
        Arc::new(Unimock::new(())),
        PathBuf::from("/workspace"),
    )
    .with_rust_test_weights(WeightFile::parse(FIXTURE_WEIGHTS).unwrap())
}

const NEXTEST: &str = "cargo nextest run --locked -p \"mokly-*\" -p xtask --no-fail-fast";

/// The first of two shards starts with `--lib`, and the second never runs
/// it, so each populated shard adds only its own targets to nextest.
#[test]
fn a_test_shard_runs_only_its_units_beside_the_complete_package_selection() {
    runner(
        CommandRunnerRunMock
            .next_call(matching!((spec) if spec.display().starts_with(&format!("{NEXTEST} --lib")) && spec.working_directory() == Some(Path::new("/workspace"))))
            .returns(Ok(())),
    )
    .rust_test_shard(Shard::from_str("1/2").unwrap(), true, TestScope::Complete)
    .unwrap();
    runner(
        CommandRunnerRunMock
            .each_call(matching!((spec) if spec.display().starts_with(NEXTEST) && !spec.display().contains("--lib")))
            .answers(&|_, _| Ok(()))
            .at_least_times(1),
    )
    .rust_test_shard(Shard::from_str("2/2").unwrap(), true, TestScope::Complete)
    .unwrap();
}

/// The fixture weights split `integration_tests` in three. One shard runs
/// its whole units in one command and each slice in its own command, and a
/// failed slice does not stop the next ones when the shard reports every
/// failure.
#[test]
fn each_slice_of_a_split_unit_runs_in_its_own_command() {
    const WHOLE: &str = "cargo nextest run --locked -p \"mokly-*\" -p xtask --no-fail-fast --lib --bin a --test dependency_enabled --test enabled --test only_a --test shared";
    const SLICE: &str = "cargo nextest run --locked -p \"mokly-*\" -p xtask --no-fail-fast --test integration_tests --partition slice:";
    let failed = runner((
        CommandRunnerRunMock
            .next_call(matching!((spec) if spec.display() == WHOLE))
            .returns(Ok(())),
        CommandRunnerRunMock
            .next_call(matching!((spec) if spec.display() == format!("{SLICE}1/3")))
            .answers(&|_, spec| {
                Err(Error::CommandFailed {
                    command: spec.display(),
                    status: "100".into(),
                })
            }),
        CommandRunnerRunMock
            .next_call(matching!((spec) if spec.display() == format!("{SLICE}2/3")))
            .returns(Ok(())),
        CommandRunnerRunMock
            .next_call(matching!((spec) if spec.display() == format!("{SLICE}3/3")))
            .returns(Ok(())),
    ))
    .rust_test_shard(Shard::from_str("1/1").unwrap(), true, TestScope::Complete);
    assert!(matches!(
        failed,
        Err(Error::CommandFailed { command, .. }) if command == format!("{SLICE}1/3")
    ));
}

/// With more shards than units, a shard without units runs no command, so
/// nextest never runs every test of an empty selection.
#[test]
fn a_test_shard_without_units_runs_nothing() {
    runner(())
        .rust_test_shard(
            Shard::from_str("10/10").unwrap(),
            false,
            TestScope::Complete,
        )
        .unwrap();
}
