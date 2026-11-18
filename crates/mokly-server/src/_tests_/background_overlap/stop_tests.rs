//! Shutdown cancels and joins startup while current usage still holds a render.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, mpsc};

use tokio::sync::{oneshot, watch};
use unimock::{MockFn, Unimock, matching};

use crate::backend::DocumentsMock;
use crate::background::{Background, UsagePass};
use crate::changes::ChangeSourceMock;
use crate::changes_signal::{ChangeSignal, ChangeSignalMock};
use crate::publication::{Publications, SharedPublication};
use crate::publication_support::snapshot;
use crate::startup_preparation::StartupPreparationMock;
use crate::work::{Work, Workers};

#[tokio::test]
async fn stop_joins_startup_without_publishing_early_changes() {
    let (render_started, rendering) = oneshot::channel();
    let render_started = Mutex::new(Some(render_started));
    let (release_usage, released_usage) = mpsc::channel();
    let released_usage = Mutex::new(released_usage);
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
                released_usage.lock().unwrap().recv().unwrap();
                Ok(Vec::new())
            })),
    );
    let (entered, entering) = oneshot::channel();
    let entered = Mutex::new(Some(entered));
    let (release, released) = mpsc::channel();
    let released = Mutex::new(released);
    let drained = Arc::new(AtomicBool::new(false));
    let finished = drained.clone();
    let preparation = Unimock::new((
        StartupPreparationMock::prepare
            .some_call(matching!())
            .answers_arc(Arc::new(move |_| {
                entered.lock().unwrap().take().unwrap().send(()).unwrap();
                released.lock().unwrap().recv().unwrap();
                false
            })),
        StartupPreparationMock::finished
            .some_call(matching!())
            .answers_arc(Arc::new(move |_| {
                finished.store(true, Ordering::SeqCst);
            })),
    ));
    let (cancelled, cancelling) = oneshot::channel();
    let cancelled = Mutex::new(Some(cancelled));
    let signal: Arc<dyn ChangeSignal> = Arc::new(Unimock::new(
        ChangeSignalMock::notify
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| {
                if let Some(cancelled) = cancelled.lock().unwrap().take() {
                    let _ = cancelled.send(());
                }
            })),
    ));
    let source = Unimock::new(
        ChangeSourceMock::startup
            .some_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, cancel, _| {
                cancel.observe(Arc::downgrade(&signal));
                Some(Arc::new(preparation.clone()))
            })),
    );
    let mut origin = (*snapshot(1, Arc::new(documents.clone()))).clone();
    Arc::make_mut(&mut origin.generation).changes = Some(Arc::new(source));
    let publications = Arc::new(SharedPublication::new(Arc::new(origin)));
    let status = publications.current().index.changes_status;
    let work = Arc::new(Workers::new(1, Arc::new(Unimock::new(()))));
    let pass = UsagePass {
        batch: 1,
        changes: None,
        publications: publications.clone(),
        work: work.clone(),
        diagnostics: Arc::new(Unimock::new(())),
    };
    let (stop, stopping) = watch::channel(false);
    let task = tokio::spawn(async move { pass.run(stopping).await });
    rendering.await.unwrap();
    entering.await.unwrap();
    stop.send_replace(true);
    cancelling.await.unwrap();
    let returned_before_drain = task.is_finished();
    release.send(()).unwrap();
    task.await.unwrap();
    release_usage.send(()).unwrap();
    work.stop().await;
    assert!(drained.load(Ordering::SeqCst));
    assert!(!returned_before_drain);
    assert_eq!(publications.current().index.changes_status, status);
}
