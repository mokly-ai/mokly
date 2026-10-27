//! Review reasons, view states, and base addresses are detail evidence independent of workspaces.

use std::sync::Arc;

use mokly_model::axes::{ColorScheme, EntryKind, Viewport};
use mokly_model::projection::{self, ViewKey};
use mokly_model::public_detail::EntryDetailV2;
use mokly_model::review::{
    EntryChangeReason, ReviewEntry, ReviewEntryAddress, ReviewKind, ReviewResultV8, ReviewState,
};
use mokly_model::snapshot::CatalogueChangeSnapshotV4;
use serde_json::json;
use unimock::Unimock;

use crate::comparison_types::{ComparisonResult, EntryClassification};
use crate::{projection_detail, projection_index};

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
fn included_reasons_survive_without_workspace_including_implementation_only_components() {
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

fn address(path: &str) -> ReviewEntryAddress {
    ReviewEntryAddress {
        path: path.into(),
        title: path.into(),
        props: None,
        supplied_slots: None,
    }
}

fn record(state: ReviewState, before: Option<&str>, after: bool) -> ReviewEntry {
    ReviewEntry {
        kind: ReviewKind::Screen,
        path: "sample".into(),
        title: "sample".into(),
        before: before.map(address),
        after: after.then(|| address("sample")),
        previous_path: None,
        state,
        included: true,
        reasons: vec![],
        views: vec![],
        variants: None,
    }
}

fn viewed_details() -> std::collections::BTreeMap<String, EntryDetailV2> {
    let catalogue = model(vec![entry("sample", EntryKind::Screen, None)]);
    let state = projection_index::publication("mokly.config.json".into(), "base");
    let keys = [ViewKey {
        path: "sample".into(),
        viewport: Some(Viewport::Desktop),
        color_scheme: ColorScheme::Light,
        key: "a".repeat(64),
    }];
    let index = projection::index(&catalogue, &keys, &state).unwrap();
    projection::pending_details(&catalogue, &index, &keys)
}

#[test]
fn view_states_ignore_ids_and_the_base_address_reach_a_current_detail() {
    let mut change = classified("sample", EntryKind::Screen, ReviewState::IgnoredOnly);
    change.documents[0].ignored_ids = vec!["hero".into()];
    let mut result = comparison(change);
    result.review.entries = vec![record(ReviewState::IgnoredOnly, Some("Sample"), true)];
    let mut details = viewed_details();
    projection_detail::apply_evidence(&mut details, &result);
    let detail = serde_json::to_value(&details["sample"]).unwrap();
    assert_eq!(detail["views"][0]["state"], json!("ignored-only"));
    assert_eq!(detail["views"][0]["ignoredIds"], json!(["hero"]));
    assert_eq!(
        detail["views"][0]["resourceEvidence"],
        json!({"rules":[],"resources":[]})
    );
    assert_eq!(detail["before"], json!({"path":"Sample","title":"Sample"}));
}

#[test]
fn added_and_removed_details_carry_no_base_address() {
    for (state, before, after, generation) in [
        (ReviewState::Added, None, true, None),
        (
            ReviewState::Removed,
            Some("sample"),
            false,
            Some("c".repeat(64)),
        ),
    ] {
        let mut result = comparison(classified("sample", EntryKind::Screen, state));
        result.review.entries = vec![record(state, before, after)];
        let mut details = viewed_details();
        details.get_mut("sample").unwrap().generation = generation;
        projection_detail::apply_evidence(&mut details, &result);
        let detail = serde_json::to_value(&details["sample"]).unwrap();
        assert!(detail.get("before").is_none(), "{state:?}");
        assert_eq!(detail["views"][0]["ignoredIds"], json!([]));
    }
}
