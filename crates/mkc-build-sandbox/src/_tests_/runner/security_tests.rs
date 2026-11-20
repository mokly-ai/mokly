//! Credentials never enter argv or display even through valid request fields.

use mkc_build_interface::input::Branch;
use mkc_build_interface::log::BuildStream;
use mkc_build_interface::outcome::BuildOutcome;

use super::fixtures::{INSTALLATION, request};
use super::script::{checkout, events};
use super::support::Harness;

#[tokio::test]
async fn a_credential_in_a_typed_argument_stops_before_provider_dispatch() {
    let mut request = request();
    request.branch = Branch::new(INSTALLATION).unwrap();
    let mut calls = checkout();
    calls.pop();
    let harness = Harness::new(request, calls);
    assert!(matches!(
        harness.run().await,
        BuildOutcome::Infrastructure(_)
    ));
}

#[tokio::test]
async fn display_quotes_apostrophes_without_changing_direct_argv() {
    let mut request = request();
    request.branch = Branch::new("feature/user's-build").unwrap();
    let mut calls = checkout();
    let last = calls.last_mut().unwrap();
    last.args[4] = "feature/user's-build".into();
    last.events = events(1, "", "");
    let harness = Harness::new(request, calls);
    assert!(matches!(
        harness.run().await,
        BuildOutcome::StepFailed { .. }
    ));
    assert!(harness.chunks.lock().unwrap().iter().any(|chunk| {
        chunk.stream == BuildStream::System
            && String::from_utf8_lossy(&chunk.bytes).contains("'feature/user'\\''s-build'")
    }));
}
