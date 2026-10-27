//! Small in-memory snapshots for publication and queue tests.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_model::axes::EntryKind;
use mokly_model::catalogue::CatalogueModel;
use mokly_model::projection;
use mokly_model::public_detail::{DetailEntry, DetailView, EntryDetailV3};
use mokly_model::public_index::CatalogueNode;
use mokly_model::public_metadata::{CatalogueChanges, ComparisonSelection};
use mokly_model::readers;
use mokly_model::usage::CatalogueUsage;
use mokly_model::usage_schemas::UsageSchemas;

use crate::backend::Documents;
use crate::detail_encoding::{DetailEncoder, ValidatedDetails};
use crate::evidence::{self, RenderRoute};
use crate::generation::Generation;
use crate::revision::RevisionLease;
use crate::snapshot::Snapshot;

pub(crate) fn snapshot(count: usize, documents: Arc<dyn Documents>) -> Arc<Snapshot> {
    let mut index = readers::index(include_str!(
        "../../../../docs/protocol/fixtures/catalogue-v8.json"
    ))
    .unwrap();
    index.revision = 1;
    let template = index.screens[0].clone();
    let original_screens = std::mem::take(&mut index.screens);
    let mut details = BTreeMap::new();
    let mut routes = Vec::new();
    let mut files = BTreeMap::new();
    for number in 0..count {
        let path = format!("screen-{number}");
        let mut screen = template.clone();
        screen.entry.path = path.clone();
        screen.entry.changes = CatalogueChanges::Unavailable;
        screen.use_case_paths.clear();
        screen.visual.views[0].comparison = ComparisonSelection::Unavailable;
        screen.visual.views[1].comparison = ComparisonSelection::Unavailable;
        let view = &screen.visual.views[0];
        let desktop = &screen.visual.views[1];
        let detail = EntryDetailV3 {
            schema_version: 3,
            control_order: Some(screen.visual.controls.keys().cloned().collect()),
            identity: index.identity.clone(),
            detail_id: "d".repeat(64),
            revision: Some(1),
            entry: DetailEntry {
                path: path.clone(),
                kind: EntryKind::Screen,
                snapshot_id: None,
            },
            views: vec![
                DetailView {
                    viewport: view.viewport,
                    color_scheme: view.color_scheme,
                    usage: CatalogueUsage::Pending,
                    state: None,
                    ignored_ids: None,
                    resource_evidence: None,
                },
                DetailView {
                    viewport: desktop.viewport,
                    color_scheme: desktop.color_scheme,
                    usage: ready(),
                    state: None,
                    ignored_ids: None,
                    resource_evidence: None,
                },
            ],
            resource_evidence: None,
            reasons: None,
            before: None,
            workspace: None,
        };
        routes.push(RenderRoute {
            route: format!("{path}/index.mobile.html"),
            path: path.clone(),
            viewport: Some(view.viewport),
            color_scheme: view.color_scheme,
        });
        index.screens.push(screen);
        details.insert(path, Arc::new(detail));
    }
    let synthetic_paths: Vec<_> = details.keys().cloned().collect();
    index.screens.extend(original_screens);
    index.tree.extend(
        synthetic_paths
            .into_iter()
            .map(|path| CatalogueNode::Entry {
                path,
                hidden: None,
                order: None,
                children: None,
            }),
    );
    for (path, detail) in &details {
        projection::set_detail_id(&mut index, path, &detail.detail_id);
    }
    let mut schemas = UsageSchemas::new(&index.components);
    for (path, detail) in &details {
        files.insert(
            format!("mokly-viewer/entries/{path}.json"),
            ValidatedDetails
                .encode(detail, &index, &mut schemas)
                .unwrap(),
        );
    }
    Arc::new(Snapshot {
        changes: None,
        document_keys: BTreeMap::new(),
        generation: Arc::new(Generation {
            model: Arc::new(empty_model()),
            view_keys: Vec::new(),
            config_path: "mokly.config.json".into(),
            changes: None,
            views: routes
                .iter()
                .map(|route| (route.route.clone(), route.clone()))
                .collect(),
            entries: details.keys().cloned().collect(),
            routes,
            documents,
            assets: BTreeMap::new(),
            stub: "shell".into(),
            render_token: "secret".into(),
        }),
        details,
        files,
        index,
        completed: BTreeMap::new(),
        lease: Arc::new(RevisionLease::default()),
    })
}

pub(crate) fn ready() -> CatalogueUsage {
    CatalogueUsage::Ready {
        instances: Vec::new(),
        slots: Vec::new(),
        ranges: Vec::new(),
    }
}

pub(crate) fn empty_model() -> CatalogueModel {
    CatalogueModel {
        entries: Vec::new(),
        folders: Vec::new(),
        sources: Vec::new(),
        color_schemes: Vec::new(),
    }
}

/// Published ready evidence whose routes have not yet been recorded as completed.
pub(crate) fn unrecorded_ready(count: usize, documents: Arc<dyn Documents>) -> Arc<Snapshot> {
    let initial = snapshot(count, documents);
    let updates = initial
        .routes
        .iter()
        .map(|view| (view.route.clone(), ready()))
        .collect::<Vec<_>>();
    let published = evidence::complete(&initial, &updates, &ValidatedDetails)
        .unwrap()
        .unwrap();
    let mut unrecorded = (*published).clone();
    unrecorded.completed.clear();
    Arc::new(unrecorded)
}
