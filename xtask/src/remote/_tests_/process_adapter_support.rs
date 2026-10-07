//! Real shell requests with mocked process collaborators.

use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;

use crate::remote::contracts::{Clock, Interrupt, Logs};
use crate::remote::error::{Operation, Result};
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
        blacksmith: false,
    }
}

pub(super) fn process(
    interrupted: Arc<AtomicBool>,
    logs: Arc<dyn Logs + Send + Sync>,
) -> SystemProcess {
    SystemProcess {
        interrupt: Arc::new(InterruptFlag(interrupted)),
        clock: Arc::new(PollClock),
        logs,
    }
}

struct InterruptFlag(Arc<AtomicBool>);

impl Interrupt for InterruptFlag {
    fn arm(&self) -> Result<()> {
        panic!("the process adapter must not install signal handlers");
    }
    fn release(&self) {
        panic!("the process adapter must not release signal handlers");
    }
    fn requested(&self) -> bool {
        self.0.load(Ordering::SeqCst)
    }
}

struct PollClock;

impl Clock for PollClock {
    fn stamp(&self) -> String {
        panic!("process polling must not read a timestamp");
    }
    fn millis(&self) -> u128 {
        panic!("process polling must not read elapsed time");
    }
    fn sleep(&self) {
        thread::yield_now();
    }
    fn wait(&self, _: Duration) {
        panic!("process polling must not request a cleanup retry wait");
    }
}
