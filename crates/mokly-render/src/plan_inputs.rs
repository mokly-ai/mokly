//! Select directory comparison rules only while admitting an edit resolution plan.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;

use mokly_sidecar::compiled::ReuseEvidence;
use mokly_sidecar::resolution_plan::{DirectoryCandidates, ResolutionPlan};

use crate::physical_inputs::PhysicalInputs;

/// The most threads that check one record, which are bound by filesystem latency.
const THREADS: usize = 4;

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
    let inputs: Vec<_> = evidence.inputs.iter().collect();
    let length = inputs.len().div_ceil(THREADS).max(1);
    let failed = AtomicBool::new(false);
    thread::scope(|scope| {
        for part in inputs.chunks(length) {
            let (directories, failed) = (&directories, &failed);
            scope.spawn(move || {
                for (path, expected) in part {
                    if failed.load(Ordering::Relaxed) {
                        return;
                    }
                    let matched = match directories.get(path.as_str()) {
                        Some(names) => reader.matches_candidates(
                            Path::new(path),
                            expected,
                            names,
                            &evidence.inputs,
                        ),
                        None => reader.matches(Path::new(path), expected, &evidence.inputs),
                    };
                    if !matched.unwrap_or(false) {
                        failed.store(true, Ordering::Relaxed);
                        return;
                    }
                }
            });
        }
    });
    !failed.load(Ordering::Relaxed)
}
