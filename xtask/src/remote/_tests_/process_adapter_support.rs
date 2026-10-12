//! Real shell requests with mocked process collaborators.

use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;

use unimock::{MockFn, Unimock, matching};

use crate::remote::contracts::{ClockSleepMock, InterruptRequestedMock, Logs};
use crate::remote::error::Operation;
use crate::remote::process::{Request, SystemProcess};

pub(super) fn request(directory: &Path, script: &str) -> Request {
    Request {
        program: "sh".into(),
        args: vec!["-c".into(), script.into()],
        cwd: directory.to_owned(),
        operation: Operation::Blacksmith,
        input: None,
        log: None,
        cancellable: true,
        git_index: None,
        blacksmith: false,
    }
}

pub(super) fn process(
    interrupted: Arc<AtomicBool>,
    logs: Arc<dyn Logs + Send + Sync>,
) -> SystemProcess {
    SystemProcess {
        interrupt: Arc::new(
            Unimock::new(
                InterruptRequestedMock
                    .each_call(matching!())
                    .answers_arc(Arc::new(move |_| interrupted.load(Ordering::SeqCst))),
            )
            .no_verify_in_drop(),
        ),
        clock: Arc::new(
            Unimock::new(
                ClockSleepMock
                    .each_call(matching!())
                    .answers(&|_| thread::yield_now()),
            )
            .no_verify_in_drop(),
        ),
        logs,
    }
}
