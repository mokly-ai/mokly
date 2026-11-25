//! Rust test shards: the units come from Cargo metadata, and the weighted
//! partition gives every unit to exactly one shard.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::str::FromStr;
use std::sync::Arc;

use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::command::{CommandRunnerOutputMock, CommandRunnerRunMock};

use super::request::Shard;
use super::runner::{CheckRunner, DefaultCheckRunner};
use super::rust_partition::{Weights, partition};
use super::rust_targets::{TestUnit, test_units};

fn target(kind: &str, name: &str) -> serde_json::Value {
    json!({ "name": name, "kind": [kind], "test": true })
}

/// Two Mokly packages and one cloud package, with every kind of target that
/// the default nextest selection includes or leaves out.
fn metadata() -> String {
    json!({ "packages": [
        {
            "name": "mokly-a",
            "features": {},
            "targets": [
                target("lib", "mokly_a"),
                target("bin", "a"),
                target("test", "only_a"),
                target("test", "shared"),
                target("custom-build", "build-script-build"),
            ],
        },
        {
            "name": "xtask",
            "features": { "default": ["extra"], "extra": ["dep:serde"], "matrix": [] },
            "targets": [
                target("lib", "xtask"),
                target("test", "shared"),
                { "name": "gated", "kind": ["test"], "test": true, "required-features": ["matrix"] },
                { "name": "enabled", "kind": ["test"], "test": true, "required-features": ["extra"] },
                { "name": "untested", "kind": ["test"], "test": false },
            ],
        },
        { "name": "mkc-cloud", "features": {}, "targets": [target("test", "cloud")] },
    ]})
    .to_string()
}

fn test(name: &str) -> TestUnit {
    TestUnit::Test(name.into())
}

#[test]
fn units_are_the_default_nextest_targets_of_the_mokly_packages() {
    let expected: BTreeSet<_> = [
        TestUnit::Libraries,
        TestUnit::Binary("a".into()),
        test("enabled"),
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
        partition(&units, &weights, 2),
        [
            vec![TestUnit::Libraries, test("new")],
            vec![test("heavy"), test("light")]
        ]
    );
}

#[test]
fn every_unit_runs_on_exactly_one_shard_for_every_total() {
    let weights = Weights::embedded().unwrap();
    let units: BTreeSet<_> = (0..40)
        .map(|index| test(&format!("unit_{index}")))
        .chain([TestUnit::Libraries, test("integration_tests"), test("cli")])
        .collect();
    for total in 1..=50_u64 {
        let shards = partition(&units, &weights, total);
        let assigned: Vec<_> = shards.iter().flatten().cloned().collect();
        let distinct: BTreeSet<_> = assigned.iter().cloned().collect();
        assert_eq!(assigned.len(), units.len(), "{total} shards repeat a unit");
        assert_eq!(distinct, units, "{total} shards");
    }
}

/// The nextest command of one shard that holds every unit of the fixture.
const ALL_UNITS: &str = "cargo nextest run --locked -p \"mokly-*\" -p xtask --no-fail-fast --lib --bin a --test enabled --test only_a --test shared";

fn runner(runs: bool) -> DefaultCheckRunner {
    let output = CommandRunnerOutputMock
        .next_call(matching!((spec) if spec.display() == "cargo metadata --no-deps --format-version=1 --locked"))
        .answers(&|_, _| Ok(metadata()));
    let mocks = if runs {
        Unimock::new((
            output,
            CommandRunnerRunMock
                .next_call(matching!((spec) if spec.display() == ALL_UNITS && spec.working_directory() == Some(Path::new("/workspace"))))
                .returns(Ok(())),
        ))
    } else {
        Unimock::new(output)
    };
    DefaultCheckRunner::new(
        Arc::new(mocks),
        Arc::new(Unimock::new(())),
        PathBuf::from("/workspace"),
    )
}

#[test]
fn a_test_shard_runs_its_units_beside_the_complete_package_selection() {
    runner(true)
        .rust_test_shard(Shard::from_str("1/1").unwrap(), true)
        .unwrap();
}

/// With more shards than units, a shard without units runs no command, so
/// nextest never runs every test of an empty selection.
#[test]
fn a_test_shard_without_units_runs_nothing() {
    runner(false)
        .rust_test_shard(Shard::from_str("6/6").unwrap(), false)
        .unwrap();
}
