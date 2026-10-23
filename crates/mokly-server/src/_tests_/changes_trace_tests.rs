//! Classification and capture spans retain parents and report their final outcome.

use std::sync::{Arc, Mutex};
use std::time::Duration;

use mokly_model::public_metadata::ChangesStatus;
use tracing::Instrument;
use tracing_subscriber::layer::SubscriberExt;
use unimock::{MockFn, Unimock, matching};

use crate::changes::{ChangeSourceMock, ChangeToken};
use crate::changes_background::ChangesPass;
use crate::changes_support::fixture;
use crate::changes_trace_support::Traces;
use crate::clock::ClockMock;
use crate::comparison_capture::CapturerMock;
use crate::comparison_requests::receive;
use crate::comparison_store::{Comparisons, ComparisonsMock, MemoryComparisons};
use crate::comparison_support::{accepted, files, snapshot};
use crate::diagnostics::DiagnosticsMock;
use crate::entropy::EntropyMock;
use crate::error::ServerError;
use crate::publication::{FixedPublication, Publications, PublicationsMock, SharedPublication};

async fn classify(case: &str) {
    let (origin, result, _graph) = if case == "ready" {
        let (origin, result, graph) = fixture();
        (origin, Ok(result), Some(graph))
    } else {
        (
            snapshot(None),
            Err(if case == "replaced" {
                ServerError::ChangesReplaced
            } else {
                ServerError::ChangesUnavailable
            }),
            None,
        )
    };
    let result = Mutex::new(Some(result));
    let classify = ChangeSourceMock::classify
        .next_call(matching!(_, _))
        .answers_arc(Arc::new(move |_, _, _| {
            let _span = tracing::info_span!("review.test").entered();
            result.lock().unwrap().take().unwrap()
        }));
    let source = if matches!(case, "ready" | "unavailable") {
        Unimock::new((
            classify,
            ChangeSourceMock::finished
                .next_call(matching!(_, _))
                .returns(()),
        ))
    } else {
        Unimock::new(classify)
    };
    let publications: Arc<dyn Publications> = if case == "failed-publication" {
        Arc::new(Unimock::new((
            PublicationsMock::changes
                .next_call(matching!(_, ChangesStatus::Pending, _, _, _))
                .returns(Ok(true)),
            PublicationsMock::changes
                .next_call(matching!(_, ChangesStatus::Unavailable, _, _, _))
                .returns(Err(ServerError::InvalidAssets)),
        )))
    } else {
        Arc::new(SharedPublication::new(origin.clone()))
    };
    let store = if case == "ready" {
        Unimock::new((
            ComparisonsMock::check_capacity
                .next_call(matching!(_, _))
                .returns(Ok(())),
            ComparisonsMock::install
                .next_call(matching!(_, _))
                .returns(Ok(())),
        ))
    } else {
        Unimock::new(())
    };
    let diagnostics = if case == "failed-publication" {
        Unimock::new(DiagnosticsMock::failed.next_call(matching!(_)).returns(()))
    } else {
        Unimock::new(())
    };
    let pass = ChangesPass {
        publications,
        comparisons: Arc::new(store),
        diagnostics: Arc::new(diagnostics),
        watching: false,
    };
    pass.execute(
        origin.clone(),
        Arc::new(source.clone()),
        Arc::new(ChangeToken::default()),
        Ok("base".into()),
    )
    .await;
}

async fn capture(case: &str) {
    let input = accepted(Arc::new(Unimock::new(())), Arc::new(Unimock::new(())));
    let successful = case == "success";
    let entropy = if successful {
        Unimock::new(
            EntropyMock::secret
                .next_call(matching!())
                .returns("a".repeat(64)),
        )
    } else {
        Unimock::new(())
    };
    let work = if case == "late" {
        Unimock::new(())
    } else {
        Unimock::new(
            CapturerMock::capture
                .next_call(matching!(_, _, _, _))
                .answers_arc(Arc::new(move |_, _, _, _, _| {
                    let _span = tracing::info_span!("render.test").entered();
                    if successful {
                        Ok(files())
                    } else {
                        Err(ServerError::PreviewResource)
                    }
                })),
        )
    };
    let diagnostics = if successful {
        Unimock::new(())
    } else {
        Unimock::new(DiagnosticsMock::failed.next_call(matching!(_)).returns(()))
    };
    let store = MemoryComparisons::new(
        Arc::new(Unimock::new(
            ClockMock::milliseconds.each_call(matching!()).returns(0u64),
        )),
        Arc::new(entropy),
        Arc::new(work),
        Arc::new(FixedPublication::new(snapshot(Some(input.clone())))),
        Arc::new(diagnostics),
    );
    if case == "late" {
        let permit = store.serial.acquire().await.unwrap();
        let pending = store.begin(input, "sample".into(), false, false).unwrap();
        tokio::time::advance(Duration::from_secs(10)).await;
        assert!(matches!(
            *receive(pending).await.unwrap_err(),
            ServerError::Deadline
        ));
        drop(permit);
    } else {
        assert_eq!(
            store.selected(input, "sample".into(), false).await.is_ok(),
            successful
        );
    }
    store.stop().await;
}

#[tokio::test(start_paused = true)]
async fn spans_keep_blocking_parents_and_report_only_committed_work_as_ok() {
    let traces = Traces::default();
    tracing::subscriber::set_global_default(tracing_subscriber::registry().with(traces.clone()))
        .unwrap();
    classify("ready")
        .instrument(tracing::info_span!("ready"))
        .await;
    classify("unavailable")
        .instrument(tracing::info_span!("unavailable"))
        .await;
    classify("replaced")
        .instrument(tracing::info_span!("replaced"))
        .await;
    classify("failed-publication")
        .instrument(tracing::info_span!("failed-publication"))
        .await;
    capture("success")
        .instrument(tracing::info_span!("success"))
        .await;
    capture("failed")
        .instrument(tracing::info_span!("failed"))
        .await;
    capture("late")
        .instrument(tracing::info_span!("late"))
        .await;
    let records = traces.records();
    for (name, parent, status) in [
        ("changes.classify", "ready", "ok"),
        ("changes.classify", "unavailable", "ok"),
        ("changes.classify", "replaced", "error"),
        ("changes.classify", "failed-publication", "error"),
        ("review.capture", "success", "ok"),
        ("review.capture", "failed", "error"),
        ("review.capture", "late", "error"),
    ] {
        let matching: Vec<_> = records
            .iter()
            .filter(|record| record.name == name && record.parent == Some(parent))
            .collect();
        assert_eq!(matching.len(), 1, "{name} under {parent}: {records:?}");
        assert_eq!(matching[0].status.as_deref(), Some(status));
    }
    for (name, parent) in [
        ("review.test", "changes.classify"),
        ("render.test", "review.capture"),
    ] {
        assert!(
            records
                .iter()
                .any(|record| record.name == name && record.parent == Some(parent)),
            "{records:?}"
        );
    }
}
