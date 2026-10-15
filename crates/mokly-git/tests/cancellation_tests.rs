//! Real process cancellation returns only after the runner reaps and drains Git.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_git::command::{Cancellation, DEFAULT_OUTPUT_LIMIT, Request, Runner};
use mokly_git::error::Error;
use mokly_git::system::SystemRunner;
use mokly_platform::processes::SystemProcessGroups;

struct AfterStart {
    calls: AtomicUsize,
}
impl Cancellation for AfterStart {
    fn is_cancelled(&self) -> bool {
        self.calls.fetch_add(1, Ordering::SeqCst) > 0
    }
}

#[test]
fn an_active_git_process_is_cancelled_through_its_process_group() {
    let runner: &dyn Runner = &SystemRunner {
        groups: Arc::new(SystemProcessGroups),
    };
    let directory = std::env::current_dir().unwrap();
    let request = Request {
        directory,
        args: vec![
            "-c".into(),
            "alias.mokly-wait=!sleep 60".into(),
            "mokly-wait".into(),
        ],
        output_limit: DEFAULT_OUTPUT_LIMIT,
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
