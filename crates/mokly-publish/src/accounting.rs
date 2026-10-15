//! Digest-based upload accounting reported as marker entry counts.

use std::collections::{BTreeMap, BTreeSet};

use mokly_model::output::validation::digest;

use crate::completion::{Completion, Outcome};
use crate::snapshot::Prepared;

/// Safe per-round progress data, emitted only for a nonempty missing set.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Progress {
    /// Zero-based Plan round; at most one re-plan exists.
    pub round: usize,
    /// Completed marker entries, including those in the Plan archive.
    pub completed: usize,
    /// Marker entries represented by this round's archive or missing set.
    pub total: usize,
    /// Byte sizes once per distinct combined digest, including the marker.
    pub size: u64,
}

impl Progress {
    /// Exact rich progress label, with binary units and singular only for one.
    pub fn label(&self) -> String {
        let noun = if self.total == 1 { "file" } else { "files" };
        format!(
            "Uploading {} of {} {noun} · {}",
            self.completed,
            self.total,
            binary_size(self.size)
        )
    }
}

/// Whole-command success with counts retained even for an already-published result.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Receipt {
    /// Receiver completion outcome and optional safe URL.
    pub completion: Completion,
    /// Marker entries whose digest was archived or attempted in any round.
    pub uploaded: usize,
    /// All remaining marker entries.
    pub unchanged: usize,
}

impl Receipt {
    /// Exact plain summary. Viewer URLs are a separate caller-owned line.
    pub fn summary(&self) -> String {
        if self.completion.outcome == Outcome::AlreadyPublished {
            return "Mokly catalogue already published for this commit.".to_owned();
        }
        let noun = if self.uploaded == 1 { "file" } else { "files" };
        format!(
            "Published Mokly catalogue. {} {noun} uploaded, {} unchanged.",
            self.uploaded, self.unchanged
        )
    }
}

pub(crate) fn plan_digests(prepared: &Prepared) -> BTreeSet<String> {
    prepared
        .plan_files
        .iter()
        .map(|file| digest(&file.bytes))
        .collect()
}

pub(crate) fn count(prepared: &Prepared, digests: &BTreeSet<String>) -> usize {
    prepared
        .ownership
        .files
        .iter()
        .filter(|entry| digests.contains(&entry.sha256))
        .count()
}

pub(crate) fn progress(prepared: &Prepared, missing: &[String], round: usize) -> Progress {
    let archived = plan_digests(prepared);
    let mut combined = archived.clone();
    combined.extend(missing.iter().cloned());
    let sizes: BTreeMap<_, _> = prepared
        .blobs
        .iter()
        .map(|(digest, bytes)| (digest, bytes.len() as u64))
        .collect();
    Progress {
        round,
        completed: count(prepared, &archived),
        total: count(prepared, &combined),
        size: combined.iter().filter_map(|digest| sizes.get(digest)).sum(),
    }
}

fn binary_size(bytes: u64) -> String {
    if bytes < 1024 {
        return format!("{bytes} B");
    }
    let mut size = bytes as f64;
    let mut unit = "B";
    for next in ["KiB", "MiB", "GiB", "TiB"] {
        if size < 1024.0 {
            break;
        }
        size /= 1024.0;
        unit = next;
    }
    format!("{size:.1} {unit}")
}
