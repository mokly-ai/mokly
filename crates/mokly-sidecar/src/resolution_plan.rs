//! Native import targets captured beside one compilation's reuse evidence.

use std::collections::BTreeMap;
use std::io::{self, Write};

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::compiled::ReuseEvidence;

/// Combined serialized bound for a captured plan record and the core's retained records.
pub const RECORD_BYTES: usize = 8 * 1024 * 1024;

/// A classified target and its esbuild tree-shaking policy.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct PlannedImport {
    /// Canonical physical module path selected by the full resolver.
    pub path: String,
    /// Whether loading this module can have side effects.
    pub side_effects: bool,
}

/// Classified native imports keyed by importer, specifier, and import kind.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize, TS)]
pub struct ResolutionPlan {
    /// Import targets reusable only with their matching captured evidence.
    pub imports: BTreeMap<String, PlannedImport>,
}

impl ResolutionPlan {
    /// Admit a stable captured pair without allocating its serialized representation.
    pub fn record_bytes(&self, evidence: &ReuseEvidence) -> Option<usize> {
        if !evidence.captured() || !evidence.durable {
            return None;
        }
        bounded_record_bytes(&(self, evidence))
    }
}

/// Count a complete retained value without allocating its serialized representation.
pub fn bounded_record_bytes(value: &impl Serialize) -> Option<usize> {
    let mut counter = Counter(0);
    serde_json::to_writer(&mut counter, value).ok()?;
    Some(counter.0)
}

struct Counter(usize);

impl Write for Counter {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        self.0 = self.0.saturating_add(bytes.len());
        if self.0 > RECORD_BYTES {
            return Err(io::ErrorKind::FileTooLarge.into());
        }
        Ok(bytes.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}
