//! Validate folder records against final entry paths and non-variant children.

use std::collections::{BTreeMap, BTreeSet};

use mokly_model::catalogue::{EntryContent, FolderRecord, ModelEntry};

use crate::diagnostic::{Code, Issue};
use crate::identity::{list, location};

pub(crate) fn validate(records: &[FolderRecord], entries: &[ModelEntry]) -> Vec<Issue> {
    let mut groups: BTreeMap<String, Vec<&FolderRecord>> = BTreeMap::new();
    let mut issues = Vec::new();
    for record in records {
        groups
            .entry(record.path.to_ascii_lowercase())
            .or_default()
            .push(record);
    }
    for group in groups.values().filter(|group| group.len() > 1) {
        issues.push(list(
            Code::DuplicateFolder,
            format!("folder {} is defined twice:", group[0].path),
            group
                .iter()
                .map(|record| location(&record.source))
                .collect(),
        ));
    }
    for record in records {
        let path = &record.path;
        let prefix = if path.is_empty() {
            String::new()
        } else {
            format!("{path}/")
        };
        let mut children = BTreeSet::new();
        let mut own = None;
        for entry in entries
            .iter()
            .filter(|entry| entry.metadata.variant_of.is_none())
        {
            if entry.metadata.path == *path && entry.metadata.is_index {
                own = Some(entry);
            }
            if let Some(rest) = entry
                .metadata
                .path
                .strip_prefix(&prefix)
                .filter(|rest| !rest.is_empty())
                && let Some(slug) = rest.split('/').next()
            {
                children.insert(slug);
            }
        }
        let at = location(&record.source);
        if children.is_empty() && own.is_none() {
            issues.push(
                Issue::new(
                    Code::UnusedFolder,
                    format!("{at} describes folder {path}, but no entry is below it"),
                )
                .at(record.source.clone()),
            );
            continue;
        }
        if record.title.is_some()
            && own.is_some_and(|entry| {
                matches!(
                    entry.content,
                    EntryContent::Screen { .. } | EntryContent::Component { .. }
                )
            })
        {
            let rule = "title cannot be set for a folder whose own page is a screen or component";
            issues.push(
                Issue::new(
                    Code::InvalidFolder,
                    format!("{at}: {rule}; set the entry's title"),
                )
                .at(record.source.clone()),
            );
        }
        for slug in record
            .order
            .iter()
            .flatten()
            .filter(|slug| slug.as_str() != "...")
        {
            if !children.contains(slug.as_str()) {
                issues.push(
                    Issue::new(
                        Code::UnknownFolderChild,
                        format!("{at}: order names {slug}, which is not a child of {path}"),
                    )
                    .at(record.source.clone()),
                );
            }
        }
    }
    issues
}
