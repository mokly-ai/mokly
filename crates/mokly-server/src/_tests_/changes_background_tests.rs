//! Background cancellation drains blocked collaborators without late publication.

use std::sync::{Arc, Mutex, mpsc};

use tokio::sync::{oneshot, watch};
use unimock::{MockFn, Unimock, matching};

use crate::changes::{ChangeSource, ChangeSourceMock};
use crate::changes_background::{AfterUsage, ChangesPass};
use crate::comparison_support::snapshot;
use crate::error::ServerError;
use crate::publication::{PublicationWriter, Publications, SharedPublication};
use crate::snapshot::Snapshot;

fn origin(source: Arc<dyn ChangeSource>) -> Arc<Snapshot> {
    let mut origin = (*snapshot(None)).clone();
    Arc::make_mut(&mut origin.generation).changes = Some(source);
    Arc::new(origin)
}

#[tokio::test]
async fn source_replacement_cancels_and_drains_the_old_classifier_without_a_result() {
    let (entered, entering) = oneshot::channel();
    let entered = Mutex::new(Some(entered));
    let (release, released) = mpsc::channel();
    let released = Mutex::new(released);
    let source = Unimock::new((
        ChangeSourceMock::references
            .next_call(matching!(_))
            .returns(Ok("refs".into())),
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
                Err(ServerError::ChangesUnavailable)
            })),
    ));
    let origin = origin(Arc::new(source));
    let publications = Arc::new(SharedPublication::new(origin.clone()));
    let pass: Arc<dyn AfterUsage> = Arc::new(ChangesPass {
        publications: publications.clone(),
        comparisons: Arc::new(Unimock::new(())),
        diagnostics: Arc::new(Unimock::new(())),
        watching: false,
    });
    let (_stop, stopping) = watch::channel(false);
    let run = tokio::spawn(async move {
        pass.run(origin, stopping).await;
    });
    let cancel = entering.await.unwrap();
    let revision = publications.current().index.revision + 1;
    assert!(publications.replace(snapshot(None).at_revision(revision)));
    while !cancel.cancelled() {
        tokio::task::yield_now().await;
    }
    assert!(
        !run.is_finished(),
        "classification must drain before its owner returns"
    );
    release.send(()).unwrap();
    run.await.unwrap();
    assert_eq!(publications.current().index.revision, revision);
}

#[tokio::test]
async fn shutdown_cancels_and_drains_reference_lookup_without_starting_classification() {
    let (entered, entering) = oneshot::channel();
    let entered = Mutex::new(Some(entered));
    let (release, released) = mpsc::channel();
    let released = Mutex::new(released);
    let source = Unimock::new(
        ChangeSourceMock::references
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, cancel| {
                entered
                    .lock()
                    .unwrap()
                    .take()
                    .unwrap()
                    .send(cancel)
                    .unwrap();
                released.lock().unwrap().recv().unwrap();
                Err(ServerError::ChangesReplaced)
            })),
    );
    let origin = origin(Arc::new(source));
    let publications = Arc::new(SharedPublication::new(origin.clone()));
    let pass: Arc<dyn AfterUsage> = Arc::new(ChangesPass {
        publications: publications.clone(),
        comparisons: Arc::new(Unimock::new(())),
        diagnostics: Arc::new(Unimock::new(())),
        watching: true,
    });
    let (stop, stopping) = watch::channel(false);
    let run = tokio::spawn(async move {
        pass.run(origin, stopping).await;
    });
    let cancel = entering.await.unwrap();
    stop.send_replace(true);
    while !cancel.cancelled() {
        tokio::task::yield_now().await;
    }
    assert!(!run.is_finished());
    release.send(()).unwrap();
    run.await.unwrap();
    assert_eq!(publications.current().index.revision, 1);
}

#[tokio::test]
async fn a_closed_owner_channel_starts_no_reference_or_render_work() {
    let origin = origin(Arc::new(Unimock::new(())));
    let pass: &dyn AfterUsage = &ChangesPass {
        publications: Arc::new(Unimock::new(())),
        comparisons: Arc::new(Unimock::new(())),
        diagnostics: Arc::new(Unimock::new(())),
        watching: true,
    };
    let stopping = {
        let (_stop, stopping) = watch::channel(false);
        stopping
    };
    pass.run(origin, stopping).await;
}
