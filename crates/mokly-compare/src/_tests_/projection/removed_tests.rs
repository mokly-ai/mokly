//! Removed publication shares metadata, base usage, fences, and preview shapes.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_graph::cache::Artifact;
use mokly_graph::key::NodeKey;
use mokly_graph::types::{DocumentPlan, RenderGenerationMock};
use mokly_html::{composition::Composed, parse};
use mokly_model::axes::{ColorScheme, EntryKind, Viewport};
use mokly_model::projection;
use mokly_model::public_index::RemovedPreview;
use mokly_model::public_records::CatalogueRecord;
use mokly_model::review::{EntryChangeReason, ReviewState};
use mokly_model::usage::CatalogueUsage;
use unimock::{MockFn, Unimock, matching};

use crate::{projection_index, projection_removed};

use super::support::{classified, entry, result};

#[test]
fn removed_records_and_previews_share_the_pinned_identity_and_metadata() {
    let entries = vec![
        entry("screen", EntryKind::Screen, None),
        entry("page", EntryKind::Page, None),
        entry("document", EntryKind::Document, None),
        entry("button", EntryKind::Component, None),
        entry("button/compact", EntryKind::Component, Some("button")),
    ];
    let changes = entries
        .iter()
        .map(|entry| {
            classified(
                &entry.metadata.path,
                entry.content.kind(),
                ReviewState::Removed,
            )
        })
        .collect();
    let mut result = result(entries, vec![], changes);
    for removed in &mut result.snapshot.removed_entries {
        removed.folder_titles = vec!["Historical folder".into()];
    }
    let state = projection_index::publication("mokly.config.json".into(), "base");
    let mut index = projection::index(&result.before.catalogue().model, &[], &state).unwrap();
    projection_index::apply(&mut index, &result);
    let records = projection_removed::records(&result, index).unwrap();
    assert_eq!(records.len(), 5);
    for (record, removed) in records.iter().zip(&result.snapshot.removed_entries) {
        assert_eq!(record.folder_titles, removed.folder_titles);
        assert_eq!(record.parent_title, removed.parent_title);
        assert_eq!(
            record.snapshot_id.as_deref(),
            Some(removed.snapshot_id.as_str())
        );
        assert!(matches!(
            (&record.entry, &record.preview),
            (CatalogueRecord::Screen(_), Some(RemovedPreview::Screen))
                | (CatalogueRecord::Page(_), Some(RemovedPreview::Page))
                | (CatalogueRecord::Document(_), Some(RemovedPreview::Document))
                | (CatalogueRecord::Component(_), None)
        ));
    }
    let previews = projection_removed::previews(&result);
    assert_eq!(
        previews
            .iter()
            .map(|preview| preview.path.as_str())
            .collect::<Vec<_>>(),
        ["document", "page"]
    );
    for preview in previews {
        assert_eq!(preview.schema_version, 3);
        assert_eq!(preview.base_ref, "base");
        assert_eq!(preview.base_commit, "b".repeat(40));
    }
}

#[test]
fn historical_details_use_base_plans_without_inventing_workspace_or_view_evidence() {
    let removed = entry("removed", EntryKind::Screen, None);
    let mut change = classified("removed", EntryKind::Screen, ReviewState::Removed);
    change.reasons = vec![EntryChangeReason::Removed];
    change.documents.clear();
    let mut result = result(vec![removed], vec![], vec![change]);
    let catalogue = result.before.catalogue().clone();
    let plans = BTreeMap::from([(
        "removed/index.desktop.html".into(),
        DocumentPlan {
            route: "removed/index.desktop.html".into(),
            entry: 0,
            key: NodeKey("c".repeat(64)),
            resource_key: "c".repeat(64),
            viewport: Some(Viewport::Desktop),
            color_scheme: ColorScheme::Light,
            stylesheets: vec![],
        },
    )]);
    result.before = Arc::new(Unimock::new((
        RenderGenerationMock::catalogue
            .each_call(matching!())
            .returns(catalogue),
        RenderGenerationMock::plans
            .each_call(matching!())
            .returns(plans),
        RenderGenerationMock::render
            .next_call(matching!("removed/index.desktop.html"))
            .returns(Ok(Arc::new(Artifact {
                bytes: b"historical bytes".to_vec(),
                content_type: "text/html".into(),
                fragment: None,
                document: Some(Composed {
                    tree: parse::document("<p>Historical</p>"),
                    usage: CatalogueUsage::Ready {
                        instances: vec![],
                        slots: vec![],
                        ranges: vec![],
                    },
                    warnings: vec![],
                    resources: vec![],
                    components: vec![],
                    links: vec![],
                }),
            }))),
    )));
    let state = projection_index::publication("mokly.config.json".into(), "base");
    let index = projection_index::base_index(&result, &state).unwrap();
    let mut details = projection_removed::details(&result, &index, &"f".repeat(64)).unwrap();
    assert_eq!(details.len(), 1);
    let detail = &details["removed"];
    assert!(detail.deployment_id.is_none());
    assert!(detail.revision.is_none());
    assert_eq!(detail.generation.as_deref(), Some("f".repeat(64).as_str()));
    assert_eq!(
        detail.entry.snapshot_id.as_deref(),
        Some(result.snapshot.removed_entries[0].snapshot_id.as_str())
    );
    assert!(detail.workspace.is_none());
    assert_eq!(
        serde_json::to_value(detail).unwrap()["reasons"],
        serde_json::json!([{ "kind": "removed" }])
    );
    assert_eq!(detail.views.len(), 1);
    assert!(matches!(
        detail.views[0].usage,
        CatalogueUsage::Ready { .. }
    ));
    assert!(detail.views[0].resource_evidence.is_none());
    projection_removed::workspaces(&mut details);
    let workspace = details["removed"].workspace.as_ref().unwrap();
    assert!(!workspace.comparison_eligible);
    assert!(workspace.used_by.is_empty());
    assert!(workspace.affected.is_empty());
    assert!(workspace.related_components.is_empty());
    assert!(workspace.input_changes.is_empty());
}
