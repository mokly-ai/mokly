//! Review reasons are detail evidence independent of usage workspaces.

use std::sync::Arc;

use mokly_model::axes::EntryKind;
use mokly_model::review::{EntryChangeReason, ReviewResultV8, ReviewState};
use mokly_model::snapshot::CatalogueChangeSnapshotV4;
use serde_json::json;
use unimock::Unimock;

use crate::comparison_types::{ComparisonResult, EntryClassification};
use crate::projection_detail;

use super::support::{classified, details, entry, model};

fn comparison(entry: EntryClassification) -> ComparisonResult {
    ComparisonResult {
        resource_work: Default::default(),
        affected_lookups: 0,
        validation_lookups: 0,
        warnings: vec![],
        review: ReviewResultV8 {
            schema_version: 8,
            base_commit: "b".repeat(40),
            entries: vec![],
            affected: vec![],
            diagnostics: vec![],
        },
        snapshot: CatalogueChangeSnapshotV4 {
            schema_version: 4,
            base_ref: "base".into(),
            base_commit: "b".repeat(40),
            changed_entries: vec![],
            moved_entries: vec![],
            removed_entries: vec![],
        },
        entries: vec![entry],
        pairing: Default::default(),
        counts: Default::default(),
        before: Arc::new(Unimock::new(())),
        after: Arc::new(Unimock::new(())),
    }
}

#[test]
fn included_reasons_survive_without_workspace_and_preserve_implementation_only_state() {
    for (kind, state, reasons) in [
        (
            EntryKind::Screen,
            ReviewState::Changed,
            vec![EntryChangeReason::Material],
        ),
        (
            EntryKind::Component,
            ReviewState::Unchanged,
            vec![EntryChangeReason::Implementation],
        ),
        (
            EntryKind::Page,
            ReviewState::Changed,
            vec![EntryChangeReason::Metadata],
        ),
        (
            EntryKind::Document,
            ReviewState::Changed,
            vec![EntryChangeReason::Material],
        ),
        (
            EntryKind::UseCase,
            ReviewState::Changed,
            vec![EntryChangeReason::Screen {
                screen_path: "home".into(),
            }],
        ),
        (EntryKind::Screen, ReviewState::Unchanged, vec![]),
    ] {
        let catalogue = model(vec![entry("sample", kind, None)]);
        let mut change = classified("sample", kind, state);
        change.reasons = reasons.clone();
        if reasons.is_empty() {
            change.previous_path = Some("previous".into());
        }
        let result = comparison(change);
        let mut details = details(&catalogue);
        details.get_mut("sample").unwrap().workspace = None;
        projection_detail::apply_evidence(&mut details, &result);
        let detail = serde_json::to_value(&details["sample"]).unwrap();
        assert_eq!(detail["reasons"], json!(reasons));
        assert!(detail.get("workspace").is_none());
        assert_eq!(result.entries[0].state, state);
    }
}

#[test]
fn unchanged_entries_omit_reasons() {
    let catalogue = model(vec![entry("sample", EntryKind::Screen, None)]);
    let mut change = classified("sample", EntryKind::Screen, ReviewState::Unchanged);
    change.included = false;
    let result = comparison(change);
    let mut details = details(&catalogue);
    projection_detail::apply_evidence(&mut details, &result);
    let detail = serde_json::to_value(&details["sample"]).unwrap();
    assert!(detail.get("reasons").is_none());
}

#[test]
fn detail_reasons_share_review_order_and_deduplication() {
    let catalogue = model(vec![entry("sample", EntryKind::Screen, None)]);
    let mut change = classified("sample", EntryKind::Screen, ReviewState::Changed);
    change.reasons = vec![
        EntryChangeReason::Metadata,
        EntryChangeReason::Material,
        EntryChangeReason::Metadata,
        EntryChangeReason::Dependency {
            path: "static/\u{e000}.css".into(),
        },
        EntryChangeReason::Dependency {
            path: "static/\u{10000}.css".into(),
        },
    ];
    let result = comparison(change);
    let mut details = details(&catalogue);
    projection_detail::apply_evidence(&mut details, &result);
    assert_eq!(
        serde_json::to_value(&details["sample"]).unwrap()["reasons"],
        json!([
            {"kind":"dependency", "path":"static/\u{10000}.css"},
            {"kind":"dependency", "path":"static/\u{e000}.css"},
            {"kind":"material"}, {"kind":"metadata"}
        ])
    );
}
