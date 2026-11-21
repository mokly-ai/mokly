//! A rejected completion task preserves the real pipe-thread drop order.

use std::io;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_sidecar::process_threads::{PipeThreads, SystemPipeThreads};

pub(super) struct FailThread(pub(super) usize, pub(super) AtomicUsize);

impl PipeThreads for FailThread {
    fn spawn(&self, task: Box<dyn FnOnce() + Send>) -> io::Result<()> {
        let call = self.1.fetch_add(1, Ordering::Relaxed) + 1;
        if call == self.0 {
            return Err(io::Error::new(
                io::ErrorKind::ResourceBusy,
                "injected pipe start failure",
            ));
        }
        SystemPipeThreads.spawn(task)
    }
}
