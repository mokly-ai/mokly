//! Pure catalogue fixtures and mocked graph metadata.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_graph::types::{RenderGeneration, RenderGenerationMock};
use mokly_model::axes::{ColorScheme, EntryKind, Viewport};
use mokly_model::catalogue::{CatalogueModel, EntryContent, ModelEntry, VisualEntry};
use mokly_model::evidence::ViewEvidence;
use mokly_model::projection;
use mokly_model::public_detail::EntryDetailV1;
use mokly_model::review::{ReviewResultV8, ReviewState};
use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::comparison_types::{ComparisonResult, DocumentComparison, EntryClassification, ViewKey};
use crate::move_types::{EntryPair, Pairing};
use crate::{projection_index, snapshots};

pub(super) fn entry(path: &str, kind: EntryKind, parent: Option<&str>) -> ModelEntry {
    let visual = VisualEntry {
        color_schemes: vec![ColorScheme::Light],
        prop_schema: serde_json::from_value(
            json!({"type":"object","additionalProperties":false,"properties":{}}),
        )
        .unwrap(),
        props: Default::default(),
        controls: BTreeMap::new(),
    };
    ModelEntry {
        metadata: serde_json::from_value(json!({"path":path,"title":path,"description":"","tags":[],"relatedDocs":[],"variantOf":parent,"isIndex":false,"source":{"path":"specs/input.html","line":1,"column":1},"rootIndex":0})).unwrap(),
        content: match kind {
            EntryKind::Screen => EntryContent::Screen { visual, address: None, use_case_paths: vec![] },
            EntryKind::Component => EntryContent::Component { visual, element: None, slots: vec![], supplied_slots: vec![] },
            EntryKind::Document => EntryContent::Document { color_schemes: vec![ColorScheme::Light], resources: vec![] },
            EntryKind::Page => EntryContent::Page,
            EntryKind::UseCase => EntryContent::UseCase { steps: vec![] },
        },
    }
}

pub(super) fn model(entries: Vec<ModelEntry>) -> CatalogueModel {
    CatalogueModel {
        entries,
        folders: vec![],
        sources: vec![],
        color_schemes: vec![ColorScheme::Light],
    }
}

fn generation(model: CatalogueModel) -> Arc<dyn RenderGeneration> {
    Arc::new(Unimock::new(
        RenderGenerationMock::catalogue
            .each_call(matching!())
            .returns(PreparedCatalogue {
                model,
                inventory: Default::default(),
                templates: BTreeMap::new(),
                documents: BTreeMap::new(),
                slot_fragments: BTreeMap::new(),
                elements: BTreeMap::new(),
                javascript: Default::default(),
                deferred_modules: vec![],
                warnings: vec![],
            }),
    ))
}

pub(super) fn classified(path: &str, kind: EntryKind, state: ReviewState) -> EntryClassification {
    EntryClassification {
        kind,
        path: path.into(),
        previous_path: None,
        state,
        included: true,
        reasons: vec![],
        documents: vec![DocumentComparison {
            key: ViewKey {
                viewport: Some(Viewport::Desktop),
                color_scheme: ColorScheme::Light,
            },
            before_route: Some(format!("{path}/index.desktop.html")),
            after_route: Some(format!("{path}/index.desktop.html")),
            state,
            ignored_ids: vec![],
            evidence: ViewEvidence {
                rules: vec![],
                resources: vec![],
            },
        }],
    }
}

pub(super) fn result(
    before: Vec<ModelEntry>,
    after: Vec<ModelEntry>,
    entries: Vec<EntryClassification>,
) -> ComparisonResult {
    let before = model(before);
    let after = model(after);
    let mut pairs: Vec<_> = before
        .entries
        .iter()
        .enumerate()
        .map(|(i, entry)| EntryPair {
            before: Some(i),
            after: after
                .entries
                .iter()
                .position(|other| other.metadata.path == entry.metadata.path),
            moved: false,
        })
        .collect();
    for (i, entry) in after.entries.iter().enumerate() {
        if !before
            .entries
            .iter()
            .any(|other| other.metadata.path == entry.metadata.path)
        {
            pairs.push(EntryPair {
                before: None,
                after: Some(i),
                moved: false,
            });
        }
    }
    let pairing = Pairing {
        entries: pairs,
        ..Default::default()
    };
    let snapshot = snapshots::create(
        &"a".repeat(64),
        "base",
        &"b".repeat(40),
        &before,
        &after,
        &pairing,
        &entries,
    )
    .unwrap();
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
        snapshot,
        entries,
        pairing,
        counts: Default::default(),
        before: generation(before),
        after: generation(after),
    }
}

pub(super) fn details(model: &CatalogueModel) -> BTreeMap<String, EntryDetailV1> {
    let state = projection_index::publication("mokly.config.json".into(), "base");
    let index = projection::index(model, &[], &state).unwrap();
    projection::pending_details(model, &index, &[])
}
