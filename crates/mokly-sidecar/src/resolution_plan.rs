//! Native import targets captured beside one compilation's reuse evidence.

use std::io::{self, Write};

use serde::de::Error;
use serde::{Deserialize, Deserializer, Serialize};
use ts_rs::TS;

use crate::compiled::ReuseEvidence;

/// Combined serialized bound for a captured plan record and the core's retained records.
pub const RECORD_BYTES: usize = 8 * 1024 * 1024;

/// Import forms whose native targets can be classified.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Deserialize, Serialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum PlannedImportKind {
    /// A compiler entry point.
    EntryPoint,
    /// A static JavaScript import or export.
    ImportStatement,
    /// A CommonJS require call.
    RequireCall,
    /// A dynamic JavaScript import.
    DynamicImport,
    /// A CommonJS require.resolve call.
    RequireResolve,
    /// A CSS import rule.
    ImportRule,
    /// A CSS Modules composition.
    ComposesFrom,
    /// A CSS URL reference.
    UrlToken,
}

/// One importer index, specifier, import kind, target index, and side-effects flag.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize, TS)]
pub struct PlannedImport(
    /// Importer's position in the plan's path table.
    pub u32,
    /// Original import specifier.
    pub String,
    /// Import form used by the resolver.
    pub PlannedImportKind,
    /// Canonical target's position in the plan's path table.
    pub u32,
    /// Whether loading the target can have side effects.
    pub bool,
);

/// Classified native imports with shared importer and target paths.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, TS)]
pub struct ResolutionPlan {
    /// Unique physical paths addressed by each import's indices.
    pub paths: Vec<String>,
    /// Import targets reusable only with their matching captured evidence.
    pub imports: Vec<PlannedImport>,
}

#[derive(Deserialize)]
struct PlanData {
    paths: Vec<String>,
    imports: Vec<PlannedImport>,
}

impl<'de> Deserialize<'de> for ResolutionPlan {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let plan = PlanData::deserialize(deserializer)?;
        if plan.imports.iter().any(|entry| {
            plan.paths.get(entry.0 as usize).is_none() || plan.paths.get(entry.3 as usize).is_none()
        }) {
            return Err(D::Error::custom("invalid resolution plan reference"));
        }
        Ok(Self {
            paths: plan.paths,
            imports: plan.imports,
        })
    }
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
