//! Exchange sequencing, re-planning, rejection categories and accounting.

use std::collections::BTreeSet;
use std::sync::Arc;

use mokly_model::output::validation::digest;
use unimock::{MockFn, Unimock, matching};

use crate::accounting::Progress;
use crate::completion::Outcome;
use crate::error::Error;
use crate::exchange::{Client, Exchange};
use crate::http::{Body, HttpMock, Step};
use crate::runtime::ReporterMock;
use crate::snapshot::Prepared;

use super::support::{active, artifact, clock, missing, plan, reporter, response, settings};

#[tokio::test]
async fn each_missing_digest_is_uploaded_once_and_counts_every_marker_entry() {
    let prepared = Prepared::new(&artifact(true)).unwrap();
    let missing = missing();
    let expected_plan = plan(missing.clone());
    let plan_body = prepared.archive.clone();
    let http = Unimock::new((
        HttpMock::send
            .next_call(matching!((request, _) if request.step == Step::Plan))
            .answers_arc(Arc::new(move |_, request, _| {
                assert_eq!(request.url.as_str(), "https://api.example.com/plan?x=1");
                assert_eq!(request.body, plan_body);
                let response = expected_plan.clone();
                Box::pin(async { Ok(response) })
            })),
        HttpMock::send
            .next_call(matching!((request, _) if request.step == Step::Blob))
            .answers(&|_, request, _| {
                let bytes = request.body.clone();
                let url = request.url.clone();
                Box::pin(async move {
                    assert!(url.path().ends_with(&digest(&bytes)));
                    Ok(response(204))
                })
            })
            .n_times(3),
        HttpMock::send
            .next_call(matching!((request, _) if request.step == Step::Complete))
            .answers(&|_, request, _| {
                assert!(request.body.is_empty());
                Box::pin(async { Ok(response(201)) })
            }),
    ));
    let events = Arc::new(std::sync::Mutex::new(Vec::<Progress>::new()));
    let captured = Arc::clone(&events);
    let observer = Unimock::new(ReporterMock::progress.each_call(matching!(_)).answers_arc(
        Arc::new(move |_, progress| captured.lock().unwrap().push(progress.clone())),
    ));
    let client: &dyn Exchange = &Client {
        http: Arc::new(http),
        clock: clock(),
        reporter: Arc::new(observer),
    };
    let result = client
        .publish(&prepared, &settings(2), &active())
        .await
        .unwrap();
    assert_eq!(result.uploaded, 7);
    assert_eq!(result.unchanged, 0);
    assert_eq!(result.completion.outcome, Outcome::Published);
    let events = events.lock().unwrap();
    assert_eq!(events.len(), 4);
    assert_eq!(events[0].completed, 2);
    assert_eq!(events[0].total, 7);
    assert_eq!(events.last().unwrap().completed, 7);
    let distinct_bytes: u64 = prepared
        .plan_files
        .iter()
        .map(|file| file.bytes.len() as u64)
        .sum::<u64>()
        + 5
        + 3
        + 3;
    assert_eq!(events[0].size, distinct_bytes);
}

#[tokio::test]
async fn empty_missing_has_no_progress_and_complete_200_keeps_first_copy() {
    let planned = plan(BTreeSet::new());
    let http = Unimock::new((
        HttpMock::send
            .next_call(matching!((request, _) if request.step == Step::Plan))
            .answers_arc(Arc::new(move |_, _, _| {
                let response = planned.clone();
                Box::pin(async { Ok(response) })
            })),
        HttpMock::send
            .next_call(matching!((request, _) if request.step == Step::Complete))
            .answers(&|_, _, _| Box::pin(async { Ok(response(200)) })),
    ));
    let client: &dyn Exchange = &Client {
        http: Arc::new(http),
        clock: clock(),
        reporter: Arc::new(Unimock::new(())),
    };
    let result = client
        .publish(
            &Prepared::new(&artifact(false)).unwrap(),
            &settings(8),
            &active(),
        )
        .await
        .unwrap();
    assert_eq!(result.uploaded, 2);
    assert_eq!(result.unchanged, 5);
    assert_eq!(
        result.summary(),
        "Mokly catalogue already published for this commit."
    );
}

#[tokio::test]
async fn blobs_and_complete_share_one_replan_and_accumulate_attempted_digests() {
    for first_status in [409, 410] {
        let initial = plan([digest(b"one")].into());
        let replanned = plan(BTreeSet::new());
        let http = Unimock::new((
            HttpMock::send
                .next_call(matching!((request, _) if request.step == Step::Plan))
                .answers_arc(Arc::new(move |_, _, _| {
                    let response = initial.clone();
                    Box::pin(async { Ok(response) })
                })),
            HttpMock::send
                .next_call(matching!((request, _) if request.step == Step::Blob))
                .answers(&|_, _, _| Box::pin(async { Ok(response(204)) })),
            HttpMock::send
                .next_call(matching!((request, _) if request.step == Step::Complete))
                .answers_arc(Arc::new(move |_, _, _| {
                    Box::pin(async move { Ok(response(first_status)) })
                })),
            HttpMock::send
                .next_call(matching!((request, _) if request.step == Step::Plan))
                .answers_arc(Arc::new(move |_, _, _| {
                    let response = replanned.clone();
                    Box::pin(async { Ok(response) })
                })),
            HttpMock::send
                .next_call(matching!((request, _) if request.step == Step::Complete))
                .answers(&|_, _, _| Box::pin(async { Ok(response(201)) })),
        ));
        let client: &dyn Exchange = &Client {
            http: Arc::new(http),
            clock: clock(),
            reporter: reporter(),
        };
        let result = client
            .publish(
                &Prepared::new(&artifact(false)).unwrap(),
                &settings(1),
                &active(),
            )
            .await
            .unwrap();
        assert_eq!(result.uploaded, 4);
        assert_eq!(result.unchanged, 3);
    }
    let initial = plan([digest(b"one")].into());
    let http = Unimock::new((
        HttpMock::send
            .each_call(matching!((request, _) if request.step == Step::Plan))
            .answers_arc(Arc::new(move |_, _, _| {
                let response = initial.clone();
                Box::pin(async { Ok(response) })
            }))
            .n_times(2),
        HttpMock::send
            .each_call(matching!((request, _) if request.step == Step::Blob))
            .answers(&|_, _, _| Box::pin(async { Ok(response(410)) }))
            .n_times(2),
    ));
    let client: &dyn Exchange = &Client {
        http: Arc::new(http),
        clock: clock(),
        reporter: reporter(),
    };
    assert!(matches!(
        client
            .publish(
                &Prepared::new(&artifact(false)).unwrap(),
                &settings(1),
                &active()
            )
            .await,
        Err(Error::Failed)
    ));
}

#[tokio::test]
async fn receiver_rejections_stop_all_later_steps_and_never_parse_the_body() {
    for step in [Step::Plan, Step::Blob, Step::Complete] {
        for status in [400, 401, 403, 404, 413, 422, 426, 301, 302, 307, 308] {
            let planned = plan(if step == Step::Blob {
                [digest(b"one")].into()
            } else {
                BTreeSet::new()
            });
            let http = Unimock::new(HttpMock::send.each_call(matching!(_, _)).answers_arc(
                Arc::new(move |_, request, _| {
                    let mut result = if request.step == step {
                        response(status)
                    } else {
                        assert_eq!(request.step, Step::Plan);
                        planned.clone()
                    };
                    if request.step == step {
                        result.body =
                            Body::Bytes(b"SECRET response and credentials".as_slice().into());
                    }
                    Box::pin(async { Ok(result) })
                }),
            ));
            let client: &dyn Exchange = &Client {
                http: Arc::new(http),
                clock: if step == Step::Plan {
                    Arc::new(Unimock::new(()))
                } else {
                    clock()
                },
                reporter: if step == Step::Blob {
                    reporter()
                } else {
                    Arc::new(Unimock::new(()))
                },
            };
            let error = client
                .publish(
                    &Prepared::new(&artifact(false)).unwrap(),
                    &settings(1),
                    &active(),
                )
                .await
                .unwrap_err();
            assert!(match status {
                400 | 422 => matches!(error, Error::InvalidBundle),
                401 | 403 => matches!(error, Error::Unauthorized),
                413 => matches!(error, Error::TooLarge),
                426 => matches!(error, Error::UnsupportedVersion),
                _ => matches!(error, Error::Failed),
            });
            assert!(!error.to_string().contains("SECRET"));
        }
    }
}
