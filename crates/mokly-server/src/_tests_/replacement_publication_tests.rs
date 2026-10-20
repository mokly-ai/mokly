//! A metadata-only edit publishes once when its document usage is already ready.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_graph::key::NodeKey;
use mokly_graph::types::{DocumentPlan, RenderGeneration, RenderGenerationMock};
use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::catalogue::{
    CatalogueModel, EntryContent, EntryMetadata, ModelEntry, SourceLocation, UseCaseStep,
    VisualEntry,
};
use mokly_model::prop_schema::{JsonType, PropSchema, Types};
use mokly_model::routes;
use tokio::sync::broadcast::error::TryRecvError;
use unimock::{MockFn, Unimock, matching};

use crate::backend::DocumentsMock;
use crate::detail_encoding::ValidatedDetails;
use crate::evidence;
use crate::publication::{PublicationWriter, Publications, SharedPublication};
use crate::publication_support::ready;
use crate::snapshot::{Projector, SnapshotFactory, SnapshotInput};

fn metadata(path: &str, title: &str) -> EntryMetadata {
    EntryMetadata {
        path: path.into(),
        title: title.into(),
        description: String::new(),
        tags: Vec::new(),
        rationale: None,
        related_docs: Vec::new(),
        moved_from: None,
        moved_from_source: None,
        variant_of: None,
        is_index: false,
        source: SourceLocation {
            path: format!("specs/{path}"),
            line: 1,
            column: 1,
            export: None,
        },
        root_index: 0,
    }
}

fn generation(title: &str) -> Arc<dyn RenderGeneration> {
    let catalogue = PreparedCatalogue {
        model: CatalogueModel {
            entries: vec![
                ModelEntry {
                    metadata: metadata("home", "Home"),
                    content: EntryContent::Screen {
                        visual: VisualEntry {
                            control_order: Vec::new(),
                            color_schemes: vec![ColorScheme::Light],
                            prop_schema: PropSchema {
                                types: Some(Types::Single(JsonType::Object)),
                                properties: Some(BTreeMap::new()),
                                required: Some(Vec::new()),
                                additional_properties: Some(false),
                                ..Default::default()
                            },
                            props: BTreeMap::new(),
                            controls: BTreeMap::new(),
                        },
                        address: None,
                        use_case_paths: vec!["tour".into()],
                    },
                },
                ModelEntry {
                    metadata: metadata("tour", title),
                    content: EntryContent::UseCase {
                        steps: vec![UseCaseStep {
                            screen_path: "home".into(),
                            title: None,
                            description: None,
                        }],
                    },
                },
            ],
            folders: Vec::new(),
            sources: Vec::new(),
            color_schemes: vec![ColorScheme::Light],
        },
        inventory: Default::default(),
        templates: BTreeMap::new(),
        documents: BTreeMap::new(),
        slot_fragments: BTreeMap::new(),
        elements: BTreeMap::new(),
        deferred_modules: Vec::new(),
        javascript: Default::default(),
        warnings: Vec::new(),
    };
    let plans = [Viewport::Mobile, Viewport::Desktop]
        .into_iter()
        .map(|viewport| {
            let route = routes::view("home", viewport, ColorScheme::Light);
            (
                route.clone(),
                DocumentPlan {
                    resource_key: "resources".into(),
                    route,
                    key: NodeKey("c".repeat(64)),
                    entry: 0,
                    viewport: Some(viewport),
                    color_scheme: ColorScheme::Light,
                    stylesheets: Vec::new(),
                },
            )
        })
        .collect::<BTreeMap<_, _>>();
    Arc::new(Unimock::new((
        RenderGenerationMock::catalogue
            .each_call(matching!())
            .returns(catalogue),
        RenderGenerationMock::plans
            .each_call(matching!())
            .returns(plans),
        RenderGenerationMock::generation_key
            .each_call(matching!())
            .returns("d".repeat(64)),
    )))
}

#[test]
fn a_use_case_title_only_edit_publishes_exactly_one_revision() {
    let projector: &dyn SnapshotFactory = &Projector {
        deployment_id: "a".repeat(64),
        render_token: "b".repeat(64),
    };
    let initial = projector
        .create(
            generation("Tour"),
            SnapshotInput {
                documents: Arc::new(Unimock::new(
                    DocumentsMock::usage
                        .each_call(matching!(_))
                        .answers(&|_, _| Some(ready()))
                        .n_times(2),
                )),
                revision: 1,
                config_path: "mokly.config.json".into(),
                base: None,
                assets: BTreeMap::new(),
            },
        )
        .unwrap();
    let routes: Vec<_> = initial
        .routes
        .iter()
        .map(|view| view.route.clone())
        .collect();
    let publications = SharedPublication::new(initial.clone());
    publications.completed_many(&initial, &routes).unwrap();
    let previous = publications.current();
    assert_eq!(previous.completed.len(), 2);
    let mut events = publications.subscribe();
    let replacement = projector
        .replace(
            generation("Updated tour"),
            SnapshotInput {
                documents: Arc::new(Unimock::new(())),
                revision: previous.index.revision + 1,
                config_path: "mokly.config.json".into(),
                base: None,
                assets: BTreeMap::new(),
            },
            &previous,
        )
        .unwrap();
    assert_eq!(replacement.document_keys, previous.document_keys);
    assert!(publications.replace(replacement.clone()));
    let repeated = routes
        .iter()
        .map(|route| (route.clone(), ready()))
        .collect::<Vec<_>>();
    if let Some(next) = evidence::complete(&replacement, &repeated, &ValidatedDetails).unwrap() {
        assert!(publications.replace(next));
    }
    assert_eq!(
        publications.current().index.revision,
        previous.index.revision + 1
    );
    assert_eq!(
        publications.current().index.use_cases[0].entry.title,
        "Updated tour"
    );
    assert_eq!(
        events.updates.try_recv().unwrap().revision,
        previous.index.revision + 1
    );
    assert!(matches!(
        events.updates.try_recv(),
        Err(TryRecvError::Empty)
    ));
    assert_eq!(replacement.completed.len(), 2);
    assert!(
        replacement.details["home"]
            .views
            .iter()
            .all(|view| view.usage == ready())
    );
    assert!(replacement.details["home"].workspace.is_some());
    publications.completed_many(&replacement, &routes).unwrap();
    assert_eq!(
        publications.current().index.revision,
        previous.index.revision + 1
    );
}
