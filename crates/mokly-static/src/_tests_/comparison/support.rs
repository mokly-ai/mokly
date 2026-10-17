//! Small typed page generation with mocked IO and deterministic bytes.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_compare::comparison_types::{ComparisonResult, EntryClassification};
use mokly_graph::cache::Artifact;
use mokly_graph::key::NodeKey;
use mokly_graph::types::{DocumentPlan, RenderGeneration, RenderGenerationMock};
use mokly_html::{composition::Composed, parse};
use mokly_model::axes::{ColorScheme, EntryKind};
use mokly_model::catalogue::{CatalogueModel, EntryContent, ModelEntry};
use mokly_model::review::{ReviewResultV8, ReviewState};
use mokly_model::snapshot::{CatalogueChangeSnapshotV4, RemovedEntrySnapshot};
use mokly_model::snapshot_records::{EntryRecord, RecordMetadata};
use mokly_model::usage::CatalogueUsage;
use serde_json::json;
use unimock::{MockFn, Unimock, matching};

pub(super) fn catalogue(path: &str) -> PreparedCatalogue {
    let metadata = serde_json::from_value(json!({"path":path,"title":path,"description":"","tags":[],"relatedDocs":[],"isIndex":false,"source":{"path":"specs/page.page.html","line":1,"column":1},"rootIndex":0})).unwrap();
    PreparedCatalogue {
        model: CatalogueModel {
            entries: vec![ModelEntry {
                metadata,
                content: EntryContent::Page,
            }],
            folders: vec![],
            sources: vec![],
            color_schemes: vec![ColorScheme::Light],
        },
        inventory: Default::default(),
        templates: BTreeMap::new(),
        documents: BTreeMap::new(),
        slot_fragments: BTreeMap::new(),
        elements: BTreeMap::new(),
        javascript: Default::default(),
        deferred_modules: vec![],
        warnings: vec![],
    }
}

pub(super) fn plans(path: &str, entry: usize) -> BTreeMap<String, DocumentPlan> {
    let route = format!("{path}/index.html");
    BTreeMap::from([(
        route.clone(),
        DocumentPlan {
            route,
            entry,
            key: NodeKey("c".repeat(64)),
            resource_key: "c".repeat(64),
            viewport: None,
            color_scheme: ColorScheme::Light,
            stylesheets: vec![],
        },
    )])
}

pub(super) fn artifact(document: bool) -> Arc<Artifact> {
    Arc::new(Artifact {
        bytes: b"<!doctype html><p>Historical page</p>".to_vec(),
        content_type: "text/html".into(),
        fragment: None,
        document: document.then(|| Composed {
            tree: parse::document("<p>Historical page</p>"),
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

pub(super) fn generation(path: &str, entry: usize, document: bool) -> Arc<dyn RenderGeneration> {
    Arc::new(Unimock::new((
        RenderGenerationMock::catalogue
            .each_call(matching!())
            .returns(catalogue(path)),
        RenderGenerationMock::plans
            .each_call(matching!())
            .returns(plans(path, entry)),
        RenderGenerationMock::render
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| Ok(artifact(document)))),
        RenderGenerationMock::resource_routes
            .each_call(matching!())
            .returns(Vec::<String>::new()),
        RenderGenerationMock::public_files
            .each_call(matching!())
            .returns(BTreeSet::<String>::new()),
    )))
}

pub(super) fn result() -> ComparisonResult {
    result_with(generation("old", 0, true), generation("home", 0, true))
}

pub(super) fn result_with(
    before: Arc<dyn RenderGeneration>,
    after: Arc<dyn RenderGeneration>,
) -> ComparisonResult {
    ComparisonResult {
        resource_work: Default::default(),
        affected_lookups: 0,
        validation_lookups: 0,
        warnings: vec![],
        counts: Default::default(),
        pairing: Default::default(),
        entries: vec![EntryClassification {
            kind: EntryKind::Page,
            path: "old".into(),
            previous_path: None,
            state: ReviewState::Removed,
            included: true,
            reasons: vec![],
            documents: vec![],
        }],
        before,
        after,
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
            changed_entries: vec!["old".into()],
            moved_entries: vec![],
            removed_entries: vec![RemovedEntrySnapshot {
                entry: EntryRecord::Page {
                    metadata: RecordMetadata {
                        path: "old".into(),
                        title: "old".into(),
                        description: String::new(),
                        rationale: None,
                        moved_from: None,
                        related_docs: vec![],
                        source_path: "specs/page.page.html".into(),
                        tags: Some(vec![]),
                    },
                },
                folder_titles: vec![],
                parent_title: None,
                snapshot_id: "d".repeat(64),
            }],
        },
    }
}
