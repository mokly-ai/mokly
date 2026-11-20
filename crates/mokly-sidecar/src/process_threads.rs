//! Host thread creation for the sidecar's pipe and completion tasks.

use std::io;
use std::thread;

/// Thread creation boundary for sidecar startup.
pub trait PipeThreads: Send + Sync {
    /// Start one detached pipe or completion task.
    fn spawn(&self, task: Box<dyn FnOnce() + Send>) -> io::Result<()>;
}

/// Host implementation that names each sidecar task.
pub struct SystemPipeThreads;

impl PipeThreads for SystemPipeThreads {
    fn spawn(&self, task: Box<dyn FnOnce() + Send>) -> io::Result<()> {
        thread::Builder::new()
            .name("mokly-sidecar-pipe".to_owned())
            .spawn(task)
            .map(|_| ())
    }
}
