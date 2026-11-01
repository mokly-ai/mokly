//! Pure catalogue fixtures and mocked graph metadata.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_graph::types::{RenderGeneration, RenderGenerationMock};
use mokly_model::axes::{ColorScheme, EntryKind, Viewport};
use mokly_model::catalogue::{CatalogueModel, EntryContent, ModelEntry, VisualEntry};
use mokly_model::evidence::ViewEvidence;
use mokly_model::projection;
use mokly_model::public_detail::EntryDetailV4;
use mokly_model::review::{ReviewResultV8, ReviewState};
use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::comparison_types::{ComparisonResult, DocumentComparison, EntryClassification, ViewKey};
use crate::move_types::{EntryPair, MovePair, Pairing};
use crate::{projection_index, snapshots};

pub(super) fn entry(path: &str, kind: EntryKind, parent: Option<&str>) -> ModelEntry {
    let visual = VisualEntry {
        control_order: Vec::new(),
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
                dependency_directories: Default::default(),
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
            before_route: (state != ReviewState::Added)
                .then(|| format!("{path}/index.desktop.html")),
            after_route: (state != ReviewState::Removed)
                .then(|| format!("{path}/index.desktop.html")),
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
    finish_result(before, after, entries, pairing)
}

/// Build an accepted move fixture before validating its removal snapshot.
pub(super) fn paired_result(
    before: Vec<ModelEntry>,
    after: Vec<ModelEntry>,
    entries: Vec<EntryClassification>,
    pairing: Pairing,
) -> ComparisonResult {
    finish_result(model(before), model(after), entries, pairing)
}

fn finish_result(
    before: CatalogueModel,
    after: CatalogueModel,
    entries: Vec<EntryClassification>,
    pairing: Pairing,
) -> ComparisonResult {
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

pub(super) fn details(model: &CatalogueModel) -> BTreeMap<String, EntryDetailV4> {
    let state = projection_index::publication("mokly.config.json".into(), "base");
    let index = projection::index(model, &[], &state).unwrap();
    let mut details = projection::pending_details(model, &index, &[]);
    let workspaces = {
        let workspace_details = details
            .iter()
            .map(|(path, detail)| (path.clone(), detail))
            .collect();
        mokly_model::projection_usage::workspaces(&workspace_details, &index)
    };
    for (path, workspace) in workspaces {
        if let Some(detail) = details.get_mut(&path) {
            detail.workspace = Some(workspace);
        }
    }
    details
}

/// Transfer one variant while retaining or removing its former parent.
pub(super) fn transferred_variant_result(remove_donor: bool) -> ComparisonResult {
    let before = vec![
        entry("badge", EntryKind::Component, None),
        entry("donor", EntryKind::Component, None),
        entry("receiver", EntryKind::Component, None),
        entry("donor/primary", EntryKind::Component, Some("donor")),
    ];
    let mut after = before.clone();
    after[3].metadata.path = "receiver/primary".into();
    after[3].metadata.title = "Transferred primary".into();
    after[3].metadata.variant_of = Some("receiver".into());
    let mut pairs: Vec<_> = (0..4)
        .map(|index| EntryPair {
            before: Some(index),
            after: Some(index),
            moved: index == 3,
        })
        .collect();
    if remove_donor {
        after.remove(1);
        pairs[1].after = None;
        pairs[2].after = Some(1);
        pairs[3].after = Some(2);
    }
    let mut variant = classified(
        "receiver/primary",
        EntryKind::Component,
        ReviewState::Unchanged,
    );
    variant.previous_path = Some("donor/primary".into());
    variant.documents[0].before_route = Some("donor/primary/index.desktop.html".into());
    paired_result(
        before,
        after,
        vec![
            classified("badge", EntryKind::Component, ReviewState::Changed),
            classified(
                "donor",
                EntryKind::Component,
                if remove_donor {
                    ReviewState::Removed
                } else {
                    ReviewState::Unchanged
                },
            ),
            classified("receiver", EntryKind::Component, ReviewState::Unchanged),
            variant,
        ],
        Pairing {
            entries: pairs,
            moves: vec![MovePair {
                kind: EntryKind::Component,
                path: "receiver/primary".into(),
                previous_path: "donor/primary".into(),
            }],
            diagnostics: vec![],
        },
    )
}

/// Supply the generation fence only to tests that project affected workspaces.
pub(super) fn with_lookup(result: &mut ComparisonResult) {
    let catalogue = result.after.catalogue().clone();
    result.after = Arc::new(Unimock::new((
        RenderGenerationMock::generation_key
            .each_call(matching!())
            .returns("projection-generation"),
        RenderGenerationMock::catalogue
            .each_call(matching!())
            .returns(catalogue),
    )));
}
