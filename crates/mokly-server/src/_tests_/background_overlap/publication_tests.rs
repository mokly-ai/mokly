//! Reference errors start and publish only after ordinary usage completes.

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
use crate::publication_support::{ready, snapshot};
use crate::work::{Work, Workers};

#[tokio::test]
async fn a_reference_error_starts_and_publishes_only_after_current_usage_settles() {
    let events = Arc::new(Mutex::new(Vec::new()));
    let (entered, entering) = oneshot::channel();
    let entered = Mutex::new(Some(entered));
    let (release, released) = mpsc::channel();
    let released = Mutex::new(released);
    let rendered = events.clone();
    let documents = Unimock::new((
        DocumentsMock::usage
            .each_call(matching!(_))
            .returns(Some(ready())),
        DocumentsMock::background
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                rendered.lock().unwrap().push("usage");
                entered.lock().unwrap().take().unwrap().send(()).unwrap();
                released.lock().unwrap().recv().unwrap();
                Ok(Vec::new())
            })),
    ));
    let (finished, finishing) = oneshot::channel();
    let finished = Mutex::new(Some(finished));
    let references = events.clone();
    let reported = events.clone();
    let source = Unimock::new((
        ChangeSourceMock::references
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                references.lock().unwrap().push("references");
                Err(ServerError::ChangesUnavailable)
            })),
        ChangeSourceMock::finished
            .some_call(matching!(Err(ServerError::ChangesUnavailable), _))
            .answers_arc(Arc::new(move |_, _, _| {
                reported.lock().unwrap().push("finished");
                finished.lock().unwrap().take().unwrap().send(()).unwrap();
            })),
    ));
    let mut origin = (*snapshot(1, Arc::new(documents.clone()))).clone();
    Arc::make_mut(&mut origin.generation).changes = Some(Arc::new(source.clone()));
    let publications = Arc::new(SharedPublication::new(Arc::new(origin)));
    let work = Arc::new(Workers::new(1, Arc::new(Unimock::new(()))));
    let pass = UsagePass {
        batch: 1,
        changes: Some(Arc::new(ChangesPass {
            publications: publications.clone(),
            comparisons: Arc::new(Unimock::new(())),
            diagnostics: Arc::new(Unimock::new(())),
            watching: false,
        })),
        publications: publications.clone(),
        work: work.clone(),
        diagnostics: Arc::new(Unimock::new(())),
    };
    let (stop, stopping) = watch::channel(false);
    let task = tokio::spawn(async move { pass.run(stopping).await });
    entering.await.unwrap();
    let before_usage = events.lock().unwrap().clone();
    let before_status = publications.current().index.changes_status;
    release.send(()).unwrap();
    finishing.await.unwrap();
    stop.send_replace(true);
    task.await.unwrap();
    work.stop().await;
    assert_eq!(before_usage, ["usage"]);
    assert_ne!(before_status, ChangesStatus::Unavailable);
    assert_eq!(*events.lock().unwrap(), ["usage", "references", "finished"]);
    assert_eq!(
        publications.current().index.changes_status,
        ChangesStatus::Unavailable
    );
}
