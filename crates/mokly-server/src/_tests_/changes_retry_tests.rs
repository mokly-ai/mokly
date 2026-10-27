//! Retry timing, cancellation, and permanent metadata rejection use fake clocks.

use std::collections::BTreeMap;
use std::future::Future;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::task::Poll;
use std::time::Duration;

use axum::body::Bytes;
use mokly_graph::types::RenderGenerationMock;
use mokly_model::public_metadata::ChangesStatus;
use tokio::sync::oneshot;
use tokio::time::Instant;
use unimock::{MockFn, Unimock, matching};

use crate::assets::File;
use crate::changes::{ChangeCancellation, ChangeSourceMock, ChangeToken};
use crate::changes_background::ChangesPass;
use crate::changes_support::fixture;
use crate::comparison_capture::MAX_BYTES;
use crate::comparison_store::ComparisonsMock;
use crate::comparison_support::{
    accepted, files, historical, historical_inputs, history, snapshot,
};
use crate::error::ServerError;
use crate::publication::{Publications, PublicationsMock, SharedPublication};

#[tokio::test(start_paused = true)]
async fn selected_capacity_retries_at_one_second_and_cancellation_ends_the_wait() {
    for cancelled in [false, true] {
        let (origin, result, _graph) = fixture();
        let classify = ChangeSourceMock::classify
            .next_call(matching!(_, _))
            .returns(Ok(result));
        let source = if cancelled {
            Unimock::new(classify)
        } else {
            Unimock::new((
                classify,
                ChangeSourceMock::finished
                    .next_call(matching!(_, _))
                    .answers(&|_, result, _| assert!(result.is_ok())),
            ))
        };
        let (rejected, rejecting) = oneshot::channel();
        let rejected = Mutex::new(Some(rejected));
        let calls = Arc::new(AtomicUsize::new(0));
        let checks = calls.clone();
        let identity = Arc::new(Mutex::new(None));
        let first = identity.clone();
        let began = Arc::new(Mutex::new(None));
        let began_check = began.clone();
        let check = ComparisonsMock::check_capacity
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, accepted, files| {
                let count = checks.fetch_add(1, Ordering::SeqCst);
                if count == 0 {
                    *first.lock().unwrap() = Some((accepted.id.clone(), names(files)));
                    *began_check.lock().unwrap() = Some(Instant::now());
                    rejected.lock().unwrap().take().unwrap().send(()).unwrap();
                    Err(ServerError::ComparisonCapacity)
                } else {
                    assert_eq!(
                        Instant::now(),
                        began_check.lock().unwrap().unwrap() + Duration::from_secs(1)
                    );
                    Ok(())
                }
            }))
            .n_times(if cancelled { 1 } else { 2 });
        let store = if cancelled {
            Unimock::new(check)
        } else {
            Unimock::new((
                check,
                ComparisonsMock::install
                    .each_call(matching!(_, _))
                    .answers_arc(Arc::new(move |_, accepted, files| {
                        assert_eq!(
                            *identity.lock().unwrap(),
                            Some((accepted.id.clone(), names(&files)))
                        );
                        Ok(())
                    }))
                    .n_times(1),
            ))
        };

        let publications = Arc::new(SharedPublication::new(origin.clone()));
        let pass = ChangesPass {
            publications: publications.clone(),
            comparisons: Arc::new(store.clone()),
            diagnostics: Arc::new(Unimock::new(())),
            watching: false,
        };
        let cancel = Arc::new(ChangeToken::default());
        let token = cancel.clone();
        let task_source = Arc::new(source.clone());
        let run = tokio::spawn(async move {
            pass.execute(origin, task_source, token, Ok("base".into()))
                .await;
        });
        rejecting.await.unwrap();
        tokio::time::advance(Duration::from_millis(999)).await;
        assert!(!run.is_finished());
        assert_eq!(calls.load(Ordering::SeqCst), 1);
        assert_eq!(
            publications.current().index.changes_status,
            ChangesStatus::Pending
        );
        let boundary = Instant::now();
        if cancelled {
            cancel.cancel();
        } else {
            tokio::time::advance(Duration::from_millis(1)).await;
        }
        run.await.unwrap();
        if cancelled {
            assert_eq!(
                Instant::now(),
                boundary,
                "cancellation must wake without a clock advance"
            );
            assert_eq!(
                publications.current().index.changes_status,
                ChangesStatus::Pending
            );
        } else {
            assert_eq!(
                publications.current().index.changes_status,
                ChangesStatus::Ready
            );
        }
    }
}

/// The installed metadata identity: its file names and bytes.
fn names(files: &BTreeMap<String, File>) -> Vec<(String, Bytes)> {
    files
        .iter()
        .map(|(path, file)| (path.clone(), file.bytes.clone()))
        .collect()
}

#[tokio::test(start_paused = true)]
async fn oversized_metadata_publishes_unavailable_without_admission_or_installation() {
    let (catalogue, plans) = historical_inputs();
    let mut current = catalogue.clone();
    current.model.entries.clear();
    let before = Unimock::new((
        RenderGenerationMock::catalogue
            .each_call(matching!())
            .returns(catalogue),
        RenderGenerationMock::plans
            .each_call(matching!())
            .returns(plans),
        RenderGenerationMock::render
            .each_call(matching!("sample/index.html"))
            .answers_arc(Arc::new(|_, _| Ok(history()))),
    ));
    let after = Unimock::new((
        RenderGenerationMock::catalogue
            .each_call(matching!())
            .returns(current.clone()),
        RenderGenerationMock::generation_key
            .each_call(matching!())
            .returns("after"),
    ));
    let mut result = Arc::try_unwrap(historical()).ok().unwrap().result;
    result.before = Arc::new(before.clone());
    result.after = Arc::new(after.clone());
    result.snapshot.base_ref = "x".repeat(MAX_BYTES);
    let mut origin = (*snapshot(None)).clone();
    Arc::make_mut(&mut origin.generation).model = Arc::new(current.model);
    let origin = Arc::new(origin);
    let source = Arc::new(Unimock::new((
        ChangeSourceMock::classify
            .next_call(matching!(_, _))
            .returns(Ok(result)),
        ChangeSourceMock::finished
            .next_call(matching!(_, _))
            .answers(&|_, result, _| {
                assert!(matches!(
                    result,
                    Err(ServerError::ComparisonMetadataTooLarge)
                ));
            }),
    )));
    let publications = Arc::new(SharedPublication::new(origin.clone()));
    let pass = ChangesPass {
        publications: publications.clone(),
        comparisons: Arc::new(Unimock::new(())),
        diagnostics: Arc::new(Unimock::new(())),
        watching: false,
    };
    let before = Instant::now();
    pass.execute(
        origin,
        source.clone(),
        Arc::new(ChangeToken::default()),
        Ok("base".into()),
    )
    .await;
    assert_eq!(
        publications.current().index.changes_status,
        ChangesStatus::Unavailable
    );
    assert_eq!(
        Instant::now(),
        before,
        "oversized metadata must not enter retry sleep"
    );
}

#[tokio::test(start_paused = true)]
async fn refused_admission_does_not_start_ready_projection() {
    let origin = snapshot(None);
    let input = accepted(Arc::new(Unimock::new(())), Arc::new(Unimock::new(())));
    let pass = ChangesPass {
        publications: Arc::new(Unimock::new(
            PublicationsMock::current
                .each_call(matching!())
                .returns(origin.clone()),
        )),
        comparisons: Arc::new(Unimock::new(
            ComparisonsMock::check_capacity
                .next_call(matching!(_, _))
                .returns(Err(ServerError::ComparisonCapacity)),
        )),
        diagnostics: Arc::new(Unimock::new(())),
        watching: false,
    };
    let work = pass.publish(origin, input.clone(), files());
    tokio::pin!(work);
    assert!(
        std::future::poll_fn(|cx| Poll::Ready(work.as_mut().poll(cx)))
            .await
            .is_pending()
    );
    input.cancel.cancel();
    assert!(!work.await.unwrap());
}
