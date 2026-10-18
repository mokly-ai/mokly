//! Child exit is published independently of diagnostic drain.

use std::sync::mpsc::SyncSender;

use crate::process_io::Reaper;

#[cfg_attr(test, unimock::unimock(api = CompletionWaitMock))]
pub(super) trait CompletionWait {
    fn reap(&mut self);
}

pub(super) struct ProcessCompletion {
    pub(super) child: Reaper,
}

impl CompletionWait for ProcessCompletion {
    fn reap(&mut self) {
        self.child.wait();
    }
}

pub(super) fn complete(wait: &mut dyn CompletionWait, exited: SyncSender<()>) {
    wait.reap();
    let _ = exited.send(());
}

#[cfg(test)]
#[path = "_tests_/process_completion_tests.rs"]
mod process_completion_tests;
