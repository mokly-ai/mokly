//! Idle jobs run on a worker only while no foreground request is active.

use crate::work::Workers;
use crate::work_background::HeldWorker;

/// One blocking step of idle work, which yields to foreground requests.
pub trait IdleJob: Send {
    /// Run on a worker thread. `idle` turns false when a foreground request becomes active.
    fn run(self: Box<Self>, idle: &dyn Fn() -> bool);
}

impl Workers {
    /// Wait until no foreground request is active and a worker is free, then run `job` on a
    /// blocking thread. The async side holds the worker until the join and frees it when this
    /// call returns. A stopped scheduler drops the job unrun, and a panic drops what the job
    /// held, so its owner sees no result.
    pub(crate) async fn idle_job(&self, job: Box<dyn IdleJob>) {
        let activity = self.activity.as_ref().map(|activity| activity.enter());
        let Some(permit) = self.background_permit().await else {
            return;
        };
        let _worker = HeldWorker::new(permit, self.priority.enter(false));
        let active = self.background_jobs.start();
        let priority = self.priority.clone();
        let parent = tracing::Span::current();
        let _ = tokio::task::spawn_blocking(move || {
            let _activity = activity;
            let _active = active;
            parent.in_scope(|| job.run(&|| priority.idle()));
        })
        .await;
    }
}
