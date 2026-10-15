//! The first signal cancels work and drains the pool; the second exits immediately.

use std::sync::{Arc, Mutex};
use std::thread;

use mokly_cli::cancellation::{BuildCancellation, Cancellation};
use mokly_graph::error::{InternalError, Result};
use mokly_sidecar::pool::SidecarPool;
use mokly_sidecar::process_clock::SystemClock;

pub(super) struct Interrupts {
    pub(super) cancellation: Arc<dyn Cancellation>,
    pool: Arc<Mutex<Option<Arc<dyn SidecarPool>>>>,
    stopped: Arc<Mutex<bool>>,
}

impl Interrupts {
    pub(super) fn new() -> Result<Self> {
        let cancellation: Arc<dyn Cancellation> =
            Arc::new(BuildCancellation::new(Arc::new(SystemClock::new())));
        let pool: Arc<Mutex<Option<Arc<dyn SidecarPool>>>> = Arc::new(Mutex::new(None));
        let stopped = Arc::new(Mutex::new(false));
        let signal_state = cancellation.clone();
        let signal_pool = pool.clone();
        let signal_stopped = stopped.clone();
        if let Err(source) = ctrlc::set_handler(move || {
            if signal_state.interrupt() {
                if let Some(pool) = signal_pool
                    .lock()
                    .unwrap_or_else(|error| error.into_inner())
                    .as_ref()
                {
                    let _ = pool.abort();
                }
                std::process::exit(1);
            }
            let pool = signal_pool
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .clone();
            if let Some(pool) = pool {
                let stopped = signal_stopped.clone();
                let _ = thread::Builder::new()
                    .name("mokly-shutdown".into())
                    .spawn(move || {
                        let _ = stop(pool.as_ref(), &stopped);
                    });
            }
        }) {
            return Err(InternalError::Provider {
                source: Box::new(source),
            }
            .into());
        }
        Ok(Self {
            cancellation,
            pool,
            stopped,
        })
    }

    pub(super) fn attach(&self, pool: Arc<dyn SidecarPool>) {
        *self.pool.lock().unwrap_or_else(|error| error.into_inner()) = Some(pool);
    }

    pub(super) fn shutdown(&self) -> mokly_sidecar::error::Result<()> {
        let pool = self
            .pool
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .clone();
        if let Some(pool) = pool {
            stop(pool.as_ref(), &self.stopped)
        } else {
            Ok(())
        }
    }
}

fn stop(pool: &dyn SidecarPool, stopped: &Mutex<bool>) -> mokly_sidecar::error::Result<()> {
    let mut stopped = stopped.lock().unwrap_or_else(|error| error.into_inner());
    if *stopped {
        return Ok(());
    }
    *stopped = true;
    pool.shutdown()
}
