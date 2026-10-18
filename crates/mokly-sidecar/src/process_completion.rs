//! Process completion is published only after child exit and diagnostic drain.

use std::sync::mpsc::{Receiver, SyncSender};

use crate::process_io::Reaper;

#[cfg_attr(test, unimock::unimock(api = CompletionWaitMock))]
pub(super) trait CompletionWait {
    fn reap(&mut self);
    fn drain(&mut self);
}

pub(super) struct ProcessCompletion {
    pub(super) child: Reaper,
    pub(super) diagnostics: Receiver<()>,
}

impl CompletionWait for ProcessCompletion {
    fn reap(&mut self) {
        self.child.wait();
    }
    fn drain(&mut self) {
        let _ = self.diagnostics.recv();
    }
}

pub(super) fn complete(wait: &mut dyn CompletionWait, exited: SyncSender<()>) {
    wait.reap();
    wait.drain();
    let _ = exited.send(());
}

#[cfg(test)]
#[path = "_tests_/process_completion_tests.rs"]
mod process_completion_tests;
