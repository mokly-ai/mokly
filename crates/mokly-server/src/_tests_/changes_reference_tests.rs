//! One attempt classifies against the merge base of its own reference read. A failed
//! read fails the attempt before classification, and a moved reference replaces it.

use std::sync::{Arc, Mutex};

use mokly_model::public_metadata::ChangesStatus;
use unimock::{MockFn, Unimock, matching};

use crate::changes::{ChangeSourceMock, ChangeToken};
use crate::changes_background::ChangesPass;
use crate::changes_support::fixture;
use crate::comparison_support::snapshot;
use crate::error::ServerError;
use crate::publication::{Publications, SharedPublication};
use crate::snapshot::Snapshot;

/// A watching pass over `origin`, so the reference check after classification runs.
/// Its metadata store has no mocks, so no attempt here may install a result.
fn watching(origin: &Arc<Snapshot>) -> (ChangesPass, Arc<SharedPublication>) {
    let publications = Arc::new(SharedPublication::new(origin.clone()));
    let pass = ChangesPass {
        publications: publications.clone(),
        comparisons: Arc::new(Unimock::new(())),
        diagnostics: Arc::new(Unimock::new(())),
        activity: None,
        watching: true,
    };
    (pass, publications)
}

#[tokio::test]
async fn classification_receives_the_merge_base_of_the_reference_read() {
    let origin = snapshot(None);
    let received = Arc::new(Mutex::new(Vec::new()));
    let observed = received.clone();
    let source = Unimock::new((
        ChangeSourceMock::classify
            .next_call(matching!(_, _, _))
            .answers_arc(Arc::new(move |_, _, _, merge_base| {
                observed.lock().unwrap().push(merge_base.to_owned());
                Err(ServerError::ChangesUnavailable)
            })),
        ChangeSourceMock::finished
            .next_call(matching!(_, _))
            .returns(()),
    ));
    let (pass, _publications) = watching(&origin);
    pass.execute(
        origin,
        Arc::new(source.clone()),
        Arc::new(ChangeToken::default()),
        Ok("merge-base".into()),
    )
    .await;
    assert_eq!(*received.lock().unwrap(), ["merge-base"]);
}

/// The source mock has no `classify`, so a classification call fails the attempt's task.
#[tokio::test]
async fn a_failed_reference_read_fails_the_attempt_with_its_error_before_classification() {
    let origin = snapshot(None);
    let reported = Arc::new(Mutex::new(Vec::new()));
    let observed = reported.clone();
    let source = Unimock::new(
        ChangeSourceMock::finished
            .next_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, result, _| {
                let error = result.err().map(|error| format!("{error:?}"));
                observed.lock().unwrap().push(error);
            })),
    );
    let (pass, publications) = watching(&origin);
    let completed = pass
        .execute(
            origin,
            Arc::new(source.clone()),
            Arc::new(ChangeToken::default()),
            Err(ServerError::ChangesUnavailable),
        )
        .await;
    assert_eq!(
        *reported.lock().unwrap(),
        [Some("ChangesUnavailable".to_owned())]
    );
    assert!(completed);
    assert_eq!(
        publications.current().index.changes_status,
        ChangesStatus::Unavailable
    );
}

/// The source mock has no `finished`, so a terminal report fails the test.
#[tokio::test]
async fn a_reference_that_moves_during_classification_replaces_the_attempt_without_a_result() {
    let (origin, result, _graph) = fixture();
    let source = Unimock::new((
        ChangeSourceMock::classify
            .next_call(matching!(_, _, _))
            .returns(Ok(result)),
        ChangeSourceMock::references
            .next_call(matching!(_))
            .returns(Ok("moved".into())),
    ));
    let (pass, publications) = watching(&origin);
    let completed = pass
        .execute(
            origin,
            Arc::new(source.clone()),
            Arc::new(ChangeToken::default()),
            Ok("read".into()),
        )
        .await;
    assert!(!completed);
    assert_eq!(
        publications.current().index.changes_status,
        ChangesStatus::Pending
    );
}
