//! Exact observed PostCSS bytes are independent of watch dependency declarations.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// A whole-file read witness; a path alone and a partial read cannot create one.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(tag = "kind", rename_all = "kebab-case", deny_unknown_fields)]
#[ts(rename = "PostcssRead")]
pub enum Read {
    /// Hash computed before delivering the complete raw buffer to its consumer.
    WholeFile {
        /// Absolute child-side file name used by the read.
        path: String,
        /// SHA-256 of the delivered raw bytes, before decoding or compilation.
        digest: String,
    },
}

/// Observation does not prove that all readers use the observed bytes.
#[derive(Clone, Debug, Default, Deserialize, Serialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(rename = "PostcssCoverage")]
pub enum Coverage {
    /// Opaque reads remain compatible and can have a late baseline.
    #[default]
    Incomplete,
}

/// A child context's cumulative observations, included atomically with each result.
#[derive(Clone, Debug, Default, Deserialize, Serialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(rename = "PostcssEvidence")]
pub struct Evidence {
    /// Never inferred from the number of observed paths.
    pub coverage: Coverage,
    /// All distinct whole-file versions delivered during this context.
    pub reads: Vec<Read>,
    /// Known module input names, including modules with no byte observation.
    pub modules: Vec<String>,
}

impl Evidence {
    /// Payload metadata charged to the existing PostCSS result cache.
    pub fn retained_bytes(&self) -> usize {
        self.reads.capacity() * size_of::<Read>()
            + self
                .reads
                .iter()
                .map(|read| match read {
                    Read::WholeFile { path, digest } => path.capacity() + digest.capacity(),
                })
                .sum::<usize>()
            + self.modules.capacity() * size_of::<String>()
            + self.modules.iter().map(String::capacity).sum::<usize>()
    }
}
