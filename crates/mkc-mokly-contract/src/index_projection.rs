//! Build the publication facts once, preserving producer record and view order.

use crate::index::CatalogueIndex;
use crate::index_document::{Changes, Document};
use crate::index_records::{ChangesCount, CountedRecord, Screen};
use crate::index_values::ChangeKind;

pub(crate) fn project(document: Document) -> CatalogueIndex {
    let mut records = Vec::new();
    for record in document
        .components
        .into_iter()
        .chain(document.documents)
        .chain(document.pages)
    {
        counted(
            &mut records,
            record.path,
            record.title,
            record.previous_path,
            record.changes,
        );
    }
    let mut screens = Vec::with_capacity(document.screens.len());
    for record in document.screens {
        counted(
            &mut records,
            record.path.clone(),
            record.title.clone(),
            record.previous_path,
            record.changes,
        );
        screens.push(Screen {
            path: record.path,
            title: record.title,
            views: record.views,
        });
    }
    for record in document.use_cases {
        counted(
            &mut records,
            record.path,
            record.title,
            record.previous_path,
            record.changes,
        );
    }
    for record in document.removed_entries {
        counted(
            &mut records,
            record.entry.path,
            record.entry.title,
            None,
            record.entry.changes,
        );
    }
    let mut counts = ChangesCount::default();
    for record in &records {
        match record.kind {
            ChangeKind::Added => counts.added += 1,
            ChangeKind::Removed => counts.removed += 1,
            ChangeKind::Changed | ChangeKind::Unmodified => counts.changed += 1,
        }
        counts.moved += u64::from(record.previous_path.is_some());
    }
    CatalogueIndex {
        base: document.base,
        base_commit: document.base_commit,
        changes_status: document.changes_status,
        comparison_generation: document.comparison_url,
        counted_records: records,
        current_screens: screens,
        counts,
    }
}

fn counted(
    records: &mut Vec<CountedRecord>,
    path: String,
    title: String,
    previous_path: Option<String>,
    changes: Changes,
) {
    if let Some(kind) = changes.counted_kind() {
        records.push(CountedRecord {
            path,
            title,
            kind,
            previous_path,
        });
    }
}
