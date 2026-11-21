//! Select directory comparison rules only while admitting an edit resolution plan.

use std::collections::BTreeMap;
use std::path::Path;

use mokly_sidecar::compiled::ReuseEvidence;
use mokly_sidecar::resolution_plan::{DirectoryCandidates, ResolutionPlan};

use crate::physical_inputs::PhysicalInputs;

pub(crate) fn current(
    plan: &ResolutionPlan,
    evidence: &ReuseEvidence,
    reader: &dyn PhysicalInputs,
) -> bool {
    if !evidence.captured() {
        return false;
    }
    let mut directories = BTreeMap::new();
    for DirectoryCandidates(index, names) in plan.candidates.iter().flatten() {
        let Some(path) = plan.paths.get(*index as usize) else {
            return false;
        };
        if directories
            .insert(path.as_str(), names.as_slice())
            .is_some()
        {
            return false;
        }
    }
    evidence.inputs.iter().all(|(path, expected)| {
        if let Some(names) = directories.get(path.as_str()) {
            reader
                .matches_candidates(Path::new(path), expected, names)
                .unwrap_or(false)
        } else {
            reader.matches(Path::new(path), expected).unwrap_or(false)
        }
    })
}
