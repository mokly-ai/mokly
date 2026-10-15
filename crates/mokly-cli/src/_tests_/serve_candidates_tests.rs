//! Shutdown waits for candidate work before it delegates render cleanup.

use std::future::Future;
use std::sync::Arc;
use std::task::{Context, Waker};

use mokly_server::shutdown::{Lifecycle, LifecycleMock};
use unimock::{MockFn, Unimock, matching};

use super::{CandidateWork, ManualCandidates};

#[tokio::test]
async fn shutdown_stops_admission_and_drains_the_candidate_first() {
    let hooks = Unimock::new((
        LifecycleMock::stop_watcher
            .next_call(matching!())
            .returns(Ok(())),
        LifecycleMock::cancel_renders
            .next_call(matching!())
            .returns(Ok(())),
    ));
    let candidates = ManualCandidates::new(Arc::new(hooks));
    let mut closing;
    {
        let _active = candidates.enter().unwrap();
        candidates.stop_watcher().await.unwrap();
        assert!(!candidates.active());
        assert!(candidates.enter().is_none());
        closing = Box::pin(candidates.cancel_renders());
        assert!(
            closing
                .as_mut()
                .poll(&mut Context::from_waker(Waker::noop()))
                .is_pending()
        );
    }
    closing.await.unwrap();
    assert!(candidates.enter().is_none());
}
