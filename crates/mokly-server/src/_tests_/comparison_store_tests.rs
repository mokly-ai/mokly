//! Retention, capture admission, and cancellation use injected clocks and event order.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, mpsc};
use std::time::Duration;

use tokio::sync::oneshot;
use unimock::{MockFn, Unimock, matching};

use crate::changes::Accepted;
use crate::clock::ClockMock;
use crate::comparison_capture::{Capturer, CapturerMock};
use crate::comparison_requests::receive;
use crate::comparison_store::{Comparisons, MemoryComparisons};
use crate::comparison_support::{accepted, files, snapshot};
use crate::diagnostics::DiagnosticsMock;
use crate::entropy::{Entropy, EntropyMock};
use crate::error::ServerError;
use crate::publication::{PublicationWriter, SharedPublication};

fn setup(
    capture: Arc<dyn Capturer>,
    uses_entropy: bool,
) -> (
    Arc<MemoryComparisons>,
    Arc<Accepted>,
    Arc<AtomicU64>,
    Arc<SharedPublication>,
) {
    let accepted = accepted(Arc::new(Unimock::new(())), Arc::new(Unimock::new(())));
    let publications = Arc::new(SharedPublication::new(snapshot(Some(accepted.clone()))));
    let now = Arc::new(AtomicU64::new(0));
    let observed = now.clone();
    let serial = AtomicU64::new(0);
    let entropy: Arc<dyn Entropy> = if uses_entropy {
        Arc::new(Unimock::new(
            EntropyMock::secret
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    format!("{:032x}", serial.fetch_add(1, Ordering::SeqCst)).repeat(2)
                }))
                .at_least_times(0),
        ))
    } else {
        Arc::new(Unimock::new(()))
    };
    let store = Arc::new(MemoryComparisons::new(
        Arc::new(Unimock::new(
            ClockMock::milliseconds
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| observed.load(Ordering::SeqCst))),
        )),
        entropy,
        capture,
        publications.clone(),
        Arc::new(Unimock::new(())),
    ));
    (store, accepted, now, publications)
}

#[tokio::test]
async fn identical_pending_requests_coalesce_refresh_is_new_and_head_renews_retention() {
    let capture = Unimock::new(
        CapturerMock::capture
            .each_call(matching!(_, "sample", false, _))
            .answers(&|_, _, _, _, _| Ok(files()))
            .n_times(2),
    );
    let (store, accepted, now, _) = setup(Arc::new(capture), true);
    let first = store
        .begin(accepted.clone(), "sample".into(), false, false)
        .unwrap();
    let same = store
        .begin(accepted.clone(), "sample".into(), false, true)
        .unwrap();
    let id = receive(first).await.unwrap();
    assert_eq!(receive(same).await.unwrap(), id);
    assert_eq!(
        store
            .selected(accepted.clone(), "sample".into(), false)
            .await
            .unwrap(),
        id
    );
    now.store(59_999, Ordering::SeqCst);
    assert!(
        store
            .file(&id, "entries/sample.json")
            .await
            .unwrap()
            .is_some()
    );
    now.store(60_000, Ordering::SeqCst);
    store.collect();
    assert!(
        store
            .file(&id, "entries/sample.json")
            .await
            .unwrap()
            .is_some()
    );
    let renewed = store
        .selected(accepted, "sample".into(), true)
        .await
        .unwrap();
    assert_ne!(renewed, id);
    now.store(120_000, Ordering::SeqCst);
    store.collect();
    assert!(
        store
            .file(&id, "entries/sample.json")
            .await
            .unwrap()
            .is_none()
    );
    assert!(
        store
            .file(&renewed, "entries/sample.json")
            .await
            .unwrap()
            .is_none()
    );
    store.stop().await;
}

#[tokio::test(start_paused = true)]
async fn deadline_starts_at_admission_and_pending_count_is_bounded() {
    let (mut store, accepted, _, _) = setup(Arc::new(Unimock::new(())), false);
    Arc::get_mut(&mut store).unwrap().diagnostics = Arc::new(Unimock::new(
        DiagnosticsMock::failed
            .each_call(matching!(_))
            .answers(&|_, error| assert!(matches!(error, ServerError::Deadline)))
            .n_times(32),
    ));
    let permit = store.serial.acquire().await.unwrap();
    let mut first = store
        .begin(accepted.clone(), "sample".into(), false, false)
        .unwrap();
    let mut queued = Vec::new();
    for number in 1..32 {
        queued.push(
            store
                .begin(accepted.clone(), format!("entry-{number}"), false, false)
                .unwrap(),
        );
    }
    assert!(matches!(
        *store
            .begin(accepted, "extra".into(), false, false)
            .unwrap_err(),
        ServerError::ComparisonCapacity
    ));
    tokio::task::yield_now().await;
    tokio::time::advance(Duration::from_secs(9)).await;
    assert!(first.borrow().is_none());
    tokio::time::advance(Duration::from_secs(1)).await;
    first.changed().await.unwrap();
    assert!(matches!(
        *receive(first).await.unwrap_err(),
        ServerError::Deadline
    ));
    for pending in queued {
        assert!(matches!(
            *receive(pending).await.unwrap_err(),
            ServerError::Deadline
        ));
    }
    drop(permit);
    store.stop().await;
}

#[tokio::test]
async fn replacement_discards_a_late_capture_and_shutdown_drains_it() {
    let (entered, entering) = oneshot::channel();
    let entered = Mutex::new(Some(entered));
    let (release, released) = mpsc::channel();
    let released = Mutex::new(released);
    let capture = Unimock::new(
        CapturerMock::capture
            .next_call(matching!(_, "sample", false, _))
            .answers_arc(Arc::new(move |_, _, _, _, _| {
                entered.lock().unwrap().take().unwrap().send(()).unwrap();
                released.lock().unwrap().recv().unwrap();
                Ok(files())
            })),
    );
    let (store, accepted, _, publications) = setup(Arc::new(capture), false);
    let pending = store
        .begin(accepted, "sample".into(), false, false)
        .unwrap();
    entering.await.unwrap();
    assert!(publications.replace(snapshot(None).at_revision(2)));
    store.collect();
    release.send(()).unwrap();
    assert!(matches!(
        *receive(pending).await.unwrap_err(),
        ServerError::ChangesReplaced
    ));
    store.stop().await;
    assert!(store.state.lock().unwrap().bundles.is_empty());
    assert!(store.state.lock().unwrap().tasks.is_empty());
}

#[tokio::test]
async fn retained_generations_are_rejected_at_capacity_and_never_evicted_early() {
    let (store, accepted, now, _) = setup(Arc::new(Unimock::new(())), false);
    for number in 0..64 {
        let mut entry = crate::comparison_support::accepted(
            accepted.result.before.clone(),
            accepted.result.after.clone(),
        );
        Arc::get_mut(&mut entry).unwrap().id = format!("{number:064x}");
        store.install(entry, files()).unwrap();
    }
    assert!(matches!(
        store.check_capacity(&accepted, &files()),
        Err(ServerError::ComparisonCapacity)
    ));
    assert!(matches!(
        store.install(accepted.clone(), files()),
        Err(ServerError::ComparisonCapacity)
    ));
    assert!(
        store
            .file(&format!("{:064x}", 0), "entries/sample.json")
            .await
            .unwrap()
            .is_some()
    );
    now.store(60_000, Ordering::SeqCst);
    store.install(accepted, files()).unwrap();
    store.stop().await;
}

#[tokio::test]
async fn a_status_replacement_discards_selection_cache_even_with_equal_content_identity() {
    let capture = Unimock::new(
        CapturerMock::capture
            .each_call(matching!(_, "sample", false, _))
            .answers(&|_, _, _, _, _| Ok(files()))
            .n_times(2),
    );
    let (store, first, _, publications) = setup(Arc::new(capture), true);
    let old = store
        .selected(first.clone(), "sample".into(), false)
        .await
        .unwrap();
    let next = accepted(first.result.before.clone(), first.result.after.clone());
    assert_eq!(next.id, first.id);
    assert!(publications.replace(snapshot(Some(next.clone())).at_revision(2)));
    let new = store.selected(next, "sample".into(), false).await.unwrap();
    assert_ne!(old, new);
    assert!(
        store
            .file(&old, "entries/sample.json")
            .await
            .unwrap()
            .is_some()
    );
    store.stop().await;
}

#[tokio::test]
async fn closing_capture_admission_is_not_reported_as_a_deadline_failure() {
    let (store, accepted, _, _) = setup(Arc::new(Unimock::new(())), false);
    let pending = store
        .begin(accepted, "sample".into(), false, false)
        .unwrap();
    store.serial.close();
    assert!(matches!(
        *receive(pending).await.unwrap_err(),
        ServerError::ChangesReplaced
    ));
    store.stop().await;
}
