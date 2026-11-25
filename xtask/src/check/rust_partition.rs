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
    /// The number of nextest slices of a heavy unit, keyed like `units`. Each
    /// slice is one piece with an equal share of the unit's weight. `--lib`
    /// never splits.
    #[serde(default)]
    splits: BTreeMap<String, u64>,
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

    /// The pieces of one unit and the weight of each piece.
    fn pieces(&self, unit: &TestUnit) -> Vec<(Piece, u64)> {
        let total = match unit {
            TestUnit::Libraries => 1,
            _ => self.splits.get(&unit.key()).copied().unwrap_or(1).max(1),
        };
        let weight = self.of(unit).div_ceil(total);
        if total == 1 {
            return vec![(Piece::whole(unit), weight)];
        }
        (1..=total)
            .map(|index| {
                let piece = Piece {
                    unit: unit.clone(),
                    slice: Some((index, total)),
                };
                (piece, weight)
            })
            .collect()
    }
}

/// A whole unit, or one nextest slice of a unit that the weights split.
#[derive(Clone, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub(super) struct Piece {
    /// The unit that this piece runs.
    pub(super) unit: TestUnit,
    /// The one-based slice index and the slice count of a split unit.
    pub(super) slice: Option<(u64, u64)>,
}

impl Piece {
    /// The piece that runs every test of one unit.
    pub(super) fn whole(unit: &TestUnit) -> Self {
        Self {
            unit: unit.clone(),
            slice: None,
        }
    }

    /// The nextest arguments of one slice of a split unit.
    pub(super) fn slice_args(&self) -> Option<Vec<String>> {
        let (index, total) = self.slice?;
        let mut args = self.unit.args();
        args.extend(["--partition".to_owned(), format!("slice:{index}/{total}")]);
        Some(args)
    }
}

/// Assign every piece of every unit to exactly one of `total` test shards and
/// return the pieces of each shard, in shard order. With more shards than
/// pieces, the shards after the last piece get no pieces.
///
/// The first shard runs the doc tests and the unit tests of every library,
/// `--lib`. Their builds need each crates.io dependency that any unit needs,
/// so this shard alone can save a complete Rust build cache. Then the
/// heaviest piece goes first, each to the shard with the least weight so far;
/// the lower shard wins a tie. The same units and weights give the same
/// partition on every host.
pub(super) fn partition(
    units: &BTreeSet<TestUnit>,
    weights: &Weights,
    total: u64,
) -> Vec<Vec<Piece>> {
    let mut pieces: Vec<_> = units.iter().flat_map(|unit| weights.pieces(unit)).collect();
    pieces.sort_by_key(|(piece, weight)| {
        (
            piece.unit != TestUnit::Libraries,
            Reverse(*weight),
            piece.unit.key(),
            piece.slice,
        )
    });
    let count = usize::try_from(total)
        .unwrap_or(usize::MAX)
        .min(pieces.len().saturating_add(1))
        .max(1);
    let mut loads = vec![0_u64; count];
    let mut shards = vec![Vec::new(); count];
    loads[0] = weights.doc_seconds;
    for (piece, weight) in pieces {
        let lightest = if piece.unit == TestUnit::Libraries {
            0
        } else {
            (0..count).min_by_key(|&index| loads[index]).unwrap_or(0)
        };
        loads[lightest] += weight;
        shards[lightest].push(piece);
    }
    for shard in &mut shards {
        shard.sort();
    }
    shards
}

/// The pieces of one test shard.
pub(super) fn shard_pieces(
    units: &BTreeSet<TestUnit>,
    weights: &Weights,
    shard: Shard,
) -> Vec<Piece> {
    let index = usize::try_from(shard.index() - 1).unwrap_or(usize::MAX);
    partition(units, weights, shard.total())
        .into_iter()
        .nth(index)
        .unwrap_or_default()
}
