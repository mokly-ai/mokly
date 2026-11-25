//! Weighted partition of the Mokly Rust test units into test shards.

use std::cmp::Reverse;
use std::collections::{BTreeMap, BTreeSet};

use serde::Deserialize;

use crate::error::{ErrorResultExt, Result};

use super::request::Shard;
use super::rust_targets::TestUnit;

/// The measured unit weights, embedded when xtask builds.
const WEIGHTS: &str = include_str!("../../../scripts/verification/rust-test-weights.json");

/// Measured compile and test seconds of the Rust test units.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(super) struct Weights {
    /// The weight of a unit that `units` does not name, such as a new test.
    default_seconds: u64,
    /// The weight of the doc tests, which the first test shard also runs.
    doc_seconds: u64,
    /// The weight of each unit, keyed by its Cargo target arguments.
    units: BTreeMap<String, u64>,
}

impl Weights {
    /// Parse unit weights from the JSON text of the weight file.
    pub(super) fn parse(text: &str) -> Result<Self> {
        serde_json::from_str(text).context("parse Rust test weights")
    }

    /// Parse the weight file that the build embedded.
    pub(super) fn embedded() -> Result<Self> {
        Self::parse(WEIGHTS)
    }

    fn of(&self, unit: &TestUnit) -> u64 {
        self.units
            .get(&unit.key())
            .copied()
            .unwrap_or(self.default_seconds)
    }
}

/// Assign every unit to exactly one of `total` test shards and return the
/// units of each shard, in shard order. With more shards than units, the
/// shards after the last unit get no units.
///
/// The first shard runs the doc tests and the unit tests of every library,
/// `--lib`. Their builds need each crates.io dependency that any unit needs,
/// so this shard alone can save a complete Rust build cache. Then the
/// heaviest unit goes first, each to the shard with the least weight so far;
/// the lower shard wins a tie. The same units and weights give the same
/// partition on every host.
pub(super) fn partition(
    units: &BTreeSet<TestUnit>,
    weights: &Weights,
    total: u64,
) -> Vec<Vec<TestUnit>> {
    let count = usize::try_from(total)
        .unwrap_or(usize::MAX)
        .min(units.len().saturating_add(1))
        .max(1);
    let mut loads = vec![0_u64; count];
    let mut shards = vec![Vec::new(); count];
    loads[0] = weights.doc_seconds;
    let mut ordered: Vec<_> = units.iter().collect();
    ordered.sort_by_key(|unit| {
        (
            **unit != TestUnit::Libraries,
            Reverse(weights.of(unit)),
            unit.key(),
        )
    });
    for unit in ordered {
        let lightest = if *unit == TestUnit::Libraries {
            0
        } else {
            (0..count).min_by_key(|&index| loads[index]).unwrap_or(0)
        };
        loads[lightest] += weights.of(unit);
        shards[lightest].push(unit.clone());
    }
    for shard in &mut shards {
        shard.sort();
    }
    shards
}

/// The units of one test shard.
pub(super) fn shard_units(
    units: &BTreeSet<TestUnit>,
    weights: &Weights,
    shard: Shard,
) -> Vec<TestUnit> {
    let index = usize::try_from(shard.index() - 1).unwrap_or(usize::MAX);
    partition(units, weights, shard.total())
        .into_iter()
        .nth(index)
        .unwrap_or_default()
}
