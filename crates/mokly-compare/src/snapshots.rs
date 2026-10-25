//! Removal selection, base titles, stable identities, and snapshot v4 projection.

use std::collections::BTreeSet;

use mokly_model::axes::EntryKind;
use mokly_model::canonical;
use mokly_model::catalogue::{CatalogueModel, EntryContent, ModelEntry, VisualEntry};
use mokly_model::material::historical_snapshot_key;
use mokly_model::paths::title_from_slug;
use mokly_model::snapshot::{CatalogueChangeSnapshotV4, MovedEntrySnapshot, RemovedEntrySnapshot};
use mokly_model::snapshot_records::{EntryRecord, RecordMetadata, RecordVisual};
use mokly_model::wire_props;

use crate::comparison_error::CompareResult;
use crate::comparison_types::EntryClassification;
use crate::error::Result;
use crate::move_types::Pairing;

pub(crate) fn create(
    catalogue_identity: &str,
    base_ref: &str,
    base_commit: &str,
    before: &CatalogueModel,
    after: &CatalogueModel,
    pairing: &Pairing,
    entries: &[EntryClassification],
) -> Result<CatalogueChangeSnapshotV4> {
    let changed = {
        let mut changed: Vec<_> = entries
            .iter()
            .filter(|entry| {
                entry.included
                    && !(entry.kind == EntryKind::UseCase
                        && pairing.entries.iter().any(|pair| {
                            pair.after.is_none()
                                && pair.before.is_some_and(|index| {
                                    before.entries[index].metadata.path == entry.path
                                })
                        }))
            })
            .map(|entry| entry.path.clone())
            .collect();
        changed.sort_by(|left, right| canonical::compare_utf16(left, right));
        changed.dedup();
        changed
    };
    let selected: BTreeSet<_> = pairing
        .entries
        .iter()
        .filter(|pair| pair.after.is_none())
        .filter_map(|pair| pair.before)
        .collect();
    let mut removed = Vec::new();
    for (index, entry) in before.entries.iter().enumerate() {
        if !selected.contains(&index) {
            continue;
        }
        let Some(record) = record(entry) else {
            continue;
        };
        let parent = entry.metadata.variant_of.as_ref().and_then(|parent| {
            before
                .entries
                .iter()
                .find(|entry| &entry.metadata.path == parent && entry.metadata.variant_of.is_none())
        });
        let parent_title = parent.map(|entry| entry.metadata.title.clone());
        let folder_titles = folders(parent.unwrap_or(entry), before);
        let snapshot_id = historical_snapshot_key(
            catalogue_identity,
            base_commit,
            entry.content.kind().as_str(),
            &entry.metadata.path,
        )
        .compare()?;
        removed.push(RemovedEntrySnapshot {
            entry: record,
            folder_titles,
            parent_title,
            snapshot_id,
        });
    }
    let removed = crate::removal_order::sort(removed, before, after, pairing, &selected);
    let snapshot = CatalogueChangeSnapshotV4 {
        schema_version: 4,
        base_ref: base_ref.into(),
        base_commit: base_commit.into(),
        changed_entries: changed,
        moved_entries: pairing
            .moves
            .iter()
            .map(|pair| MovedEntrySnapshot {
                path: pair.path.clone(),
                previous_path: pair.previous_path.clone(),
            })
            .collect(),
        removed_entries: removed,
    };
    snapshot.validate_sources(before, after).compare()?;
    Ok(snapshot)
}

fn folders(entry: &ModelEntry, catalogue: &CatalogueModel) -> Vec<String> {
    let segments: Vec<_> = entry.metadata.path.split('/').collect();
    let mut titles = Vec::new();
    for length in 1..segments.len() {
        let path = segments[..length].join("/");
        let folder = catalogue.folders.iter().find(|folder| folder.path == path);
        let index = catalogue
            .entries
            .iter()
            .find(|entry| entry.metadata.is_index && entry.metadata.path == path);
        titles.push(
            folder
                .and_then(|folder| folder.title.clone())
                .or_else(|| index.map(|entry| entry.metadata.title.clone()))
                .unwrap_or_else(|| title_from_slug(segments[length - 1])),
        );
    }
    titles
}

fn record(entry: &ModelEntry) -> Option<EntryRecord> {
    let fields = &entry.metadata;
    let metadata = RecordMetadata {
        path: fields.path.clone(),
        title: fields.title.clone(),
        description: fields.description.clone(),
        rationale: fields.rationale.clone(),
        moved_from: fields.moved_from.clone(),
        related_docs: fields.related_docs.clone(),
        source_path: fields.source.path.clone(),
        tags: Some(fields.tags.clone()),
    };
    Some(match &entry.content {
        EntryContent::Screen {
            visual,
            address,
            use_case_paths,
        } => EntryRecord::Screen {
            metadata,
            visual: visual_record(entry, visual),
            address: address.clone(),
            use_case_paths: use_case_paths.clone(),
        },
        EntryContent::Component {
            visual,
            element,
            slots,
            supplied_slots,
        } => EntryRecord::Component {
            metadata,
            visual: visual_record(entry, visual),
            element: element.clone(),
            slots: slots.clone(),
            supplied_slots: supplied_slots.clone(),
        },
        EntryContent::Page => EntryRecord::Page { metadata },
        EntryContent::Document {
            color_schemes,
            resources,
        } => EntryRecord::Document {
            metadata,
            color_schemes: color_schemes.clone(),
            resources: resources.clone(),
        },
        EntryContent::UseCase { .. } => return None,
    })
}

fn visual_record(entry: &ModelEntry, visual: &VisualEntry) -> RecordVisual {
    RecordVisual {
        variant_of: entry.metadata.variant_of.clone(),
        color_schemes: visual.color_schemes.clone(),
        prop_schema: visual.prop_schema.clone(),
        props: wire_props::encode(&visual.props),
        controls: visual.controls.clone(),
    }
}
