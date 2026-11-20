//! Cancelled edit waiters retain local suppression through the failed blocking candidate.

use std::future::pending;
use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, mpsc};
use std::time::Duration;

use mokly_catalogue::config::ConfigLoaderMock;
use mokly_catalogue::diagnostic::Warning;
use mokly_cli::build::{BuildError, BuildSummary};
use mokly_cli::grammar::Common;
use mokly_cli::serve::CatalogueServe;
use mokly_graph::write_activity::{WriteActivityMock, WriteLease};
use mokly_server::error::ServerError;
use mokly_server::shutdown::FixedLifecycle;
use mokly_watch::event::Batch;
use tokio::sync::{Notify, mpsc::channel};
use unimock::{MockFn, Unimock, matching};

use crate::serve_candidates::ManualCandidates;
use crate::serve_rebuild::{ManualRebuilds, RebuildReporter, RebuildReporterMock, ServeActions};
use crate::warning_support::invalid;

use super::serve_rebuild_tests::warning_scopes;

struct Lease(Arc<AtomicUsize>, Arc<Notify>);
impl WriteLease for Lease {}
impl Drop for Lease {
    fn drop(&mut self) {
        self.0.fetch_sub(1, Ordering::SeqCst);
        self.1.notify_one();
    }
}
struct Release(mpsc::Sender<()>, mpsc::Receiver<()>);
impl Drop for Release {
    fn drop(&mut self) {
        let _ = self.0.send(());
        let _ = self.1.recv();
    }
}

struct Reporting {
    inner: Option<Arc<dyn RebuildReporter>>,
    destroyed: mpsc::Sender<()>,
}
impl RebuildReporter for Reporting {
    fn watcher_rescan(&self) {
        self.inner.as_ref().unwrap().watcher_rescan();
    }
    fn completed(&self, summary: &BuildSummary, elapsed: Duration) {
        self.inner.as_ref().unwrap().completed(summary, elapsed);
    }
    fn watched(
        &self,
        batch: &Batch,
        repository: &Path,
        summary: Option<&BuildSummary>,
        elapsed: Duration,
    ) {
        self.inner
            .as_ref()
            .unwrap()
            .watched(batch, repository, summary, elapsed);
    }
    fn catalogue_failure(&self, warnings: &[Warning], error: &BuildError) {
        self.inner
            .as_ref()
            .unwrap()
            .catalogue_failure(warnings, error);
    }
    fn server_failure(&self, warnings: &[Warning], error: &ServerError) {
        self.inner.as_ref().unwrap().server_failure(warnings, error);
    }
}
impl Drop for Reporting {
    fn drop(&mut self) {
        {
            let _inner = self.inner.take();
        }
        let _ = self.destroyed.send(());
    }
}

pub(super) fn activity() -> (Unimock, Arc<AtomicUsize>, Arc<Notify>) {
    let active = Arc::new(AtomicUsize::new(0));
    let finished = Arc::new(Notify::new());
    let current = active.clone();
    let ended = finished.clone();
    let mock = Unimock::new(
        WriteActivityMock::enter
            .some_call(matching!())
            .answers_arc(Arc::new(move |_| {
                current.fetch_add(1, Ordering::SeqCst);
                Box::new(Lease(current.clone(), ended.clone()))
            })),
    );
    (mock, active, finished)
}

#[tokio::test]
async fn cancelling_an_edit_waiter_keeps_suppression_until_its_failed_candidate_returns() {
    let (activity, active, finished) = activity();
    let started = Arc::new(Notify::new());
    let entered = started.clone();
    let (release, released) = mpsc::channel();
    let released = Mutex::new(released);
    let loader = Unimock::new(
        ConfigLoaderMock::load
            .some_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, _, _| {
                entered.notify_one();
                released.lock().unwrap().recv().unwrap();
                Err(invalid(vec![]))
            })),
    );
    let (reported, reporting) = mpsc::channel();
    let reporter = Unimock::new(
        RebuildReporterMock::catalogue_failure
            .some_call(matching!(_, _))
            .returns(()),
    );
    let (warnings, _terminal) = warning_scopes();
    let unused = Unimock::new(());
    let action = ManualRebuilds {
        activity: Some(Arc::new(activity.clone())),
        warnings,
        watching: None,
        candidates: Arc::new(ManualCandidates::new(Arc::new(FixedLifecycle))),
        preparation: Arc::new(CatalogueServe {
            config: Arc::new(loader.clone()),
            catalogue: Arc::new(unused.clone()),
            graphs: Arc::new(unused.clone()),
        }),
        states: Arc::new(unused.clone()),
        publications: Arc::new(unused.clone()),
        writer: Arc::new(unused.clone()),
        reporter: Arc::new(Reporting {
            inner: Some(Arc::new(reporter.clone())),
            destroyed: reported,
        }),
        cwd: "/repo".into(),
        options: Common::default(),
    };
    let (requests, receiver) = channel(1);
    requests.send(()).await.unwrap();
    let task = tokio::spawn(async move { action.run(Box::pin(pending()), receiver).await });
    let release = Release(release, reporting);
    started.notified().await;
    assert_eq!(active.load(Ordering::SeqCst), 1);
    task.abort();
    assert!(task.await.unwrap_err().is_cancelled());
    assert_eq!(
        active.load(Ordering::SeqCst),
        1,
        "a cancelled edit waiter must not release its blocking candidate"
    );
    release.0.send(()).unwrap();
    finished.notified().await;
    assert_eq!(active.load(Ordering::SeqCst), 0);
}
