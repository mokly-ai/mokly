//! Shared one-shot signals observe delivery before asynchronous cleanup is scheduled.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;

use mokly_cli::cancellation::{
    BuildCancellation, Cancellation, OutputProtection, ServeCancellation,
};
use mokly_graph::error::{InternalError, Result};
use mokly_publish::runtime::CommandCancellation;
use mokly_sidecar::pool::SidecarPool;
use mokly_sidecar::process_clock::SystemClock;
#[cfg(unix)]
use signal_hook::{
    SigId,
    consts::{SIGHUP, SIGINT, SIGTERM},
    flag,
    iterator::{Handle, Signals},
    low_level::unregister,
};

pub(super) struct Interrupts {
    #[cfg(all(debug_assertions, unix))]
    /// Weak test observation cannot keep a signal registration alive.
    pub(super) pending_probe: std::sync::Weak<AtomicBool>,
    pub(super) cancellation: Arc<dyn Cancellation>,
    pub(super) publication: CommandCancellation,
    pub(super) pool: Arc<Mutex<Option<Arc<dyn SidecarPool>>>>,
    #[cfg(unix)]
    signals: Handle,
    #[cfg(unix)]
    registrations: Vec<SigId>,
    #[cfg(unix)]
    listener: Option<thread::JoinHandle<()>>,
}

/// The OS handler sets pending before the listener is scheduled.
struct Observed {
    pending: Arc<AtomicBool>,
    inner: Arc<dyn Cancellation>,
    publication: CommandCancellation,
}
impl Cancellation for Observed {
    fn requested(&self) -> bool {
        self.pending.load(Ordering::SeqCst) || self.inner.requested()
    }
    fn drain(&self) {
        if self.pending.load(Ordering::SeqCst) {
            self.publication.token.cancel();
        }
    }
    fn interrupt(&self) -> bool {
        self.publication.token.cancel();
        self.inner.interrupt()
    }
    fn protect_output(&self) -> Option<Box<dyn OutputProtection>> {
        self.inner.protect_output()
    }
    fn wait_for_forced_exit(&self) -> bool {
        self.inner.wait_for_forced_exit()
    }
}

impl Interrupts {
    pub(super) fn new() -> Result<Self> {
        Self::start(false)
    }
    pub(super) fn publish() -> Result<Self> {
        Self::start(true)
    }
    fn start(publish: bool) -> Result<Self> {
        let inner: Arc<dyn Cancellation> = if publish {
            Arc::new(ServeCancellation::default())
        } else {
            Arc::new(BuildCancellation::new(Arc::new(SystemClock::new())))
        };
        let pending = Arc::new(AtomicBool::new(false));
        let publication = CommandCancellation::default();
        let cancellation: Arc<dyn Cancellation> = Arc::new(Observed {
            pending: pending.clone(),
            inner,
            publication: publication.clone(),
        });
        let pool: Arc<Mutex<Option<Arc<dyn SidecarPool>>>> = Arc::new(Mutex::new(None));
        let state = cancellation.clone();
        let owned = pool.clone();
        let stopping = AtomicBool::new(false);
        let consume = move || {
            if state.interrupt() || state.wait_for_forced_exit() {
                if let Some(pool) = owned
                    .lock()
                    .unwrap_or_else(|error| error.into_inner())
                    .as_ref()
                {
                    let _ = pool.abort();
                }
                std::process::exit(1);
            }
            let pool = owned
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .clone();
            if let Some(pool) = pool
                && !stopping.swap(true, Ordering::SeqCst)
            {
                let _ = thread::Builder::new()
                    .name("mokly-shutdown".into())
                    .spawn(move || {
                        let _ = pool.shutdown();
                    });
            }
        };
        #[cfg(unix)]
        {
            let mut registrations = Vec::new();
            for signal in [SIGINT, SIGTERM, SIGHUP] {
                match flag::register(signal, pending.clone()) {
                    Ok(id) => registrations.push(id),
                    Err(source) => {
                        for id in registrations {
                            unregister(id);
                        }
                        return Err(InternalError::Provider {
                            source: Box::new(source),
                        }
                        .into());
                    }
                }
            }
            let mut signals = match Signals::new([SIGINT, SIGTERM, SIGHUP]) {
                Ok(signals) => signals,
                Err(source) => {
                    for id in registrations {
                        unregister(id);
                    }
                    return Err(InternalError::Provider {
                        source: Box::new(source),
                    }
                    .into());
                }
            };
            let handle = signals.handle();
            let listener =
                match thread::Builder::new()
                    .name("mokly-signals".into())
                    .spawn(move || {
                        for _ in signals.forever() {
                            consume();
                        }
                    }) {
                    Ok(listener) => listener,
                    Err(source) => {
                        handle.close();
                        for id in registrations {
                            unregister(id);
                        }
                        return Err(InternalError::Provider {
                            source: Box::new(source),
                        }
                        .into());
                    }
                };
            Ok(Self {
                #[cfg(debug_assertions)]
                pending_probe: Arc::downgrade(&pending),
                cancellation,
                publication,
                pool,
                signals: handle,
                registrations,
                listener: Some(listener),
            })
        }
        #[cfg(not(unix))]
        {
            if let Err(source) = ctrlc::set_handler(move || {
                pending.store(true, Ordering::SeqCst);
                consume();
            }) {
                return Err(InternalError::Provider {
                    source: Box::new(source),
                }
                .into());
            }
            Ok(Self {
                cancellation,
                publication,
                pool,
            })
        }
    }
}
#[cfg(unix)]
impl Drop for Interrupts {
    fn drop(&mut self) {
        self.signals.close();
        for id in self.registrations.drain(..) {
            unregister(id);
        }
        if let Some(listener) = self.listener.take() {
            let _ = listener.join();
        }
    }
}
