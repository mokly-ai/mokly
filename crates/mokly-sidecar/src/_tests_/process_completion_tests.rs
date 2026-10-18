//! Mocked reaping proves exit notification without a real process or clock.

use std::sync::{Arc, Mutex, mpsc};

use unimock::{MockFn, Unimock, matching};

use super::{CompletionWaitMock, complete};

#[test]
fn exit_notification_follows_reaping_without_waiting_for_diagnostics() {
    let (sender, receiver) = mpsc::sync_channel(1);
    let received = Arc::new(Mutex::new(receiver));
    let observed = received.clone();
    let mut wait = Unimock::new(CompletionWaitMock::reap.next_call(matching!()).answers_arc(
        Arc::new(move |_| {
            assert!(matches!(
                observed.lock().unwrap().try_recv(),
                Err(mpsc::TryRecvError::Empty)
            ));
        }),
    ));
    complete(&mut wait, sender);
    assert_eq!(received.lock().unwrap().try_recv(), Ok(()));
}
