//! A watched candidate tells the publication that it starts after the debounce and before its
//! preparation reads an input.

use std::collections::BTreeSet;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use mokly_catalogue::config::ConfigLoaderMock;
use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_cli::grammar::Common;
use mokly_cli::serve::CatalogueServe;
use mokly_server::publication::PublicationWriterMock;
use mokly_server::shutdown::FixedLifecycle;
use mokly_watch::event::{Action, Event, Kind};
use mokly_watch::plan::Plan;
use tokio::sync::{Notify, mpsc, oneshot};
use unimock::{MockFn, Unimock, matching};

use crate::serve_candidates::ManualCandidates;
use crate::serve_rebuild::{ManualRebuilds, RebuildReporterMock, ServeActions};
use crate::serve_watch::WatchInputsMock;
use crate::warning_support::invalid;

use super::serve_rebuild_tests::warning_scopes;

#[tokio::test(start_paused = true)]
async fn a_watched_candidate_signals_its_start_after_the_debounce_and_before_its_preparation() {
    let config = ResolvedConfig {
        input: Config::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        modules: Default::default(),
        authored_inputs: vec![],
        roots: vec![],
    };
    let mut plan = Plan::new(&config, &[], &[], &BTreeSet::new()).unwrap();
    plan.debounce = Duration::from_millis(30);
    let changed = Arc::new(Notify::new());
    let failed = Arc::new(Notify::new());
    let order = Arc::new(Mutex::new(Vec::new()));
    let record = |name: &'static str| {
        let order = order.clone();
        move || order.lock().unwrap().push(name)
    };
    let (candidate, begin, load) = (record("candidate"), record("begin"), record("load"));
    let mock = Unimock::new((
        WatchInputsMock::plan.each_call(matching!()).returns(plan),
        WatchInputsMock::changed
            .each_call(matching!())
            .answers_arc(Arc::new({
                let changed = changed.clone();
                move |_| {
                    let changed = changed.clone();
                    Box::pin(async move { changed.notified().await })
                }
            })),
        WatchInputsMock::drain
            .next_call(matching!(_, _))
            .answers(&|_, batch, _| {
                let event = Event {
                    path: "/repo/specs/screen.html".into(),
                    kind: Kind::File,
                };
                batch.insert(event, Action::Rebuild);
                true
            }),
        PublicationWriterMock::candidate
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| candidate())),
        WatchInputsMock::begin
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| begin())),
        ConfigLoaderMock::load
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, _, _| {
                load();
                Err(invalid(vec![]))
            })),
        WatchInputsMock::failed.each_call(matching!()).returns(()),
        RebuildReporterMock::watched_catalogue_failure
            .each_call(matching!(_, _, _, _))
            .answers_arc(Arc::new({
                let failed = failed.clone();
                move |_, _, _, _, _| failed.notify_one()
            })),
    ));
    let (warnings, _terminal) = warning_scopes();
    let unused = Unimock::new(());
    let action = ManualRebuilds {
        activity: None,
        warnings,
        watching: Some(Arc::new(mock.clone())),
        candidates: Arc::new(ManualCandidates::new(Arc::new(FixedLifecycle))),
        preparation: Arc::new(CatalogueServe {
            config: Arc::new(mock.clone()),
            catalogue: Arc::new(unused.clone()),
            graphs: Arc::new(unused.clone()),
        }),
        states: Arc::new(unused.clone()),
        publications: Arc::new(unused.clone()),
        writer: Arc::new(mock.clone()),
        reporter: Arc::new(mock.clone()),
        cwd: "/repo".into(),
        options: Common::default(),
    };
    let (_requests, receiver) = mpsc::channel(1);
    let (stop, stopping) = oneshot::channel::<()>();
    let serving = Box::pin(async move {
        let _ = stopping.await;
        Ok(())
    });
    let task = tokio::spawn(async move { action.run(serving, receiver).await });
    changed.notify_one();
    tokio::task::yield_now().await;
    tokio::time::advance(Duration::from_millis(29)).await;
    assert_eq!(
        *order.lock().unwrap(),
        Vec::<&str>::new(),
        "no candidate starts before the debounce deadline"
    );
    tokio::time::advance(Duration::from_millis(1)).await;
    failed.notified().await;
    assert_eq!(*order.lock().unwrap(), ["candidate", "begin", "load"]);
    stop.send(()).unwrap();
    task.await.unwrap().unwrap();
}
