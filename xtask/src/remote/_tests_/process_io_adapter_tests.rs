//! Real shell output, stdin, environment and log streaming contracts.

use std::env;
use std::fs;
use std::process::Command;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use std::thread;

use unimock::{MockFn, Unimock, matching};

use crate::child_environment::SECRET_VARIABLES;
use crate::remote::adapter_support::{TestDirectory, wait_for};
use crate::remote::contracts::{LogSink, LogSinkWriteMock, LogsOpenMock};
use crate::remote::process::Process;

use super::process_adapter_support::{process, request};

fn isolated_environment(test_name: &str, variables: &[(&str, &str)]) -> bool {
    const CHILD_MARKER: &str = "MOKLY_XTASK_ADAPTER_ENV_CHILD";
    if env::var(CHILD_MARKER).as_deref() == Ok(test_name) {
        return false;
    }
    let output = Command::new(env::current_exe().unwrap())
        .args([
            "--exact",
            &format!("remote::process::process_io_adapter_tests::{test_name}"),
        ])
        .env(CHILD_MARKER, test_name)
        .envs(variables.iter().copied())
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stdout)
    );
    true
}

#[test]
fn streams_both_outputs_to_the_log_before_the_child_finishes() {
    let directory = TestDirectory::new();
    let bytes = Arc::new(Mutex::new(Vec::new()));
    let captured = bytes.clone();
    let sink: Arc<dyn LogSink + Send + Sync> = Arc::new(Unimock::new(
        LogSinkWriteMock
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, chunk| {
                captured.lock().unwrap().extend_from_slice(chunk);
                Ok(())
            })),
    ));
    let path = directory.path().join("command.log");
    let expected_path = path.clone();
    let logs = Arc::new(Unimock::new(
        LogsOpenMock
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                assert_eq!(path, expected_path);
                Ok(sink.clone())
            })),
    ));
    let process = process(Arc::new(AtomicBool::new(false)), logs);
    let mut request = request(
        directory.path(),
        "printf 'stdout-ready\n'; printf 'stderr-ready\n' >&2; \
         while [ ! -f release ]; do sleep 0.01; done; printf 'finished\n'",
    );
    request.log = Some(path);
    let (streamed, output) = thread::scope(|scope| {
        let child = scope.spawn(|| process.execute(&request));
        let streamed = wait_for(|| {
            let bytes = bytes.lock().unwrap();
            let text = String::from_utf8_lossy(&bytes);
            text.contains("stdout-ready\n") && text.contains("stderr-ready\n")
        });
        fs::write(directory.path().join("release"), []).unwrap();
        (streamed, child.join().unwrap().unwrap())
    });
    assert!(
        streamed,
        "both streams must arrive before releasing the child"
    );
    assert!(output.success());
    assert_eq!(output.stdout, "");
    assert_eq!(output.stderr, "");
    let text = String::from_utf8(bytes.lock().unwrap().clone()).unwrap();
    for line in ["stdout-ready", "stderr-ready", "finished"] {
        assert_eq!(text.lines().filter(|value| *value == line).count(), 1);
    }
}

#[test]
fn captures_both_outputs_and_exit_status_without_a_log() {
    let directory = TestDirectory::new();
    let process = process(Arc::new(AtomicBool::new(false)), Arc::new(Unimock::new(())));
    let output = process
        .execute(&request(
            directory.path(),
            "printf 'captured stdout'; printf 'captured stderr' >&2; exit 7",
        ))
        .unwrap();
    assert_eq!(output.stdout, "captured stdout");
    assert_eq!(output.stderr, "captured stderr");
    assert_eq!(output.code, Some(7));
    assert!(!output.success());
}

#[test]
fn non_cancellable_child_starts_with_an_interrupt_already_requested() {
    let directory = TestDirectory::new();
    let process = process(Arc::new(AtomicBool::new(true)), Arc::new(Unimock::new(())));
    let mut request = request(directory.path(), "printf 'cleanup started'");
    request.cancellable = false;
    let output = process.execute(&request).unwrap();
    assert!(output.success());
    assert_eq!(output.stdout, "cleanup started");
}

#[test]
fn sends_private_stdin_and_redacts_both_captured_outputs() {
    let directory = TestDirectory::new();
    let process = process(Arc::new(AtomicBool::new(false)), Arc::new(Unimock::new(())));
    let mut request = request(
        directory.path(),
        "input=$(cat); printf 'out:%s:end' \"$input\"; printf 'err:%s:end' \"$input\" >&2",
    );
    request.input = Some("adapter-test-only-secret".into());
    let output = process.execute(&request).unwrap();
    assert!(output.success());
    assert_eq!(output.stdout, "out:<redacted>:end");
    assert_eq!(output.stderr, "err:<redacted>:end");
}

#[test]
fn disables_auto_update_in_a_real_blacksmith_request_child() {
    if isolated_environment(
        "disables_auto_update_in_a_real_blacksmith_request_child",
        &[("BLACKSMITH_DISABLE_AUTO_UPDATE", "0")],
    ) {
        return;
    }
    let directory = TestDirectory::new();
    let process = process(Arc::new(AtomicBool::new(false)), Arc::new(Unimock::new(())));
    let mut request = request(
        directory.path(),
        "printf '%s' \"$BLACKSMITH_DISABLE_AUTO_UPDATE\"",
    );
    request.blacksmith = true;
    let output = process.execute(&request).unwrap();
    assert!(output.success());
    assert_eq!(output.stdout, "1");
}

#[test]
fn removes_secret_environment_from_real_children() {
    let variables: Vec<_> = SECRET_VARIABLES
        .iter()
        .map(|name| (*name, "adapter-test-only-token"))
        .collect();
    if isolated_environment("removes_secret_environment_from_real_children", &variables) {
        return;
    }
    let directory = TestDirectory::new();
    let process = process(Arc::new(AtomicBool::new(false)), Arc::new(Unimock::new(())));
    for name in SECRET_VARIABLES {
        assert_eq!(env::var(name).as_deref(), Ok("adapter-test-only-token"));
        let output = process
            .execute(&request(
                directory.path(),
                &format!("test \"${{{name}+set}}\" != set"),
            ))
            .unwrap();
        assert!(output.success(), "the child inherited a secret variable");
    }
}
