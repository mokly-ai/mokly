//! Rules for the index fields read by the receiver, without whole-index validation.

use std::collections::BTreeSet;

use mkc_domain::entry_path::entry_path;

use crate::error::{Error, Limit, Rejection, Result, invalid};
use crate::index_document::{Changes, Document};
use crate::index_values::{ChangeKind, ChangesStatus};
use crate::limits::Limits;
use crate::manifest::{hex, sha};

pub(crate) fn validate(document: &Document, limits: Limits) -> Result<()> {
    if document
        .base_commit
        .as_deref()
        .is_some_and(|commit| !sha(commit))
        || (document.changes_status == ChangesStatus::Ready) != document.base_commit.is_some()
        || document
            .comparison_url
            .as_deref()
            .is_some_and(|url| !generation(url))
    {
        return Err(invalid(Rejection::Index));
    }
    let mut paths = BTreeSet::new();
    for record in document
        .components
        .iter()
        .chain(&document.documents)
        .chain(&document.pages)
        .chain(&document.use_cases)
    {
        entry(&record.path, &record.title, &mut paths, limits)?;
        current(record.previous_path.as_deref(), record.changes, limits)?;
    }
    for record in &document.screens {
        entry(&record.path, &record.title, &mut paths, limits)?;
        current(record.previous_path.as_deref(), record.changes, limits)?;
    }
    for record in &document.removed_entries {
        entry(&record.entry.path, &record.entry.title, &mut paths, limits)?;
    }
    Ok(())
}

fn current(previous: Option<&str>, changes: Changes, limits: Limits) -> Result<()> {
    if let Some(previous) = previous {
        path(previous, limits)?;
    }
    if matches!(
        changes,
        Changes::Ready {
            kind: ChangeKind::Removed,
            ..
        }
    ) {
        return Err(invalid(Rejection::Index));
    }
    Ok(())
}

fn entry(value: &str, title: &str, paths: &mut BTreeSet<String>, limits: Limits) -> Result<()> {
    path(value, limits)?;
    if title.is_empty() || !paths.insert(value.to_ascii_lowercase()) {
        return Err(invalid(Rejection::Index));
    }
    Ok(())
}

fn path(value: &str, limits: Limits) -> Result<()> {
    if value.len() > limits.path() {
        return Err(Error::TooLarge { limit: Limit::Path });
    }
    if value.split('/').count() > limits.path_segments() {
        return Err(Error::TooLarge {
            limit: Limit::PathSegments,
        });
    }
    if !entry_path(value) {
        return Err(invalid(Rejection::Index));
    }
    Ok(())
}

fn generation(value: &str) -> bool {
    value
        .strip_prefix("mokly-viewer/diffs/generations/")
        .and_then(|rest| rest.strip_suffix('/'))
        .is_some_and(|hash| hex(hash, 64))
}
