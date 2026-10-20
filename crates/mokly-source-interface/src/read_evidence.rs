//! Read witnesses stay separate from late hashes and never imply complete coverage.

use std::collections::{BTreeMap, BTreeSet};

/// Provenance of one input digest. Conflicting observations must remain distinct.
#[derive(Clone, Debug, Eq, PartialEq, Ord, PartialOrd)]
pub enum ReadBaseline {
    /// SHA-256 of the exact buffer delivered by an observed whole-file read.
    ObservedWholeFile(String),
    /// SHA-256 captured after processing, with an unobserved read-to-capture gap.
    Late(String),
}

impl ReadBaseline {
    /// Digest without changing its provenance.
    pub fn digest(&self) -> &str {
        match self {
            Self::ObservedWholeFile(value) | Self::Late(value) => value,
        }
    }

    fn retained_bytes(&self) -> usize {
        match self {
            Self::ObservedWholeFile(value) | Self::Late(value) => value.capacity(),
        }
    }
}

/// Opaque readers remain permitted in every context.
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub enum ReadCoverage {
    /// Native, helper, worker, partial, and uninstrumented reads can escape observation.
    #[default]
    Incomplete,
}

/// Logical source names and all distinct witnessed or late versions for one result.
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct ReadEvidence {
    /// Presence of observations never upgrades this mark.
    pub coverage: ReadCoverage,
    /// Per-path versions; equal observations may coalesce only after digest comparison.
    pub inputs: BTreeMap<String, BTreeSet<ReadBaseline>>,
}

impl ReadEvidence {
    /// Keep each distinct version instead of letting a later scan overwrite it.
    pub fn insert(&mut self, path: String, baseline: ReadBaseline) {
        self.inputs.entry(path).or_default().insert(baseline);
    }

    /// Preserve observations when stylesheet closures are combined.
    pub fn extend(&mut self, other: Self) {
        for (path, versions) in other.inputs {
            self.inputs.entry(path).or_default().extend(versions);
        }
    }

    /// Conservative metadata charge; no consumed payload is retained.
    pub fn retained_bytes(&self) -> usize {
        self.inputs
            .iter()
            .map(|(path, versions)| {
                size_of::<(String, BTreeSet<ReadBaseline>)>()
                    + path.capacity()
                    + versions
                        .iter()
                        .map(|version| size_of::<ReadBaseline>() + version.retained_bytes())
                        .sum::<usize>()
            })
            .sum::<usize>()
            .saturating_mul(2)
    }
}
