//! The step starts only after the first ready Changes, and never beside a foreground request.

use std::sync::{Arc, Mutex};
use std::task::{Context, Waker};

use mokly_model::public_metadata::ChangesStatus;
use tokio::sync::watch;

use crate::background::Background;
use crate::publication::Publications;

use super::hold::hold;
use super::support::{Calls, changed, primed, used};

#[tokio::test]
async fn the_step_waits_for_the_first_ready_changes() {
    let session = used(4);
    let calls = Calls::default();
    let step = session.step(calls.encoder(|_| {}));
    let (_stop, stop) = watch::channel(false);
    let mut run = step.run(stop);
    let mut context = Context::from_waker(Waker::noop());
    for status in [
        ChangesStatus::Preparing,
        ChangesStatus::Unavailable,
        ChangesStatus::Pending,
    ] {
        assert!(run.as_mut().poll(&mut context).is_pending(), "{status:?}");
        assert_eq!(
            (session.work.workers.available_permits(), calls.len()),
            (1, 0),
            "an idle job before {status:?}"
        );
        session.publish(status);
    }
    assert!(run.as_mut().poll(&mut context).is_pending());
    assert_eq!(
        (session.work.workers.available_permits(), calls.len()),
        (1, 0),
        "an idle job before the ready Changes"
    );
    let ready = session.publish_ready();
    run.await;
    assert_eq!(calls.revisions(), vec![Some(ready.index.revision); 4]);
    assert_eq!(primed(&session.shared.current()), 4);
}

#[tokio::test]
async fn the_step_waits_while_a_foreground_request_is_active() {
    let session = changed(4);
    let calls = Calls::default();
    let foreground = Arc::new(Mutex::new(None));
    let (held, hook) = hold(2, {
        let foreground = foreground.clone();
        let priority = session.work.priority.clone();
        move || *foreground.lock().unwrap() = Some(priority.enter(true))
    });
    let step = session.step(calls.encoder(hook));
    let before = session.work.priority.enter(true);
    let (_stop, stop) = watch::channel(false);
    let mut run = step.run(stop);
    assert!(
        run.as_mut()
            .poll(&mut Context::from_waker(Waker::noop()))
            .is_pending()
    );
    assert_eq!(
        (session.work.workers.available_permits(), calls.len()),
        (1, 0),
        "an idle job while a foreground request is active"
    );
    drop(before);
    let worker = held.release(&session.work, &mut run).await;
    assert!(worker.is_some(), "the step yields instead of ending");
    assert_eq!(
        (session.work.turn.available_permits(), calls.len()),
        (0, 2),
        "after its second encode, the chunk yields and waits for admission"
    );
    drop(worker);
    foreground.lock().unwrap().take();
    run.await;
    assert_eq!(calls.len(), 4, "the chunk keeps its two encodes");
    assert_eq!(primed(&session.shared.current()), 4);
}
