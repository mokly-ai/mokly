//! A failed head projection ends preparation before reporting and keeps the accepted snapshot.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use mokly_cli::grammar::Common;
use mokly_server::error::ServerError;
use mokly_server::publication::PublicationsMock;
use mokly_server::shutdown::FixedLifecycle;
use tokio::sync::{Notify, mpsc};
use unimock::{MockFn, Unimock, matching};

use crate::serve_candidates::ManualCandidates;
use crate::serve_rebuild::{ManualRebuilds, RebuildReporterMock, ServeActions};
use crate::serve_state::ServeStateFactoryMock;
use crate::warning_support::{Scripted, catalogue, scopes};

use super::serve_rebuild_tests::initial;

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn failed_head_candidate_ends_early_work_before_its_failure_report() {
    let discarded = Arc::new(AtomicBool::new(false));
    let reported = Arc::new(Notify::new());
    let script = Scripted::new(vec![Ok(catalogue(vec![]))]);
    let origin = initial();
    let terminal = Unimock::new(());
    let mock = Unimock::new((
        PublicationsMock::current
            .some_call(matching!())
            .returns(origin.clone()),
        ServeStateFactoryMock::replace
            .some_call(matching!(_, 2, _, _))
            .returns(Err(ServerError::InvalidAssets)),
        ServeStateFactoryMock::discarded
            .some_call(matching!())
            .answers_arc(Arc::new({
                let discarded = discarded.clone();
                move |_| {
                    discarded.store(true, Ordering::SeqCst);
                }
            })),
        RebuildReporterMock::server_failure
            .some_call(matching!(_, _))
            .answers_arc(Arc::new({
                let discarded = discarded.clone();
                let reported = reported.clone();
                move |_, _, _| {
                    assert!(
                        discarded.load(Ordering::SeqCst),
                        "failed head preparation must end before the failure is reported"
                    );
                    reported.notify_one();
                }
            })),
    ));
    let action = ManualRebuilds {
        activity: None,
        warnings: scopes(&terminal),
        watching: None,
        candidates: Arc::new(ManualCandidates::new(Arc::new(FixedLifecycle))),
        preparation: script.preparation.clone(),
        states: Arc::new(mock.clone()),
        publications: Arc::new(mock.clone()),
        writer: Arc::new(mock.clone()),
        reporter: Arc::new(mock.clone()),
        cwd: "/repo".into(),
        options: Common::default(),
    };
    let (requests, receiver) = mpsc::channel(1);
    requests.send(()).await.unwrap();
    action
        .run(
            Box::pin(async move {
                reported.notified().await;
                Ok(())
            }),
            receiver,
        )
        .await
        .unwrap();
    assert!(discarded.load(Ordering::SeqCst));
}
