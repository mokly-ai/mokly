//! Re-plan budget and overlap between archived and requested digests.

use std::collections::BTreeSet;
use std::sync::Arc;

use mokly_model::output::validation::digest;
use unimock::{MockFn, Unimock, matching};

use crate::error::Error;
use crate::exchange::{Client, Exchange};
use crate::http::{HttpMock, Step};
use crate::runtime::ReporterMock;
use crate::snapshot::Prepared;

use super::support::{active, artifact, clock, plan, response, settings};

#[tokio::test]
async fn a_second_completion_replan_is_refused() {
    let planned = plan(BTreeSet::new());
    let http = Unimock::new((
        HttpMock::send
            .each_call(matching!((request, _) if request.step == Step::Plan))
            .answers_arc(Arc::new(move |_, _, _| {
                let response = planned.clone();
                Box::pin(async { Ok(response) })
            }))
            .n_times(2),
        HttpMock::send
            .each_call(matching!((request, _) if request.step == Step::Complete))
            .answers(&|_, _, _| Box::pin(async { Ok(response(409)) }))
            .n_times(2),
    ));
    let client: &dyn Exchange = &Client {
        http: Arc::new(http),
        clock: clock(),
        reporter: Arc::new(Unimock::new(())),
    };
    assert!(matches!(
        client
            .publish(
                &Prepared::new(&artifact(false)).unwrap(),
                &settings(8),
                &active()
            )
            .await,
        Err(Error::Failed)
    ));
}

#[tokio::test]
async fn archived_missing_digest_is_uploaded_without_double_counting_progress() {
    let prepared = Prepared::new(&artifact(true)).unwrap();
    let archived = prepared
        .plan_files
        .iter()
        .filter(|file| file.path != ".mokly-export-artifact")
        .map(|file| digest(&file.bytes))
        .collect();
    let planned = plan(archived);
    let http = Unimock::new((
        HttpMock::send
            .next_call(matching!((request, _) if request.step == Step::Plan))
            .answers_arc(Arc::new(move |_, _, _| {
                let response = planned.clone();
                Box::pin(async { Ok(response) })
            })),
        HttpMock::send
            .next_call(matching!((request, _) if request.step == Step::Blob))
            .answers(&|_, _, _| Box::pin(async { Ok(response(204)) }))
            .n_times(2),
        HttpMock::send
            .next_call(matching!((request, _) if request.step == Step::Complete))
            .answers(&|_, _, _| Box::pin(async { Ok(response(201)) })),
    ));
    let reporter = Unimock::new(
        ReporterMock::progress
            .each_call(matching!(_))
            .answers(&|_, progress| {
                assert_eq!(progress.completed, 2);
                assert_eq!(progress.total, 2);
            })
            .n_times(3),
    );
    let client: &dyn Exchange = &Client {
        http: Arc::new(http),
        clock: clock(),
        reporter: Arc::new(reporter),
    };
    let receipt = client
        .publish(&prepared, &settings(8), &active())
        .await
        .unwrap();
    assert_eq!(receipt.uploaded, 2);
    assert_eq!(receipt.unchanged, 5);
}
