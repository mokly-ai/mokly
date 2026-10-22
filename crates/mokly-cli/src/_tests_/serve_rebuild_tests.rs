//! Rebuild projection yields to serving and reuses a candidate after a revision race.

use std::collections::BTreeMap;
use std::sync::{Arc, Condvar, Mutex};
use std::time::Duration;

use mokly_catalogue::config::ConfigLoaderMock;
use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_catalogue::preparation::{CatalogueBuilderMock, PreparedCatalogue};
use mokly_cli::cancellation::ServeCancellation;
use mokly_cli::grammar::Common;
use mokly_cli::output::{Mode, Style};
use mokly_cli::redaction::Redactor;
use mokly_cli::serve::CatalogueServe;
use mokly_graph::types::{GraphFactoryMock, RenderGeneration, RenderGraph, RenderGraphMock};
use mokly_model::catalogue::CatalogueModel;
use mokly_model::readers;
use mokly_server::generation::Generation;
use mokly_server::publication::{PublicationWriterMock, PublicationsMock};
use mokly_server::revision::RevisionLease;
use mokly_server::shutdown::FixedLifecycle;
use mokly_server::snapshot::Snapshot;
use tokio::sync::{Notify, mpsc};
use unimock::{MockFn, Unimock, matching};

use crate::serve_candidates::ManualCandidates;
use crate::serve_rebuild::{ManualRebuilds, RebuildReporterMock, ServeActions};
use crate::serve_state::ServeStateFactoryMock;
use crate::serve_warnings::{ServeWarnings, WarningScopes};

pub(super) fn initial() -> Arc<Snapshot> {
    let mut index = readers::index(include_str!(
        "../../../../docs/protocol/fixtures/catalogue-v7.json"
    ))
    .unwrap();
    index.revision = 1;
    Arc::new(Snapshot {
        changes: None,
        document_keys: BTreeMap::new(),
        index,
        details: BTreeMap::new(),
        completed: BTreeMap::new(),
        files: BTreeMap::new(),
        lease: Arc::new(RevisionLease::default()),
        generation: Arc::new(Generation {
            model: Arc::new(CatalogueModel {
                entries: Vec::new(),
                folders: Vec::new(),
                sources: Vec::new(),
                color_schemes: Vec::new(),
            }),
            view_keys: Vec::new(),
            config_path: "mokly.config.json".into(),
            changes: None,
            routes: Vec::new(),
            views: BTreeMap::new(),
            assets: BTreeMap::new(),
            entries: Default::default(),
            stub: Default::default(),
            render_token: "secret".into(),
            documents: Arc::new(Unimock::new(())),
        }),
    })
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn serving_is_polled_during_projection_and_a_revision_race_does_not_recreate_it() {
    let origin = initial();
    let candidate = origin.at_revision(2);
    let entered = Arc::new(Notify::new());
    let serving_polled = Arc::new(Notify::new());
    let published = Arc::new(Notify::new());
    let release = Arc::new((Mutex::new(false), Condvar::new()));
    let config = ResolvedConfig {
        input: Config::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        authored_inputs: Vec::new(),
        roots: Vec::new(),
    };
    let prepared = PreparedCatalogue {
        javascript: Default::default(),
        dependency_directories: Default::default(),
        model: CatalogueModel {
            entries: Vec::new(),
            folders: Vec::new(),
            sources: Vec::new(),
            color_schemes: Vec::new(),
        },
        inventory: Default::default(),
        templates: BTreeMap::new(),
        documents: BTreeMap::new(),
        slot_fragments: BTreeMap::new(),
        elements: BTreeMap::new(),
        deferred_modules: Vec::new(),
        warnings: Vec::new(),
    };
    let rendered = Unimock::new(());
    let graph = Unimock::new(
        RenderGraphMock::prepare
            .next_call(matching!(_, _, _))
            .returns(Ok(Arc::new(rendered.clone()) as Arc<dyn RenderGeneration>)),
    );
    let mock = Unimock::new((
        ConfigLoaderMock::load
            .next_call(matching!(_, _))
            .returns(Ok(config)),
        CatalogueBuilderMock::prepare
            .next_call(matching!(_, _))
            .returns(Ok(prepared)),
        GraphFactoryMock::create
            .next_call(matching!(_))
            .returns(Ok(Arc::new(graph.clone()) as Arc<dyn RenderGraph>)),
        PublicationsMock::current
            .next_call(matching!())
            .returns(origin),
        ServeStateFactoryMock::replace
            .next_call(matching!(_, 2, _, _))
            .answers_arc(Arc::new({
                let entered = entered.clone();
                let release = release.clone();
                let candidate = candidate.clone();
                move |_, _, _, _, _| {
                    entered.notify_one();
                    let (lock, signal) = &*release;
                    let _released = signal
                        .wait_while(lock.lock().unwrap(), |released| !*released)
                        .unwrap();
                    Ok(candidate.clone())
                }
            })),
        PublicationWriterMock::replace
            .next_call(matching!((value) if value.index.revision == 2))
            .returns(false),
        PublicationsMock::current
            .next_call(matching!())
            .returns(candidate.clone()),
        PublicationWriterMock::replace
            .next_call(matching!((value) if value.index.revision == 3))
            .answers_arc(Arc::new({
                let candidate = candidate.clone();
                move |_, value| {
                    assert!(Arc::ptr_eq(&candidate.generation, &value.generation));
                    true
                }
            })),
        RebuildReporterMock::completed
            .next_call(matching!(_, _))
            .answers_arc(Arc::new({
                let published = published.clone();
                move |_, _, _| {
                    published.notify_one();
                }
            })),
    ));
    let (warnings, _warning_terminal) = warning_scopes();
    let action = ManualRebuilds {
        warnings,
        watching: None,
        candidates: Arc::new(ManualCandidates::new(Arc::new(FixedLifecycle))),
        preparation: Arc::new(CatalogueServe {
            config: Arc::new(mock.clone()),
            catalogue: Arc::new(mock.clone()),
            graphs: Arc::new(mock.clone()),
        }),
        states: Arc::new(mock.clone()),
        publications: Arc::new(mock.clone()),
        writer: Arc::new(mock.clone()),
        reporter: Arc::new(mock.clone()),
        cwd: "/repo".into(),
        options: Common::default(),
    };
    let (requests, receiver) = mpsc::channel(1);
    requests.send(()).await.unwrap();
    let task = tokio::spawn({
        let serving_polled = serving_polled.clone();
        async move {
            action
                .run(
                    Box::pin(async move {
                        entered.notified().await;
                        serving_polled.notify_one();
                        published.notified().await;
                        Ok(())
                    }),
                    receiver,
                )
                .await
        }
    });
    let polled = tokio::time::timeout(Duration::from_secs(15), serving_polled.notified()).await;
    let (lock, signal) = &*release;
    *lock.lock().unwrap() = true;
    signal.notify_one();
    assert!(
        polled.is_ok(),
        "server future was not polled while projection was blocked"
    );
    task.await.unwrap().unwrap();
}

pub(super) fn warning_scopes() -> (Arc<dyn WarningScopes>, Unimock) {
    let terminal = Unimock::new(());
    let scopes: Arc<dyn WarningScopes> = Arc::new(ServeWarnings::new(
        Arc::new(ServeCancellation::default()),
        Arc::new(terminal.clone()),
        Style {
            mode: Mode::Plain,
            color: false,
            ascii: false,
            columns: 200,
        },
        Arc::new(Redactor::default()),
    ));
    (scopes, terminal)
}
