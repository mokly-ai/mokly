//! Candidate ownership, repair events, adoption subscriptions, and queued resources.

use std::collections::BTreeSet;
use std::sync::{Arc, Mutex};
use std::time::SystemTime;

use mokly_catalogue::config_types::{Config, ResolvedConfig, ResolvedRoot, RootConfig};
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_cli::build::{BuildChanges, BuildSummary};
use mokly_cli::serve::PreparedServe;
use mokly_graph::types::RenderGenerationMock;
use mokly_model::catalogue::CatalogueModel;
use mokly_server::error::ServerError;
use mokly_watch::event::{Action, Batch, Event, Kind};
use mokly_watch::observer::{Observer, ObserverMock};
use mokly_watch::plan::Plan;
use tokio::sync::Notify;
use unimock::{MockFn, Unimock, matching};

use crate::serve_rebuild::RebuildReporterMock;

use super::{State, WatchInputs, WatchedInputs};
use crate::serve_watch_files::ObserversMock;

fn config(dir: &str) -> ResolvedConfig {
    ResolvedConfig {
        input: Config::default(),
        repo_root: "/repo".into(),
        file: "/repo/mokly.config.json".into(),
        modules: Default::default(),
        authored_inputs: vec![],
        roots: vec![ResolvedRoot {
            directory: format!("/repo/{dir}").into(),
            identity: format!("/repo/{dir}").into(),
            input: RootConfig {
                dir: dir.into(),
                files: None,
                path: None,
                transparent: None,
            },
        }],
    }
}
pub(super) fn plan(dir: &str) -> Plan {
    Plan::new(&config(dir), &[], &[], &BTreeSet::new()).unwrap()
}
pub(super) fn catalogue() -> PreparedCatalogue {
    PreparedCatalogue {
        model: CatalogueModel {
            entries: vec![],
            folders: vec![],
            sources: vec!["src/new.ts".into()],
            color_schemes: vec![],
        },
        inventory: Default::default(),
        templates: Default::default(),
        documents: Default::default(),
        slot_fragments: Default::default(),
        elements: Default::default(),
        prop_validators: Default::default(),
        javascript: Default::default(),
        dependency_directories: Default::default(),
        warnings: vec![],
    }
}
pub(super) fn prepared(dir: &str, generation: Unimock) -> PreparedServe {
    PreparedServe {
        config: config(dir),
        generation: Arc::new(generation),
        summary: BuildSummary {
            changes: BuildChanges::Disabled,
            documents: 0,
            counts: Default::default(),
            warnings: vec![],
        },
    }
}
pub(super) fn watch(observer: Arc<dyn Observer>, factory: Unimock) -> Arc<WatchedInputs> {
    Arc::new(WatchedInputs {
        factory: Arc::new(factory),
        ready: Arc::new(Notify::new()),
        state: Arc::new(Mutex::new(State {
            plan: plan("specs"),
            resources: None,
            observer,
            pending: BTreeSet::new(),
            refresh: false,
            failed: false,
            attach_reported: false,
            closed: false,
            started: SystemTime::UNIX_EPOCH,
            record: None,
        })),
    })
}
pub(super) fn event(path: &str, kind: Kind) -> Event {
    Event {
        path: format!("/repo/{path}").into(),
        kind,
    }
}

#[test]
fn exact_additions_extend_the_active_observer_without_a_second_preparation() {
    let observer = Arc::new(Unimock::new((
        ObserverMock::observes.each_call(matching!(_)).returns(true),
        ObserverMock::replace.next_call(matching!((plan) if plan.exact.contains_key(std::path::Path::new("/repo/src/new.ts")))).returns(Ok(())),
    )));
    let watch = watch(observer.clone(), Unimock::new(()));
    let generation = Unimock::new((
        RenderGenerationMock::observe_resources
            .some_call(matching!(_))
            .returns(()),
        RenderGenerationMock::catalogue
            .next_call(matching!())
            .returns(catalogue()),
        RenderGenerationMock::stylesheet_directories
            .next_call(matching!())
            .returns(vec![]),
        RenderGenerationMock::watch_files
            .next_call(matching!())
            .returns(BTreeSet::new()),
    ));
    let candidate = watch.candidate(&prepared("specs", generation)).unwrap();
    assert!(!candidate.recheck);
    assert!(Arc::ptr_eq(
        &candidate.observer,
        &watch.state.lock().unwrap().observer
    ));
    assert_eq!(watch.plan().roots, plan("specs").roots);
}

#[test]
fn failed_root_attachment_retains_the_active_observer_and_plan() {
    let observer = Arc::new(Unimock::new(
        ObserverMock::observes.each_call(matching!(_)).returns(true),
    ));
    let factory = Unimock::new(
        ObserversMock::attach
            .next_call(matching!(_))
            .returns(Err(ServerError::InvalidAssets)),
    );
    let watch = watch(observer, factory);
    let generation = Unimock::new((
        RenderGenerationMock::catalogue
            .next_call(matching!())
            .returns(catalogue()),
        RenderGenerationMock::stylesheet_directories
            .next_call(matching!())
            .returns(vec![]),
        RenderGenerationMock::watch_files
            .next_call(matching!())
            .returns(BTreeSet::new()),
    ));
    let old = watch.state.lock().unwrap().observer.clone();
    assert!(watch.candidate(&prepared("next", generation)).is_err());
    assert!(Arc::ptr_eq(&old, &watch.state.lock().unwrap().observer));
    assert_eq!(watch.plan().roots, plan("specs").roots);
}

#[tokio::test]
async fn failed_attempts_accept_repaired_imports_and_directory_events_rescan_once() {
    let observer = Unimock::new((
        ObserverMock::take
            .next_call(matching!())
            .returns(vec![Ok(event("specs/helper.ts", Kind::File))]),
        ObserverMock::take.next_call(matching!()).returns(vec![
            Ok(event("specs/helper.ts", Kind::File)),
            Ok(event("specs/target/helper.ts", Kind::File)),
        ]),
        ObserverMock::take
            .next_call(matching!())
            .returns(vec![Ok(event("specs/new", Kind::Directory))]),
        ObserverMock::rescan.next_call(matching!(_)).returns(Ok(())),
    ));
    let watch = watch(Arc::new(observer.clone()), Unimock::new(()));
    let reporter = Arc::new(Unimock::new(()));
    let mut batch = Batch::default();
    assert!(!watch.drain(&mut batch, reporter.clone()).await);
    watch.failed();
    assert!(watch.drain(&mut batch, reporter.clone()).await);
    assert_eq!(batch.events.len(), 1);
    assert_eq!(batch.action, Some(Action::Rebuild));
    assert!(watch.drain(&mut batch, reporter).await);
    assert_eq!(batch.events.len(), 2);
}

#[tokio::test]
async fn resource_attach_failures_reach_the_reporter_once() {
    let observer = Unimock::new((
        ObserverMock::take
            .each_call(matching!())
            .answers(&|_| vec![Ok(event("specs/new", Kind::Directory))]),
        ObserverMock::rescan
            .each_call(matching!(_))
            .answers(&|_, _| Err(mokly_watch::error::Error::Rescan)),
    ));
    let reporter = Unimock::new(
        RebuildReporterMock::server_failure
            .next_call(matching!(_, _))
            .returns(()),
    );
    let watch = watch(Arc::new(observer.clone()), Unimock::new(()));
    for _ in 0..2 {
        assert!(
            watch
                .drain(&mut Batch::default(), Arc::new(reporter.clone()))
                .await
        );
    }
}
