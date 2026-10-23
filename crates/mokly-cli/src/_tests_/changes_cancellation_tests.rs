//! The Git observer joins the same cancellation source as native and sidecar work.

use std::sync::Arc;

use mokly_cli::cancellation::{BuildCancellation, Cancellation};
use mokly_git::control::{self, Token};
use mokly_sidecar::workers::ClockMock;
use unimock::{MockFn, Unimock, matching};

use super::GitCancellation;

#[test]
fn a_cli_interruption_cancels_the_git_token_and_stays_cancelled() {
    let command: Arc<dyn Cancellation> = Arc::new(BuildCancellation::new(Arc::new(Unimock::new(
        ClockMock::now_ms.next_call(matching!()).returns(0_u64),
    ))));
    let joined = GitCancellation {
        command: command.clone(),
        token: Token::default(),
    };
    let cancellation: &dyn control::Cancellation = &joined;
    assert!(!cancellation.cancelled());
    assert!(!command.interrupt());
    assert!(cancellation.cancelled());
    assert!(control::Cancellation::cancelled(&joined.token));
}
