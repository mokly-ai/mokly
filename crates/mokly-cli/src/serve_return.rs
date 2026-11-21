//! Serve owns blocking maintenance; its idle worker retains only a weak pool.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, SyncSender};
use std::sync::{Arc, Weak};

use mokly_graph::write_activity::WriteLease;
use mokly_sidecar::error::Error;
use mokly_sidecar::pool::{ReturnWake, SidecarPool};

/// Admission waiting outside the process pool can defer a new transition.
#[cfg_attr(test, unimock::unimock(api = ReturnAdmissionMock))]
pub(super) trait ReturnAdmission: Send + Sync {
    /// Keep existing maintenance visible to optional writer admission.
    fn activity(&self) -> Option<Box<dyn WriteLease>> {
        None
    }
    /// Check admission without retaining its lock during process work.
    fn ready(&self) -> bool;
    /// Early calls yield to every admission wait, including head calls.
    fn early_ready(&self) -> bool {
        false
    }
    /// Report a background failure through the existing sidecar output owner.
    fn failed(&self, error: &Error);
}

enum Notice {
    Work,
    #[cfg(test)]
    Barrier(SyncSender<()>),
}

pub(super) struct Wake {
    sender: SyncSender<Notice>,
    signalled: AtomicBool,
}

impl ReturnWake for Wake {
    fn notify(&self) {
        self.signalled.store(true, Ordering::Release);
        self.admission_changed();
    }
}

impl Wake {
    pub(super) fn admission_changed(&self) {
        if self.signalled.load(Ordering::Acquire) {
            let _ = self.sender.try_send(Notice::Work);
        }
    }
}

pub(super) fn start(
    pool: &Arc<dyn SidecarPool>,
    admission: Weak<dyn ReturnAdmission>,
) -> Arc<Wake> {
    let (sender, receiver) = mpsc::sync_channel(1);
    let wake = Arc::new(Wake {
        sender,
        signalled: AtomicBool::new(false),
    });
    let observer: Arc<dyn ReturnWake> = wake.clone();
    pool.observe_head_return(Arc::downgrade(&observer));
    let pool = Arc::downgrade(pool);
    if let Err(error) = std::thread::Builder::new()
        .name("mokly-head-return".into())
        .spawn(move || {
            for notice in receiver {
                match notice {
                    Notice::Work => {}
                    #[cfg(test)]
                    Notice::Barrier(done) => {
                        let _ = done.send(());
                        continue;
                    }
                }
                loop {
                    if !admission
                        .upgrade()
                        .is_some_and(|admission| admission.ready())
                    {
                        break;
                    }
                    let Some(pool) = pool.upgrade() else {
                        return;
                    };
                    let _activity = admission
                        .upgrade()
                        .and_then(|admission| admission.activity());
                    let early = admission
                        .upgrade()
                        .is_some_and(|admission| admission.early_ready());
                    let outcome = if early {
                        match pool.maintain_head_preparation() {
                            Ok(true) => continue,
                            Ok(false) => pool.maintain_head_return(),
                            Err(error) => Err(error),
                        }
                    } else {
                        pool.maintain_head_return()
                    };
                    match outcome {
                        Ok(false) => break,
                        Ok(true) => {}
                        Err(error) => {
                            tracing::warn!(%error, "sidecar head return failed");
                            if let Some(admission) = admission.upgrade() {
                                admission.failed(&error);
                            }
                        }
                    }
                }
            }
        })
    {
        tracing::warn!(%error, "sidecar head return worker could not start");
    }
    wake
}

#[cfg(test)]
impl Wake {
    pub(super) fn synchronize(&self) {
        let (done, complete) = mpsc::sync_channel(0);
        self.sender.send(Notice::Barrier(done)).unwrap();
        complete.recv().unwrap();
    }
}

#[cfg(test)]
#[path = "_tests_/serve_return_worker_tests.rs"]
mod serve_return_worker_tests;
