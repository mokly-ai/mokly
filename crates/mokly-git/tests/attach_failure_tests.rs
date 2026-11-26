//! A failed attachment stops the whole tree before the runner reaps the child.

use std::path::Path;
use std::sync::Arc;

use mokly_git::command::{ProcessMode, Request, Runner};
use mokly_git::control::{SystemClock, Token};
use mokly_git::error::Error;
use mokly_git::system::SystemRunner;
use mokly_platform::error;
use mokly_platform::processes::{
    AttachFailure, ProcessGroups, ProcessGroupsMock, SystemProcessGroups,
};
use unimock::{MockFn, Unimock, matching};

#[test]
fn a_failed_attachment_stops_the_unattached_tree() {
    let groups = Unimock::new((
        ProcessGroupsMock::configure
            .next_call(matching!(_))
            .answers(&|_, command| SystemProcessGroups.configure(command)),
        ProcessGroupsMock::attach
            .next_call(matching!(_))
            .answers(&|_, child| {
                Err(AttachFailure::new(
                    child,
                    error::Error::Locked {
                        path: "attach-probe".into(),
                    },
                ))
            }),
        ProcessGroupsMock::kill_unattached
            .next_call(matching!(_))
            .answers(&|_, child| SystemProcessGroups.kill_unattached(child)),
    ));
    let runner: &dyn Runner = &SystemRunner {
        clock: Arc::new(SystemClock::default()),
        cancellation: Arc::new(Token::default()),
        groups: Arc::new(groups),
    };
    let result = runner.run(&Request {
        process_mode: ProcessMode::FullTree,
        directory: std::env::current_dir().unwrap(),
        args: vec!["--version".into()],
        stdin: vec![],
        output_limit: 1024,
        stderr_limit: 1024,
    });
    assert!(
        matches!(&result, Err(Error::Platform { source: error::Error::Locked { path } })
            if path == Path::new("attach-probe")),
        "{result:?}"
    );
}
