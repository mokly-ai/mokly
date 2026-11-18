//! Shutdown cancels and joins Changes while current usage still holds a render.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, mpsc};

use mokly_model::public_metadata::ChangesStatus;
use tokio::sync::{oneshot, watch};
use unimock::{MockFn, Unimock, matching};

use crate::backend::DocumentsMock;
use crate::background::{Background, UsagePass};
use crate::changes::ChangeSourceMock;
use crate::changes_background::ChangesPass;
use crate::error::ServerError;
use crate::publication::{Publications, SharedPublication};
use crate::publication_support::snapshot;
use crate::work::{Work, Workers};

#[test]
fn stop_joins_an_early_error_waiting_for_usage_without_publishing_it() {
    let (render_started, rendering) = oneshot::channel();
    let render_started = Mutex::new(Some(render_started));
    let (release, released) = mpsc::channel();
    let released = Mutex::new(released);
    let documents = Unimock::new(
        DocumentsMock::background
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                render_started
                    .lock()
                    .unwrap()
                    .take()
                    .unwrap()
                    .send(())
                    .unwrap();
                released.lock().unwrap().recv().unwrap();
                Ok(Vec::new())
            })),
    );
    let (entered, entering) = oneshot::channel();
    let entered = Mutex::new(Some(entered));
    let drained = Arc::new(AtomicBool::new(false));
    let discarded = drained.clone();
    let (drain_started, draining) = oneshot::channel();
    let drain_started = Mutex::new(Some(drain_started));
    let (finish_drain, finish_drained) = mpsc::channel();
    let finish_drained = Mutex::new(finish_drained);
    let source = Unimock::new((
        ChangeSourceMock::references
            .some_call(matching!(_))
            .returns(Err(ServerError::ChangesUnavailable)),
        ChangeSourceMock::started
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, cancel| {
                entered
                    .lock()
                    .unwrap()
                    .take()
                    .unwrap()
                    .send(cancel)
                    .unwrap();
                None
            })),
        ChangeSourceMock::discarded
            .some_call(matching!())
            .answers_arc(Arc::new(move |_| {
                drain_started
                    .lock()
                    .unwrap()
                    .take()
                    .unwrap()
                    .send(())
                    .unwrap();
                finish_drained.lock().unwrap().recv().unwrap();
                discarded.store(true, Ordering::SeqCst);
            })),
    ));
    let mut origin = (*snapshot(1, Arc::new(documents.clone()))).clone();
    Arc::make_mut(&mut origin.generation).changes = Some(Arc::new(source.clone()));
    let publications = Arc::new(SharedPublication::new(Arc::new(origin)));
    let unused = Unimock::new(());
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
        .unwrap();
    runtime.block_on(async {
        let work = Arc::new(Workers::new(1, Arc::new(unused.clone())));
        let pass = UsagePass {
            batch: 1,
            changes: Some(Arc::new(ChangesPass {
                publications: publications.clone(),
                comparisons: Arc::new(unused.clone()),
                diagnostics: Arc::new(unused.clone()),
                watching: false,
            })),
            publications: publications.clone(),
            work: work.clone(),
            diagnostics: Arc::new(unused.clone()),
        };
        let (stop, stopping) = watch::channel(false);
        let mut updates = publications.subscribe().updates;
        let task = tokio::spawn(async move { pass.run(stopping).await });
        rendering.await.unwrap();
        let cancel = entering.await.unwrap();
        while publications.current().index.changes_status != ChangesStatus::Pending {
            updates.recv().await.unwrap();
        }
        stop.send_replace(true);
        draining.await.unwrap();
        let returned_before_drain = task.is_finished();
        finish_drain.send(()).unwrap();
        task.await.unwrap();
        let joined = drained.load(Ordering::SeqCst);
        release.send(()).unwrap();
        work.stop().await;
        assert!(joined);
        assert!(!returned_before_drain);
        assert!(cancel.cancelled());
        assert_eq!(
            publications.current().index.changes_status,
            ChangesStatus::Pending
        );
    });
}
