//! The Git runner reads signal delivery without waiting for async notification.

use std::sync::Arc;

use crate::cancellation::CancellationMock;
use mokly_git::command::Cancellation;
use mokly_publish::runtime::CommandCancellation;
use unimock::{MockFn, Unimock, matching};

use super::PublicationSignals;

#[test]
fn git_queries_drain_then_observe_delivery() {
    let signals = Arc::new(Unimock::new((
        CancellationMock::drain.next_call(matching!()).returns(()),
        CancellationMock::requested
            .next_call(matching!())
            .returns(true),
    )));
    let cancellation = PublicationSignals {
        signals,
        token: CommandCancellation::default(),
    };
    assert!(cancellation.is_cancelled());
}
