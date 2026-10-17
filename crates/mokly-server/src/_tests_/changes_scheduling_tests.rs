//! Snapshot mode runs once; watched refs cancel and drain before the next attempt.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, mpsc};
use std::time::Duration;

use mokly_model::public_metadata::ChangesStatus;
use tokio::sync::{oneshot, watch};
use unimock::{MockFn, Unimock, matching};

use crate::changes::{ChangeSource, ChangeSourceMock};
use crate::changes_background::{AfterUsage, ChangesPass};
use crate::comparison_store::ComparisonsMock;
use crate::comparison_support::snapshot;
use crate::error::ServerError;
use crate::publication::{Publications, SharedPublication};
use crate::snapshot::Snapshot;

fn setup(
    source: Arc<dyn ChangeSource>,
    watching: bool,
) -> (
    Arc<dyn AfterUsage>,
    Arc<Snapshot>,
    Arc<SharedPublication>,
    oneshot::Receiver<()>,
) {
    let mut origin = (*snapshot(None)).clone();
    Arc::make_mut(&mut origin.generation).changes = Some(source);
    let origin = Arc::new(origin);
    let publications = Arc::new(SharedPublication::new(origin.clone()));
    let (collected, collecting) = oneshot::channel();
    let collected = Mutex::new(Some(collected));
    let pass = Arc::new(ChangesPass {
        publications: publications.clone(),
        comparisons: Arc::new(Unimock::new(
            ComparisonsMock::collect
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    if let Some(collected) = collected.lock().unwrap().take() {
                        let _ = collected.send(());
                    }
                })),
        )),
        diagnostics: Arc::new(Unimock::new(())),
        watching,
    });
    (pass, origin, publications, collecting)
}

#[tokio::test(start_paused = true)]
async fn snapshot_mode_classifies_once_and_never_polls_refs() {
    let (finished, finishing) = oneshot::channel();
    let finished = Mutex::new(Some(finished));
    let source = Unimock::new((
        ChangeSourceMock::references
            .next_call(matching!(_))
            .returns(Ok("refs".into())),
        ChangeSourceMock::classify
            .next_call(matching!(_, _))
            .returns(Err(ServerError::ChangesUnavailable)),
        ChangeSourceMock::finished
            .next_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, result, _| {
                assert!(result.is_err());
                finished.lock().unwrap().take().unwrap().send(()).unwrap();
            })),
    ));
    let (pass, origin, publications, collecting) = setup(Arc::new(source.clone()), false);
    let (stop, stopping) = watch::channel(false);
    let run = tokio::spawn(async move { pass.run(origin, stopping).await });
    finishing.await.unwrap();
    tokio::time::advance(Duration::from_secs(10)).await;
    collecting.await.unwrap();
    assert_eq!(
        publications.current().index.changes_status,
        ChangesStatus::Unavailable
    );
    stop.send_replace(true);
    run.await.unwrap();
}

#[tokio::test(start_paused = true)]
async fn a_ref_change_drains_the_replaced_attempt_and_reuses_the_polled_refs() {
    let (entered, entering) = oneshot::channel();
    let entered = Mutex::new(Some(entered));
    let (release, released) = mpsc::channel();
    let released = Mutex::new(released);
    let drained = Arc::new(AtomicBool::new(false));
    let first_drained = drained.clone();
    let (stop, stopping) = watch::channel(false);
    let source = Unimock::new((
        ChangeSourceMock::references
            .next_call(matching!(_))
            .returns(Ok("first".into())),
        ChangeSourceMock::classify
            .next_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, cancel, _| {
                entered
                    .lock()
                    .unwrap()
                    .take()
                    .unwrap()
                    .send(cancel)
                    .unwrap();
                released.lock().unwrap().recv().unwrap();
                first_drained.store(true, Ordering::SeqCst);
                Err(ServerError::ChangesUnavailable)
            })),
        ChangeSourceMock::references
            .next_call(matching!(_))
            .returns(Ok("second".into())),
        ChangeSourceMock::refreshed
            .next_call(matching!())
            .answers_arc(Arc::new(move |_| {
                assert!(drained.load(Ordering::SeqCst));
                None
            })),
        ChangeSourceMock::classify
            .next_call(matching!(_, _))
            .returns(Err(ServerError::ChangesUnavailable)),
        ChangeSourceMock::finished
            .next_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, result, _| {
                assert!(result.is_err());
                stop.send_replace(true);
            })),
    ));
    let (pass, origin, publications, _collecting) = setup(Arc::new(source.clone()), true);
    let run = tokio::spawn(async move { pass.run(origin, stopping).await });
    let cancel = entering.await.unwrap();
    tokio::time::advance(Duration::from_secs(1)).await;
    while !cancel.cancelled() {
        tokio::task::yield_now().await;
    }
    assert_eq!(
        publications.current().index.changes_status,
        ChangesStatus::Pending
    );
    release.send(()).unwrap();
    run.await.unwrap();
    assert_eq!(
        publications.current().index.changes_status,
        ChangesStatus::Unavailable
    );
}
