//! Validate authored move hints without inferring comparison pairs.

use std::collections::{BTreeMap, BTreeSet};

use mokly_model::catalogue::ModelEntry;
use mokly_model::paths::is_entry_path;

use crate::diagnostic::{Code, Issue};
use crate::identity::{invalid_path, list, location};

pub(crate) fn validate(entries: &[ModelEntry]) -> Vec<Issue> {
    let current: BTreeSet<_> = entries
        .iter()
        .map(|entry| entry.metadata.path.to_ascii_lowercase())
        .collect();
    let mut prior: BTreeMap<String, Vec<&ModelEntry>> = BTreeMap::new();
    let mut issues = Vec::new();
    for entry in entries {
        let Some(path) = &entry.metadata.moved_from else {
            continue;
        };
        let source = entry
            .metadata
            .moved_from_source
            .as_ref()
            .unwrap_or(&entry.metadata.source);
        if !is_entry_path(path) {
            issues.push(invalid_path(path, "movedFrom", source));
            continue;
        }
        let lower = path.to_ascii_lowercase();
        if lower == entry.metadata.path.to_ascii_lowercase() {
            issues.push(
                Issue::new(
                    Code::InvalidMovedFrom,
                    format!(
                        "{}: movedFrom {path} equals the entry's own path",
                        location(source)
                    ),
                )
                .at(source.clone()),
            );
        } else if current.contains(&lower) {
            issues.push(
                Issue::new(
                    Code::MovedFromCurrent,
                    format!(
                        "{}: movedFrom {path} names a current entry",
                        location(source)
                    ),
                )
                .at(source.clone()),
            );
        }
        prior.entry(lower).or_default().push(entry);
    }
    for group in prior.values().filter(|group| group.len() > 1) {
        issues.push(list(
            Code::DuplicateMovedFrom,
            format!(
                "movedFrom {} is declared twice:",
                group[0].metadata.moved_from.as_deref().unwrap_or("")
            ),
            group
                .iter()
                .map(|entry| location(&entry.metadata.source))
                .collect(),
        ));
    }
    issues
}
