//! Scripted catalogue passes and pure warning fixtures for Serve orchestration tests.

use std::collections::{BTreeMap, VecDeque};
use std::sync::{Arc, Mutex};

use mokly_catalogue::config::ConfigLoaderMock;
use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_catalogue::diagnostic::{Code, Issue, Warning, WarningSubject};
use mokly_catalogue::error::CatalogueError;
use mokly_catalogue::preparation::{CatalogueBuilderMock, PreparedCatalogue};
use mokly_cli::cancellation::ServeCancellation;
use mokly_cli::output::{Mode, Style};
use mokly_cli::redaction::Redactor;
use mokly_cli::serve::{CatalogueServe, ServePreparation};
use mokly_graph::types::{GraphFactoryMock, RenderGeneration, RenderGraph, RenderGraphMock};
use mokly_model::catalogue::CatalogueModel;
use mokly_watch::plan::Plan;
use unimock::{MockFn, Unimock, matching};

use crate::serve_warnings::{ServeWarnings, WarningScopes};

/// One normalized record with a stable subject.
pub(crate) fn warning(message: &str) -> Warning {
    Warning {
        code: "html-unused-props",
        subject: WarningSubject::Entry("home".into()),
        message: message.into(),
    }
}

/// A resolved configuration with no IO or authored inputs.
pub(crate) fn config() -> ResolvedConfig {
    ResolvedConfig {
        input: Config::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        roots: vec![],
        authored_inputs: vec![],
    }
}

/// Watch plan for the empty scripted catalogue.
pub(crate) fn plan() -> Plan {
    Plan::new(&config(), &[], &[], &Default::default()).unwrap()
}

/// Prepared metadata for a successful scripted pass.
pub(crate) fn catalogue(warnings: Vec<Warning>) -> PreparedCatalogue {
    PreparedCatalogue {
        model: CatalogueModel {
            entries: vec![],
            folders: vec![],
            sources: vec![],
            color_schemes: vec![],
        },
        inventory: Default::default(),
        templates: BTreeMap::new(),
        documents: BTreeMap::new(),
        slot_fragments: BTreeMap::new(),
        elements: BTreeMap::new(),
        deferred_modules: vec![],
        javascript: Default::default(),
        dependency_directories: Default::default(),
        warnings,
    }
}

/// A preparation error retaining its warning records.
pub(crate) fn invalid(warnings: Vec<Warning>) -> CatalogueError {
    CatalogueError::Invalid {
        issues: vec![Issue::new(Code::HtmlElement, "unknown element ui-missing")],
        warnings,
    }
}

/// Mock owners remain on the test thread until preparation handles drop.
pub(crate) struct Scripted {
    /// Preparation boundary consumed by startup and rebuild tests.
    pub(crate) preparation: Arc<dyn ServePreparation>,
    _guards: Vec<Unimock>,
}

impl Scripted {
    /// Supply each pass result in call order.
    pub(crate) fn new(passes: Vec<Result<PreparedCatalogue, CatalogueError>>) -> Self {
        let count = passes.len();
        let successes = passes.iter().filter(|pass| pass.is_ok()).count();
        let pending = Mutex::new(VecDeque::from(passes));
        let generation = Unimock::new(());
        let graph = if successes == 0 {
            Unimock::new(())
        } else {
            Unimock::new(
                RenderGraphMock::prepare
                    .each_call(matching!(_, _, _))
                    .answers_arc(Arc::new({
                        let generation = generation.clone();
                        move |_, _, _, _| {
                            Ok(Arc::new(generation.clone()) as Arc<dyn RenderGeneration>)
                        }
                    }))
                    .n_times(successes),
            )
        };
        let factory = if successes == 0 {
            Unimock::new(())
        } else {
            Unimock::new(
                GraphFactoryMock::create
                    .each_call(matching!(_))
                    .answers_arc(Arc::new({
                        let graph = graph.clone();
                        move |_, _| Ok(Arc::new(graph.clone()) as Arc<dyn RenderGraph>)
                    }))
                    .n_times(successes),
            )
        };
        let mock = Unimock::new((
            ConfigLoaderMock::load
                .each_call(matching!(_, _))
                .answers(&|_, _, _| Ok(config()))
                .n_times(count),
            CatalogueBuilderMock::prepare
                .each_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, _, _| {
                    pending.lock().unwrap().pop_front().unwrap()
                }))
                .n_times(count),
        ));
        Self {
            preparation: Arc::new(CatalogueServe {
                config: Arc::new(mock.clone()),
                catalogue: Arc::new(mock.clone()),
                graphs: Arc::new(factory.clone()),
            }),
            _guards: vec![mock, factory, graph, generation],
        }
    }
}

/// Create a sink whose terminal is owned by the calling test.
pub(crate) fn scopes(terminal: &Unimock) -> Arc<dyn WarningScopes> {
    Arc::new(ServeWarnings::new(
        Arc::new(ServeCancellation::default()),
        Arc::new(terminal.clone()),
        Style {
            mode: Mode::Plain,
            color: false,
            ascii: false,
            columns: 200,
        },
        Arc::new(Redactor::default()),
    ))
}
