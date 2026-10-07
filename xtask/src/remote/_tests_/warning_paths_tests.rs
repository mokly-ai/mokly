//! Error warning paths keep one output prefix and the defining module.

use crate::remote::runner::{DefaultRemoteRunner, RemoteRunner};

use super::harness_tests::{Case, harness};

#[test]
fn a_failed_log_read_uses_an_error_warning_without_a_repeated_prefix() {
    let fixture = harness(Case::LogUnavailable);
    assert!(
        DefaultRemoteRunner {
            dependencies: fixture.dependencies
        }
        .run()
        .is_err()
    );
    let events = fixture.events.lock().unwrap();
    assert!(events.iter().any(|event| event == "message:warning: log for repository unavailable: [xtask/remote] Logs command failed with exit 1"));
    for event in events.iter() {
        let output = if let Some(message) = event.strip_prefix("message:") {
            format!("[xtask/executor] {message}")
        } else if let Some(message) = event.strip_prefix("progress:") {
            format!("[xtask/remote] {message}")
        } else {
            continue;
        };
        assert!(output.matches("[xtask/executor]").count() <= 1, "{output}");
        assert!(output.matches("[xtask/remote]").count() <= 1, "{output}");
    }
}
