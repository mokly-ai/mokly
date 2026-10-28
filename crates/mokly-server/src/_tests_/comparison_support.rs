//! Small accepted results keep capture and retention tests independent of real IO.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_catalogue::html_input::DeliveredHtml;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_compare::comparison_types::{
    ComparisonResult, DocumentComparison, EntryClassification, ViewKey,
};
use mokly_graph::cache::Artifact;
use mokly_graph::key::NodeKey;
use mokly_graph::types::{DocumentPlan, RenderGeneration};
use mokly_html::composition::Composed;
use mokly_html::parse;
use mokly_model::axes::{ColorScheme, EntryKind, Viewport};
use mokly_model::catalogue::{
    CatalogueModel, EntryContent, EntryMetadata, ModelEntry, SourceLocation,
};
use mokly_model::evidence::ViewEvidence;
use mokly_model::review::{
    EntryChangeReason, ReviewEntry, ReviewEntryAddress, ReviewKind, ReviewResultV8, ReviewState,
    ReviewView,
};
use mokly_model::snapshot::{CatalogueChangeSnapshotV4, RemovedEntrySnapshot};
use mokly_model::snapshot_records::{EntryRecord, RecordMetadata};
use mokly_model::usage::CatalogueUsage;
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
        "entries/sample.json".into(),
        File {
            bytes: "{}".into(),
            content_type: "application/json; charset=utf-8".into(),
        },
    )])
}

pub(crate) fn historical_inputs() -> (PreparedCatalogue, BTreeMap<String, DocumentPlan>) {
    let model = CatalogueModel {
        entries: vec![ModelEntry {
            metadata: EntryMetadata {
                path: "sample".into(),
                title: "Sample".into(),
                description: String::new(),
                tags: Vec::new(),
                rationale: None,
                related_docs: Vec::new(),
                moved_from: None,
                moved_from_source: None,
                variant_of: None,
                is_index: false,
                root_index: 0,
                source: SourceLocation {
                    path: "sample.page.html".into(),
                    line: 1,
                    column: 1,
                    export: None,
                },
            },
            content: EntryContent::Page,
        }],
        folders: Vec::new(),
        sources: Vec::new(),
        color_schemes: vec![ColorScheme::Light],
    };
    let catalogue = PreparedCatalogue {
        model,
        inventory: Default::default(),
        templates: BTreeMap::new(),
        documents: BTreeMap::new(),
        slot_fragments: BTreeMap::new(),
        elements: BTreeMap::new(),
        deferred_modules: Vec::new(),
        javascript: Default::default(),
        dependency_directories: Default::default(),
        warnings: Vec::new(),
    };
    let route = "sample/index.html".to_owned();
    let plans = BTreeMap::from([(
        route.clone(),
        DocumentPlan {
            resource_key: "resources".into(),
            route,
            key: NodeKey("a".repeat(64)),
            entry: 0,
            viewport: None,
            color_scheme: ColorScheme::Light,
            stylesheets: Vec::new(),
        },
    )]);
    (catalogue, plans)
}

/// A removed page whose before document can be captured on demand.
pub(crate) fn historical() -> Arc<Accepted> {
    let mut value = accepted(Arc::new(Unimock::new(())), Arc::new(Unimock::new(())));
    let result = &mut Arc::get_mut(&mut value).unwrap().result;
    result.snapshot.removed_entries.push(RemovedEntrySnapshot {
        entry: EntryRecord::Page {
            metadata: RecordMetadata {
                path: "sample".into(),
                title: "Sample".into(),
                description: String::new(),
                rationale: None,
                moved_from: None,
                related_docs: Vec::new(),
                source_path: "sample.page.html".into(),
                tags: None,
            },
        },
        folder_titles: Vec::new(),
        parent_title: None,
        snapshot_id: "c".repeat(64),
    });
    result.entries[0].documents[0].before_route = Some("sample/index.html".into());
    value
}

/// The removed page's base document, parsed so its preview can be projected.
pub(crate) fn history() -> Arc<Artifact> {
    Arc::new(Artifact {
        bytes: b"<p>History</p>".to_vec(),
        content_type: "text/html".into(),
        fragment: None,
        document: Some(Composed {
            tree: parse::html(DeliveredHtml::document("<p>History</p>")),
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
    })
}
