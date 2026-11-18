//! Even a reference failure waits for completed current usage before publication.

use std::sync::{Arc, Mutex, mpsc};

use mokly_model::public_metadata::ChangesStatus;
use tokio::sync::oneshot;
use unimock::{MockFn, Unimock, matching};

use crate::changes::{ChangeSourceMock, ChangeToken};
use crate::changes_background::ChangesPass;
use crate::comparison_support::snapshot;
use crate::error::ServerError;
use crate::publication::PublicationsMock;
use crate::usage_completion::UsageCompletionMock;

#[tokio::test]
async fn an_early_reference_error_stays_pending_until_current_usage_settles() {
    let events = Arc::new(Mutex::new(Vec::new()));
    let published = events.clone();
    let publications = Unimock::new(
        PublicationsMock::changes
            .each_call(matching!(_, _, _, _, _))
            .answers_arc(Arc::new(move |_, _, status, _, _, _| {
                published.lock().unwrap().push(status);
                Ok(true)
            }))
            .n_times(2),
    );
    let unused = Unimock::new(());
    let pass = ChangesPass {
        publications: Arc::new(publications.clone()),
        comparisons: Arc::new(unused.clone()),
        diagnostics: Arc::new(unused.clone()),
        watching: false,
    };
    let (waiting, waited) = oneshot::channel();
    let waiting = Arc::new(Mutex::new(Some(waiting)));
    let awaiting = waiting.clone();
    let (release, released) = mpsc::channel();
    let released = Mutex::new(released);
    let usage = Unimock::new(
        UsageCompletionMock::wait
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                awaiting.lock().unwrap().take().unwrap().send(true).unwrap();
                released.lock().unwrap().recv().unwrap();
                true
            })),
    );
    let source = Unimock::new(
        ChangeSourceMock::finished
            .some_call(matching!(Err(ServerError::ChangesUnavailable), _))
            .answers_arc(Arc::new(move |_, _, _| {
                if let Some(waiting) = waiting.lock().unwrap().take() {
                    waiting.send(false).unwrap();
                }
            })),
    );
    let task_source = source.clone();
    let task_usage = usage.clone();
    let origin = snapshot(None);
    let task_origin = origin.clone();
    let task = tokio::spawn(async move {
        pass.execute(
            task_origin,
            Arc::new(task_source),
            Arc::new(ChangeToken::default()),
            Err(ServerError::ChangesUnavailable),
            Arc::new(task_usage),
        )
        .await;
    });
    let blocked = waited.await.unwrap_or(false);
    let before_usage = events.lock().unwrap().clone();
    let released = release.send(()).is_ok();
    task.await.unwrap();
    assert!(blocked && released);
    assert_eq!(before_usage, [ChangesStatus::Pending]);
    assert_eq!(
        *events.lock().unwrap(),
        [ChangesStatus::Pending, ChangesStatus::Unavailable]
    );
}
