//! Serve-head records outlive compilation leases under one serialized byte bound.

use std::collections::VecDeque;
use std::sync::Arc;

use mokly_sidecar::compiled::ReuseEvidence;
use mokly_sidecar::methods::{Bundle, ModuleResolution};
use mokly_sidecar::resolution_plan::{RECORD_BYTES, ResolutionPlan, bounded_record_bytes};
use serde::Serialize;

#[derive(Serialize)]
pub(crate) struct Record {
    pub(crate) plan: Arc<ResolutionPlan>,
    pub(crate) evidence: Arc<ReuseEvidence>,
}

#[derive(Serialize)]
struct Entry {
    settings: ResolutionSettings,
    record: Arc<Record>,
    #[serde(skip)]
    bytes: usize,
}

#[derive(PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct ResolutionSettings {
    module_resolution: ModuleResolution,
    source_root: String,
    configuration_directory: String,
    repository_roots: Vec<String>,
}

impl From<&Bundle> for ResolutionSettings {
    fn from(params: &Bundle) -> Self {
        Self {
            module_resolution: params.module_resolution.clone(),
            source_root: params.source_root.clone(),
            configuration_directory: params.configuration_directory.clone(),
            repository_roots: params.repository_roots.clone(),
        }
    }
}

#[derive(Default)]
pub(crate) struct Records {
    entries: VecDeque<Entry>,
    bytes: usize,
}

impl Records {
    pub(crate) fn get(&self, params: &Bundle) -> Option<Arc<Record>> {
        let settings = ResolutionSettings::from(params);
        self.entries
            .iter()
            .find(|entry| entry.settings == settings)
            .map(|entry| entry.record.clone())
    }

    pub(crate) fn insert(
        &mut self,
        params: &Bundle,
        plan: Arc<ResolutionPlan>,
        evidence: Arc<ReuseEvidence>,
    ) {
        if !evidence.captured() || !evidence.durable {
            return;
        }
        let mut entry = Entry {
            settings: ResolutionSettings::from(params),
            record: Arc::new(Record { plan, evidence }),
            bytes: 0,
        };
        let Some(bytes) = bounded_record_bytes(&entry) else {
            return;
        };
        entry.bytes = bytes;
        if let Some(index) = self
            .entries
            .iter()
            .position(|previous| previous.settings == entry.settings)
            && let Some(previous) = self.entries.remove(index)
        {
            self.bytes -= previous.bytes;
        }
        self.bytes += bytes;
        self.entries.push_back(entry);
        while self.bytes > RECORD_BYTES {
            let Some(previous) = self.entries.pop_front() else {
                break;
            };
            self.bytes -= previous.bytes;
        }
    }
}
