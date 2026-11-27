//! The measured weights of the Mokly Rust test units, for each CI host.

use std::collections::BTreeMap;

use serde::Deserialize;

use crate::error::{ErrorResultExt, Result};

use super::rust_partition::Piece;
use super::rust_targets::TestUnit;

/// The measured unit weights, embedded when xtask builds.
const WEIGHTS: &str = include_str!("../../../scripts/verification/rust-test-weights.json");

/// A CI host whose test shards have their own measured test seconds.
#[derive(Clone, Copy, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd)]
#[serde(rename_all = "lowercase")]
pub(super) enum Host {
    /// The Repository test shards.
    Linux,
    /// The macOS native test shards.
    Macos,
    /// The Windows native test shards.
    Windows,
}

impl Host {
    /// The host that runs this process. Another Unix host uses the Linux
    /// weights.
    pub(super) fn current() -> Self {
        match std::env::consts::OS {
            "macos" => Self::Macos,
            "windows" => Self::Windows,
            _ => Self::Linux,
        }
    }
}

/// The committed weight file: the compile seconds of each unit, which every
/// host shares, and the test seconds of each unit on each host.
#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(super) struct WeightFile {
    /// The weight of a unit that neither map names, such as a new test.
    default_seconds: u64,
    /// The weight of the doc tests, which the first test shard also runs.
    doc_seconds: u64,
    /// The compile seconds of each unit, keyed by its Cargo target arguments.
    compile_seconds: BTreeMap<String, u64>,
    /// The test seconds of each unit on each host, keyed like
    /// `compile_seconds`. A host that the file does not name has none.
    test_seconds: BTreeMap<Host, BTreeMap<String, u64>>,
    /// The number of nextest slices of a heavy unit, keyed like `compile_seconds`. Each
    /// slice is one piece with an equal share of the unit's weight. `--lib`
    /// never splits.
    #[serde(default)]
    splits: BTreeMap<String, u64>,
}

impl WeightFile {
    /// Parse the JSON text of a weight file.
    pub(super) fn parse(text: &str) -> Result<Self> {
        serde_json::from_str(text).context("parse Rust test weights")
    }

    /// Parse the weight file that the build embedded.
    pub(super) fn embedded() -> Result<Self> {
        Self::parse(WEIGHTS)
    }

    /// The weights that place the test shards of one host.
    pub(super) fn host(&self, host: Host) -> Weights {
        Weights {
            default_seconds: self.default_seconds,
            doc_seconds: self.doc_seconds,
            compile_seconds: self.compile_seconds.clone(),
            test_seconds: self.test_seconds.get(&host).cloned().unwrap_or_default(),
            splits: self.splits.clone(),
        }
    }
}

/// The compile and test seconds of the Rust test units on one host.
#[derive(Debug)]
pub(super) struct Weights {
    default_seconds: u64,
    doc_seconds: u64,
    compile_seconds: BTreeMap<String, u64>,
    test_seconds: BTreeMap<String, u64>,
    splits: BTreeMap<String, u64>,
}

impl Weights {
    /// The weight of the doc tests, which the first test shard also runs.
    pub(super) fn doc_seconds(&self) -> u64 {
        self.doc_seconds
    }

    /// The compile seconds plus the test seconds of a unit. A unit that only
    /// one map names counts zero for the other part.
    fn of(&self, unit: &TestUnit) -> u64 {
        let key = unit.key();
        match (self.compile_seconds.get(&key), self.test_seconds.get(&key)) {
            (None, None) => self.default_seconds,
            (compile, test) => compile.copied().unwrap_or(0) + test.copied().unwrap_or(0),
        }
    }

    /// The pieces of one unit and the weight of each piece.
    pub(super) fn pieces(&self, unit: &TestUnit) -> Vec<(Piece, u64)> {
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
