//! Real Git execution, bounded output and exit classification.

use std::sync::Arc;

use mokly_git::command::{Request, Runner};
use mokly_git::control::{SystemClock, Token};
use mokly_git::error::Error;
use mokly_git::system::SystemRunner;
use mokly_platform::processes::SystemProcessGroups;

#[test]
fn git_output_is_bounded_and_failures_are_typed() {
    let runner: &dyn Runner = &SystemRunner {
        clock: Arc::new(SystemClock::default()),
        cancellation: Arc::new(Token::default()),
        groups: Arc::new(SystemProcessGroups),
    };
    let request = Request {
        directory: std::env::current_dir().unwrap(),
        args: vec!["--version".into()],
        stdin: vec![],
        output_limit: 1024,
        stderr_limit: 1024 * 1024,
    };
    let output = runner.run(&request).unwrap();
    assert!(output.stdout.starts_with(b"git version "));
    assert!(matches!(
        runner.run(&Request {
            output_limit: 1,
            stderr_limit: 1024 * 1024,
            ..request.clone()
        }),
        Err(Error::OutputLimit { limit: 1 })
    ));
    assert!(matches!(
        runner.run(&Request {
            args: vec!["not-a-git-command".into()],
            ..request
        }),
        Err(Error::CommandFailed { .. })
    ));
}
