//! Historical HTML waits once before dependency selection and graph preparation.

use std::path::Path;
use std::sync::{Arc, Mutex};

use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_cli::cancellation::BuildCancellation;
use mokly_compare::base_render::{
    BasePreparationResult, BaseProvider, BaseRequest, HistoricalSources,
};
use mokly_compare::cache_types::Lease;
use mokly_compare::comparison_steps::{Step, StepsMock};
use mokly_compare::error::Error;
use mokly_compare::sources::SourcesMock;
use mokly_git::identity::ObjectId;
use mokly_graph::types::RenderGenerationMock;
use mokly_graph::workers::RenderWorkersMock;
use mokly_model::catalogue::CatalogueModel;
use mokly_render::runtime::Runtime;
use mokly_source_interface::tree::{Child, FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::base_dependencies::BaseDependenciesMock;
use crate::changes_base::NativeBase;
use crate::serve_preparation_control::PreparationControlMock;

type Events = Arc<Mutex<Vec<&'static str>>>;

fn catalogue() -> PreparedCatalogue {
    PreparedCatalogue {
        model: CatalogueModel {
            entries: Vec::new(),
            folders: Vec::new(),
            sources: Vec::new(),
            color_schemes: Vec::new(),
        },
        inventory: Default::default(),
        templates: Default::default(),
        documents: Default::default(),
        slot_fragments: Default::default(),
        elements: Default::default(),
        prop_validators: Default::default(),
        javascript: Default::default(),
        dependency_directories: Default::default(),
        warnings: Vec::new(),
    }
}

fn tree(events: Events) -> Unimock {
    let reads = events.clone();
    let inventory = events.clone();
    Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, path| {
                let kind = match path.to_str() {
                    Some("/repo" | "/repo/specs") => FileKind::Directory,
                    Some("/repo/mokly.config.json" | "/repo/specs/card.screen.html") => {
                        FileKind::File
                    }
                    _ => return Ok(None),
                };
                Ok(Some(Node {
                    identity: path.into(),
                    kind,
                    lexical_kind: kind,
                }))
            }),
        SourceTreeMock::read
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                if path == Path::new("/repo/mokly.config.json") {
                    reads.lock().unwrap().push("configuration");
                    Ok(b"{}".to_vec())
                } else {
                    assert_eq!(path, Path::new("/repo/specs/card.screen.html"));
                    reads.lock().unwrap().push("HTML");
                    Ok(b"---\ntitle: Card\n---\n<div>Card</div>".to_vec())
                }
            })),
        SourceTreeMock::children
            .each_call(matching!((path) if *path == Path::new("/repo/specs")))
            .answers_arc(Arc::new(move |_, _| {
                inventory.lock().unwrap().push("inventory");
                Ok(vec![Child {
                    name: "card.screen.html".into(),
                    kind: FileKind::File,
                }])
            })),
        SourceTreeMock::prefetch
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                events.lock().unwrap().push("validation");
                Ok(())
            })),
    ))
    .no_verify_in_drop()
}

fn prepare(cancel_wait: bool) -> (BasePreparationResult, Events) {
    let events = Events::default();
    let waits = events.clone();
    let selected = events.clone();
    let head_events = events.clone();
    let graph = events.clone();
    let extraction = events.clone();
    let attached = events.clone();
    let rendering = events.clone();
    let provider: &dyn BaseProvider = &NativeBase {
        preparation: Some(Arc::new(
            Unimock::new((
                PreparationControlMock::wait
                    .each_call(matching!())
                    .answers_arc(Arc::new(move |_| {
                        waits.lock().unwrap().push("wait");
                        if cancel_wait {
                            Err(Error::Cancelled)
                        } else {
                            Ok(())
                        }
                    })),
                PreparationControlMock::selected
                    .each_call(matching!((false, directories, unmapped)
                        if directories.is_empty() && unmapped.is_empty()))
                    .answers_arc(Arc::new(move |_, _, _, _| {
                        selected.lock().unwrap().push("selection");
                    })),
            ))
            .no_verify_in_drop(),
        )),
        runtime: Arc::new(Runtime::new(
            Arc::new(Unimock::new(())),
            Arc::new(
                Unimock::new(
                    SourceTreeMock::project
                        .each_call(matching!(_))
                        .answers(&|_, _| Ok(None)),
                )
                .no_verify_in_drop(),
            ),
            Arc::new(Unimock::new(())),
            Arc::new(Unimock::new(())),
            Arc::new(Unimock::new(())),
            Arc::new(
                Unimock::new(
                    RenderWorkersMock::stylesheets
                        .each_call(matching!(_))
                        .answers_arc(Arc::new(move |_, _, _| {
                            graph.lock().unwrap().push("graph");
                            Ok(Vec::new())
                        })),
                )
                .no_verify_in_drop(),
            ),
            "test".into(),
            None,
        )),
        cancellation: Arc::new(BuildCancellation::new(Arc::new(Unimock::new(())))),
        dependencies: Arc::new(Unimock::new(
            BaseDependenciesMock::existing_sources
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    extraction.lock().unwrap().push("extraction");
                    Ok(Some(Arc::new(Lease {
                        directory: "/base".into(),
                        guard: Box::new(Unimock::new(())),
                    })))
                })),
        )),
        freshness: None,
    };
    let head = Unimock::new(
        RenderGenerationMock::catalogue
            .each_call(matching!())
            .answers_arc(Arc::new(move |mock| {
                head_events.lock().unwrap().push("head directories");
                mock.make_ref(catalogue())
            })),
    )
    .no_verify_in_drop();
    let working_config = ResolvedConfig {
        input: Config {
            renderer: Some("renderer.tsx".into()),
            ..Config::default()
        },
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        roots: Vec::new(),
        authored_inputs: Vec::new(),
    };
    let result = provider.prepare(&BaseRequest {
        head: &head,
        working_config: &working_config,
        repository: Arc::new(Unimock::new(())),
        commit: ObjectId::parse(&"a".repeat(40)).unwrap(),
        install_scripts: false,
        sources: HistoricalSources {
            tree: Arc::new(tree(events.clone())),
            sources: Arc::new(Unimock::new(
                SourcesMock::attach
                    .each_call(matching!((lease) if lease.directory == Path::new("/base")))
                    .answers_arc(Arc::new(move |_, _| {
                        attached.lock().unwrap().push("attach");
                        Ok(())
                    })),
            )),
            failures: Arc::new(Unimock::new(())),
        },
        steps: Arc::new(
            Unimock::new(
                StepsMock::step
                    .each_call(matching!(Step::Rendering))
                    .answers_arc(Arc::new(move |_, _| {
                        rendering.lock().unwrap().push("rendering");
                    })),
            )
            .no_verify_in_drop(),
        ),
    });
    (result, events)
}

#[test]
fn historical_html_waits_once_before_selection_validation_and_graph_work() {
    let (result, events) = prepare(false);
    assert_eq!(
        *events.lock().unwrap(),
        [
            "extraction",
            "attach",
            "configuration",
            "inventory",
            "wait",
            "head directories",
            "selection",
            "rendering",
            "validation",
            "HTML",
            "graph",
            "HTML",
        ]
    );
    let prepared = result.unwrap();
    assert!(!prepared.scripts_off);
    assert_eq!(prepared.generation.catalogue().model.entries.len(), 1);
}

#[test]
fn cancelled_html_wait_stops_before_dependency_selection_or_graph_work() {
    let (result, events) = prepare(true);
    assert!(
        matches!(result, Err(error) if !error.scripts_off && matches!(*error.source, Error::Cancelled))
    );
    assert_eq!(
        *events.lock().unwrap(),
        ["extraction", "attach", "configuration", "inventory", "wait"]
    );
}
