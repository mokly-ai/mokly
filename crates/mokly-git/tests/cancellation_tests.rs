//! Binary stdin and cancellation of a real Git-owned descendant tree.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
#[cfg(unix)]
use std::{
    fs, thread,
    time::{Duration, Instant},
};

use mokly_git::command::{self, DEFAULT_OUTPUT_LIMIT, Request};
use mokly_git::control::Token;
use mokly_git::error::Error;

use support::{Fixture, runner};

#[expect(
    dead_code,
    reason = "The support module also serves repository integration tests."
)]
mod support;

#[test]
fn stdin_is_written_and_closed_without_losing_binary_data() {
    let fixture = Fixture::new();
    let request = Request {
        directory: fixture.root().to_owned(),
        args: vec!["hash-object".into(), "--stdin".into()],
        stdin: vec![0, 255, 10],
        output_limit: 1024,
        stderr_limit: 1024 * 1024,
    };
    let output = runner(Arc::new(Token::default())).run(&request).unwrap();
    assert_eq!(output.stdout.len(), 41);
    assert!(matches!(
        runner(Arc::new(Token::default())).run(&Request {
            stdin: vec![0; DEFAULT_OUTPUT_LIMIT + 1],
            ..request
        }),
        Err(Error::InputLimit { .. })
    ));
}

#[cfg(unix)]
#[test]
fn cancellation_terminates_stubborn_descendants_and_settles_after_pipe_closure() {
    let fixture = Fixture::new();
    let ready = fixture.root().join("ready");
    let alias = format!(
        "alias.block=!trap '' TERM; printf ready > '{}.tmp'; mv '{}.tmp' '{}'; while :; do sleep 10; done",
        ready.display(),
        ready.display(),
        ready.display()
    );
    let token = Arc::new(Token::default());
    let runner = runner(token.clone());
    let request = Request {
        directory: fixture.root().to_owned(),
        args: vec!["-c".into(), alias.into(), "block".into()],
        stdin: vec![],
        output_limit: 1024,
        stderr_limit: 1024 * 1024,
    };
    let pending = thread::spawn(move || runner.run(&request));
    let deadline = Instant::now() + Duration::from_secs(10);
    while !ready.exists() {
        assert!(
            Instant::now() < deadline,
            "Git child did not reach readiness"
        );
        thread::yield_now();
    }
    assert_eq!(fs::read(ready).unwrap(), b"ready");
    token.cancel();
    assert!(matches!(pending.join().unwrap(), Err(Error::Cancelled)));
}

#[cfg(unix)]
#[test]
fn completion_stops_a_helper_that_outlives_git_with_closed_pipes() {
    let fixture = Fixture::new();
    let ready = fixture.root().join("helper-pid");
    let alias = format!(
        "alias.helper=!sleep 60 </dev/null >/dev/null 2>&1 & echo $! > '{}'",
        ready.display()
    );
    let request = Request {
        directory: fixture.root().to_owned(),
        args: vec!["-c".into(), alias.into(), "helper".into()],
        stdin: vec![],
        output_limit: 1024,
        stderr_limit: 1024 * 1024,
    };
    runner(Arc::new(Token::default())).run(&request).unwrap();
    let pid = fs::read_to_string(ready).unwrap();
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        let output = std::process::Command::new("ps")
            .args(["-o", "stat=", "-p", pid.trim()])
            .output()
            .unwrap();
        let state = String::from_utf8_lossy(&output.stdout);
        if state.trim().is_empty() || state.trim().starts_with('Z') {
            break;
        }
        assert!(
            Instant::now() < deadline,
            "owned helper is still executing: {state}"
        );
        thread::yield_now();
    }
}

struct AfterStart {
    calls: AtomicUsize,
}

impl command::Cancellation for AfterStart {
    fn is_cancelled(&self) -> bool {
        self.calls.fetch_add(1, Ordering::SeqCst) > 0
    }
}

#[test]
fn an_active_git_process_is_cancelled_through_its_process_group() {
    let fixture = Fixture::new();
    let runner = runner(Arc::new(Token::default()));
    let request = Request {
        directory: fixture.root().to_owned(),
        args: vec![
            "-c".into(),
            "alias.mokly-wait=!sleep 60".into(),
            "mokly-wait".into(),
        ],
        stdin: vec![],
        output_limit: DEFAULT_OUTPUT_LIMIT,
        stderr_limit: command::DEFAULT_STDERR_LIMIT,
    };
    let cancellation = AfterStart {
        calls: AtomicUsize::new(0),
    };
    assert!(matches!(
        runner.run_cancellable(&request, &cancellation),
        Err(Error::Cancelled)
    ));
    assert!(cancellation.calls.load(Ordering::SeqCst) >= 2);
}
