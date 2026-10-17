//! Small accepted results keep capture and retention tests independent of real IO.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_compare::comparison_types::{
    ComparisonResult, DocumentComparison, EntryClassification, ViewKey,
};
use mokly_graph::types::RenderGeneration;
use mokly_model::axes::{ColorScheme, EntryKind, Viewport};
use mokly_model::evidence::ViewEvidence;
use mokly_model::review::{
    EntryChangeReason, ReviewEntry, ReviewEntryAddress, ReviewKind, ReviewResultV8, ReviewState,
    ReviewView,
};
use mokly_model::snapshot::CatalogueChangeSnapshotV4;
use mokly_model::wire_props;
use unimock::Unimock;

use crate::assets::File;
use crate::changes::{Accepted, ChangeToken};
use crate::publication_support;
use crate::snapshot::Snapshot;

pub(crate) fn accepted(
    before: Arc<dyn RenderGeneration>,
    after: Arc<dyn RenderGeneration>,
) -> Arc<Accepted> {
    let address = |path: &str| ReviewEntryAddress {
        path: path.into(),
        title: "Sample".into(),
        props: Some(wire_props::encode(&Default::default())),
        supplied_slots: None,
    };
    let view = ReviewView {
        viewport: Viewport::Mobile,
        color_scheme: ColorScheme::Light,
        state: ReviewState::Changed,
        ignored_ids: vec![],
        rules: vec![],
        resources: vec![],
    };
    let entries = ["sample", "unused"]
        .map(|path| ReviewEntry {
            kind: ReviewKind::Screen,
            path: path.into(),
            title: "Sample".into(),
            before: Some(address(path)),
            after: Some(address(path)),
            previous_path: None,
            state: ReviewState::Changed,
            included: true,
            reasons: vec![EntryChangeReason::Material],
            views: vec![view.clone()],
            variants: None,
        })
        .to_vec();
    Arc::new(Accepted {
        source: None,
        cancel: Arc::new(ChangeToken::default()),
        id: "a".repeat(64),
        result: ComparisonResult {
            resource_work: Default::default(),
            affected_lookups: 0,
            validation_lookups: 0,
            warnings: vec![],
            review: ReviewResultV8 {
                schema_version: 8,
                base_commit: "b".repeat(40),
                entries,
                affected: vec![],
                diagnostics: vec![],
            },
            snapshot: CatalogueChangeSnapshotV4 {
                schema_version: 4,
                base_ref: "base".into(),
                base_commit: "b".repeat(40),
                changed_entries: vec!["sample".into(), "unused".into()],
                moved_entries: vec![],
                removed_entries: vec![],
            },
            entries: ["sample", "unused"]
                .map(|path| EntryClassification {
                    kind: EntryKind::Screen,
                    path: path.into(),
                    previous_path: None,
                    state: ReviewState::Changed,
                    included: true,
                    reasons: vec![EntryChangeReason::Material],
                    documents: vec![DocumentComparison {
                        key: ViewKey {
                            viewport: Some(Viewport::Mobile),
                            color_scheme: ColorScheme::Light,
                        },
                        before_route: Some(format!("{path}/index.mobile.html")),
                        after_route: Some(format!("{path}/index.mobile.html")),
                        state: ReviewState::Changed,
                        ignored_ids: vec![],
                        evidence: ViewEvidence {
                            rules: vec![],
                            resources: vec![],
                        },
                    }],
                })
                .to_vec(),
            pairing: Default::default(),
            counts: Default::default(),
            before,
            after,
        },
    })
}

pub(crate) fn snapshot(accepted: Option<Arc<Accepted>>) -> Arc<Snapshot> {
    let mut snapshot = (*publication_support::snapshot(0, Arc::new(Unimock::new(())))).clone();
    snapshot.changes = accepted;
    snapshot.index.tree.clear();
    snapshot.index.pages.clear();
    snapshot.index.documents.clear();
    snapshot.index.components.clear();
    snapshot.index.use_cases.clear();
    snapshot.index.removed_entries.clear();
    Arc::new(snapshot)
}

pub(crate) fn files() -> BTreeMap<String, File> {
    BTreeMap::from([(
        "review.json".into(),
        File {
            bytes: "{}".into(),
            content_type: "application/json; charset=utf-8".into(),
        },
    )])
}
