//! Read witnesses stay separate from late hashes and never imply complete coverage.

use std::collections::{BTreeMap, BTreeSet};
use std::path::PathBuf;

/// Native opened-file identity and its optional verified resolved name.
#[derive(Clone, Debug, Eq, PartialEq, Ord, PartialOrd)]
pub struct FileIdentity {
    /// Opaque device and file identifier from the same open descriptor as the bytes.
    pub object: String,
    /// Physical child-side name when it identifies the opened object.
    pub canonical: Option<PathBuf>,
}

/// Provenance of one input digest. Conflicting observations must remain distinct.
#[derive(Clone, Debug, Eq, PartialEq, Ord, PartialOrd)]
pub enum ReadBaseline {
    /// SHA-256 of the exact buffer delivered by an observed whole-file read.
    ObservedWholeFile(String),
    /// A whole-file witness with descriptor-bound identity.
    ObservedFile {
        /// Digest of the delivered bytes.
        digest: String,
        /// Identity captured from their open descriptor.
        identity: FileIdentity,
    },
    /// An exact observed range. It does not supply a whole-file cache stamp.
    ObservedRange {
        /// Byte offset in the opened file.
        offset: u64,
        /// Number of delivered bytes.
        length: u64,
        /// Whether this read also observed end of file.
        eof: bool,
        /// SHA-256 of only the delivered range.
        digest: String,
        /// Descriptor-bound identity when available.
        identity: Option<FileIdentity>,
    },
    /// SHA-256 captured after processing, with an unobserved read-to-capture gap.
    Late(String),
}

impl ReadBaseline {
    /// Digest without changing its provenance.
    pub fn digest(&self) -> &str {
        match self {
            Self::ObservedWholeFile(value) | Self::Late(value) => value,
            Self::ObservedRange { digest, .. } | Self::ObservedFile { digest, .. } => digest,
        }
    }

    /// An identity observation never upgrades coverage of other readers.
    pub fn identity(&self) -> Option<&FileIdentity> {
        match self {
            Self::ObservedFile { identity, .. } => Some(identity),
            Self::ObservedRange { identity, .. } => identity.as_ref(),
            _ => None,
        }
    }

    /// Whole-file stamps exclude partial byte observations.
    pub fn whole_digest(&self) -> Option<&str> {
        match self {
            Self::ObservedRange { .. } => None,
            _ => Some(self.digest()),
        }
    }

    fn retained_bytes(&self) -> usize {
        let digest = match self {
            Self::ObservedWholeFile(value) | Self::Late(value) => value.capacity(),
            Self::ObservedRange { digest, .. } | Self::ObservedFile { digest, .. } => {
                digest.capacity()
            }
        };
        digest
            + self.identity().map_or(0, |identity| {
                identity.object.capacity()
                    + identity
                        .canonical
                        .as_ref()
                        .map_or(0, |path| path.capacity())
            })
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
