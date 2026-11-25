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

use super::request::Shard;
use super::runner::{CheckRunner, DefaultCheckRunner};
use super::rust_partition::{Piece, Weights, partition};
use super::rust_targets::{TestUnit, test_units};

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
    assert_eq!(test_units(&metadata()).unwrap(), expected);
}

#[test]
fn the_heaviest_units_spread_first_and_unknown_units_take_the_default_weight() {
    let weights = Weights::parse(
        r#"{"defaultSeconds": 2, "docSeconds": 5, "units": {"--test heavy": 10, "--test light": 4, "--lib": 6}}"#,
    )
    .unwrap();
    let units: BTreeSet<_> = [
        test("heavy"),
        test("light"),
        test("new"),
        TestUnit::Libraries,
    ]
    .into();
    assert_eq!(
        whole(partition(&units, &weights, 2)),
        [
            vec![TestUnit::Libraries, test("new")],
            vec![test("heavy"), test("light")]
        ]
    );
}

/// The first shard runs `--lib` also when another shard is lighter, so its
/// build holds every crates.io dependency that the cache must keep.
#[test]
fn the_library_unit_tests_run_on_the_first_shard() {
    let weights = Weights::parse(
        r#"{"defaultSeconds": 1, "docSeconds": 5, "units": {"--test heavy": 10, "--lib": 1}}"#,
    )
    .unwrap();
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
    let weights = Weights::parse(r#"{"defaultSeconds": 1, "docSeconds": 5, "units": {}}"#).unwrap();
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
    let weights = Weights::parse(
        r#"{"defaultSeconds": 1, "docSeconds": 0, "units": {"--test heavy": 10}, "splits": {"--test heavy": 2}}"#,
    )
    .unwrap();
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

/// Every unit runs on exactly one shard, whole or as each of its slices once.
#[test]
fn every_unit_runs_on_exactly_one_shard_for_every_total() {
    let weights = Weights::embedded().unwrap();
    let units: BTreeSet<_> = (0..40)
        .map(|index| test(&format!("unit_{index}")))
        .chain([TestUnit::Libraries, test("integration_tests"), test("cli")])
        .collect();
    for total in 1..=50_u64 {
        let pieces: Vec<_> = partition(&units, &weights, total)
            .into_iter()
            .flatten()
            .collect();
        for unit in &units {
            let mut slices: Vec<_> = pieces
                .iter()
                .filter(|piece| piece.unit == *unit)
                .map(|piece| piece.slice)
                .collect();
            slices.sort();
            let expected: Vec<_> = match slices.first() {
                Some(Some((_, count))) => (1..=*count).map(|index| Some((index, *count))).collect(),
                _ => vec![None],
            };
            assert_eq!(slices, expected, "{unit:?} with {total} shards");
        }
    }
}

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
    .rust_test_shard(Shard::from_str("1/2").unwrap(), true)
    .unwrap();
    runner(
        CommandRunnerRunMock
            .each_call(matching!((spec) if spec.display().starts_with(NEXTEST) && !spec.display().contains("--lib")))
            .answers(&|_, _| Ok(()))
            .at_least_times(1),
    )
    .rust_test_shard(Shard::from_str("2/2").unwrap(), true)
    .unwrap();
}

/// The embedded weights split `integration_tests` in two. One shard runs its
/// whole units in one command and each slice in its own command, and a
/// failed slice does not stop the next one when the shard reports every
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
            .next_call(matching!((spec) if spec.display() == format!("{SLICE}1/2")))
            .answers(&|_, spec| {
                Err(Error::CommandFailed {
                    command: spec.display(),
                    status: "100".into(),
                })
            }),
        CommandRunnerRunMock
            .next_call(matching!((spec) if spec.display() == format!("{SLICE}2/2")))
            .returns(Ok(())),
    ))
    .rust_test_shard(Shard::from_str("1/1").unwrap(), true);
    assert!(matches!(
        failed,
        Err(Error::CommandFailed { command, .. }) if command == format!("{SLICE}1/2")
    ));
}

/// With more shards than units, a shard without units runs no command, so
/// nextest never runs every test of an empty selection.
#[test]
fn a_test_shard_without_units_runs_nothing() {
    runner(())
        .rust_test_shard(Shard::from_str("10/10").unwrap(), false)
        .unwrap();
}
