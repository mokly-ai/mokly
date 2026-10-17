//! A completed publication and its cancellation have one linearized order.

use std::sync::{Arc, Mutex, mpsc};

use tokio::sync::oneshot;
use unimock::{MockFn, Unimock, matching};

use crate::changes::{ChangeCancellation, ChangeCommitMock, ChangeToken};
use crate::comparison_support::snapshot;
use crate::publication::{Publications, SharedPublication};
use mokly_model::public_metadata::ChangesStatus;

#[test]
fn cancelled_producers_cannot_swap_state_or_publish_an_event() {
    let origin = snapshot(None);
    let publications: &dyn Publications = &SharedPublication::new(origin.clone());
    let mut updates = publications.subscribe().updates;
    let token = ChangeToken::default();
    token.cancel();
    assert!(
        !publications
            .changes(&origin, ChangesStatus::Pending, None, &token)
            .unwrap()
    );
    assert!(Arc::ptr_eq(&origin, &publications.current()));
    assert!(matches!(
        updates.try_recv(),
        Err(tokio::sync::broadcast::error::TryRecvError::Empty)
    ));
    assert!(!token.commit(&Unimock::new(())));
}

#[tokio::test]
async fn cancellation_drains_a_state_swap_that_already_started() {
    let order = Arc::new(Mutex::new(Vec::new()));
    let recorded = order.clone();
    let (entered, entering) = oneshot::channel();
    let entered = Mutex::new(Some(entered));
    let (release, released) = mpsc::channel();
    let released = Mutex::new(released);
    let publication = Unimock::new(ChangeCommitMock::apply.next_call(matching!()).answers_arc(
        Arc::new(move |_| {
            entered.lock().unwrap().take().unwrap().send(()).unwrap();
            released.lock().unwrap().recv().unwrap();
            recorded.lock().unwrap().push("publication");
            true
        }),
    ));
    let token: Arc<dyn ChangeCancellation> = Arc::new(ChangeToken::default());
    let active = token.clone();
    let worker_publication = publication.clone();
    let commit = tokio::task::spawn_blocking(move || active.commit(&worker_publication));
    entering.await.unwrap();
    let active = token.clone();
    let recorded = order.clone();
    let cancel = tokio::task::spawn_blocking(move || {
        active.cancel();
        recorded.lock().unwrap().push("cancelled");
    });
    assert!(!token.cancelled());
    release.send(()).unwrap();
    assert!(commit.await.unwrap());
    cancel.await.unwrap();
    assert_eq!(*order.lock().unwrap(), ["publication", "cancelled"]);
    assert!(!token.commit(&Unimock::new(())));
}
