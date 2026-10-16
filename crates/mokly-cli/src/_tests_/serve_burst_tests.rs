//! Requests received during active work coalesce into one later serialized rebuild.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Condvar, Mutex};

use mokly_catalogue::config::ConfigLoaderMock;
use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_catalogue::preparation::{CatalogueBuilderMock, PreparedCatalogue};
use mokly_cli::grammar::Common;
use mokly_cli::serve::CatalogueServe;
use mokly_graph::types::{GraphFactoryMock, RenderGeneration, RenderGraph, RenderGraphMock};
use mokly_model::catalogue::CatalogueModel;
use mokly_server::publication::{PublicationWriterMock, PublicationsMock};
use mokly_server::shutdown::FixedLifecycle;
use tokio::sync::{Notify, mpsc};
use unimock::{MockFn, Unimock, matching};

use crate::serve_candidates::ManualCandidates;
use crate::serve_rebuild::{ManualRebuilds, RebuildReporterMock, ServeActions};
use crate::serve_state::ServeStateFactoryMock;

use super::serve_rebuild_tests::{initial, warning_scopes};

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn an_active_rebuild_and_a_burst_produce_exactly_two_actions() {
    let current = Arc::new(Mutex::new(initial()));
    let entered = Arc::new(Notify::new());
    let finished = Arc::new(Notify::new());
    let release = Arc::new((Mutex::new(false), Condvar::new()));
    let count = Arc::new(AtomicUsize::new(0));
    let active = Arc::new(AtomicUsize::new(0));
    let reported = Arc::new(AtomicUsize::new(0));
    let generation: Arc<dyn RenderGeneration> = Arc::new(Unimock::new(()));
    let graph = Unimock::new(
        RenderGraphMock::prepare
            .each_call(matching!(_, _, _))
            .answers_arc(Arc::new(move |_, _, _, _| Ok(generation.clone())))
            .n_times(2),
    );
    let mock = Unimock::new((
        ConfigLoaderMock::load
            .each_call(matching!(_, _))
            .answers_arc(Arc::new({
                let count = count.clone();
                let active = active.clone();
                let entered = entered.clone();
                let release = release.clone();
                move |_, _, _| {
                    assert_eq!(active.fetch_add(1, Ordering::SeqCst), 0);
                    if count.fetch_add(1, Ordering::SeqCst) == 0 {
                        entered.notify_one();
                        let (mutex, ready) = &*release;
                        let _guard = ready
                            .wait_while(mutex.lock().unwrap(), |ready| !*ready)
                            .unwrap();
                    }
                    assert_eq!(active.fetch_sub(1, Ordering::SeqCst), 1);
                    Ok(ResolvedConfig {
                        input: Config::default(),
                        file: "/repo/mokly.config.json".into(),
                        repo_root: "/repo".into(),
                        authored_inputs: vec![],
                        roots: vec![],
                    })
                }
            }))
            .n_times(2),
        CatalogueBuilderMock::prepare
            .each_call(matching!(_, _))
            .answers(&|_, _, _| {
                Ok(PreparedCatalogue {
                    model: CatalogueModel {
                        entries: vec![],
                        folders: vec![],
                        sources: vec![],
                        color_schemes: vec![],
                    },
                    inventory: Default::default(),
                    templates: Default::default(),
                    documents: Default::default(),
                    slot_fragments: Default::default(),
                    elements: Default::default(),
                    deferred_modules: vec![],
                    javascript: Default::default(),
                    warnings: vec![],
                })
            })
            .n_times(2),
        GraphFactoryMock::create
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                Ok(Arc::new(graph.clone()) as Arc<dyn RenderGraph>)
            }))
            .n_times(2),
        PublicationsMock::current
            .each_call(matching!())
            .answers_arc(Arc::new({
                let current = current.clone();
                move |_| current.lock().unwrap().clone()
            })),
        ServeStateFactoryMock::replace
            .each_call(matching!(_, _, _, _))
            .answers(&|_, _, revision, previous, _| Ok(previous.at_revision(revision)))
            .n_times(2),
        PublicationWriterMock::replace
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let current = current.clone();
                move |_, next| {
                    let mut current = current.lock().unwrap();
                    assert_eq!(next.index.revision, current.index.revision + 1);
                    *current = next;
                    true
                }
            }))
            .n_times(2),
        RebuildReporterMock::completed
            .each_call(matching!(_, _))
            .answers_arc(Arc::new({
                let reported = reported.clone();
                let finished = finished.clone();
                move |_, _, _| {
                    if reported.fetch_add(1, Ordering::SeqCst) == 1 {
                        finished.notify_one();
                    }
                }
            }))
            .n_times(2),
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
    let task = tokio::spawn(async move {
        action
            .run(
                Box::pin(async move {
                    finished.notified().await;
                    Ok(())
                }),
                receiver,
            )
            .await
    });
    entered.notified().await;
    requests.try_send(()).unwrap();
    for _ in 0..8 {
        assert!(requests.try_send(()).is_err());
    }
    assert_eq!(count.load(Ordering::SeqCst), 1);
    {
        let (mutex, ready) = &*release;
        *mutex.lock().unwrap() = true;
        ready.notify_one();
    }
    task.await.unwrap().unwrap();
    assert_eq!(count.load(Ordering::SeqCst), 2);
    assert_eq!(reported.load(Ordering::SeqCst), 2);
    assert_eq!(current.lock().unwrap().index.revision, 3);
}
