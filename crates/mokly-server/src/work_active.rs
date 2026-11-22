//! Blocking background jobs remain drainable after their dispatch permit ends.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use tokio::sync::Notify;

#[derive(Default)]
pub(crate) struct ActiveJobs {
    count: AtomicUsize,
    changed: Notify,
}

impl ActiveJobs {
    pub(crate) fn start(self: &Arc<Self>) -> Job {
        self.count.fetch_add(1, Ordering::SeqCst);
        Job(self.clone())
    }

    pub(crate) async fn drain(&self) {
        loop {
            let changed = self.changed.notified();
            tokio::pin!(changed);
            changed.as_mut().enable();
            if self.count.load(Ordering::SeqCst) == 0 {
                return;
            }
            changed.await;
        }
    }
}

pub(crate) struct Job(Arc<ActiveJobs>);
impl Drop for Job {
    fn drop(&mut self) {
        self.0.count.fetch_sub(1, Ordering::SeqCst);
        self.0.changed.notify_waiters();
    }
}
