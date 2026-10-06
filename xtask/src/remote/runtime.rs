//! Operating-system environment, PATH, time, signal and terminal adapters.

use std::env;
use std::fs;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use chrono::Utc;

use crate::executor::Decision;

use crate::remote::contracts::{Clock, Environment, Interrupt, Programs, Reporter};
use crate::remote::error::{Error, Operation, Result};

/// Real environment reader.
pub(crate) struct SystemEnvironment;

impl Environment for SystemEnvironment {
    fn get(&self, name: &str) -> Option<String> {
        env::var(name).ok()
    }
    fn pid(&self) -> u32 {
        std::process::id()
    }
}

/// PATH lookup with an injected environment.
pub(crate) struct SystemPrograms {
    /// Environment source.
    pub(crate) environment: Arc<dyn Environment + Send + Sync>,
}

impl Programs for SystemPrograms {
    fn find(&self, name: &str) -> Result<bool> {
        let Some(path) = self.environment.get("PATH") else {
            return Ok(false);
        };
        for directory in env::split_paths(&path) {
            let candidate = directory.join(name);
            let metadata = match fs::metadata(candidate) {
                Ok(metadata) => metadata,
                Err(source) if source.kind() == std::io::ErrorKind::NotFound => continue,
                Err(source) => {
                    return Err(Error::Io {
                        operation: Operation::Program,
                        source,
                    });
                }
            };
            #[cfg(unix)]
            let executable = metadata.permissions().mode() & 0o111 != 0;
            #[cfg(not(unix))]
            let executable = true;
            if metadata.is_file() && executable {
                return Ok(true);
            }
        }
        Ok(false)
    }
}

/// UTC clock and bounded process-poll wait.
pub(crate) struct SystemClock;

impl Clock for SystemClock {
    fn stamp(&self) -> String {
        Utc::now().format("%Y%m%dT%H%M%SZ").to_string()
    }
    fn millis(&self) -> u128 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_or(0, |duration| duration.as_millis())
    }
    fn sleep(&self) {
        thread::sleep(Duration::from_millis(25));
    }
}

/// Shared interrupt flag owned by the signal adapter.
#[derive(Default)]
pub(crate) struct SystemInterrupt {
    /// Flag retained by the installed callback.
    flag: Arc<AtomicBool>,
}

impl Interrupt for SystemInterrupt {
    fn arm(&self) -> Result<()> {
        let flag = Arc::clone(&self.flag);
        match ctrlc::set_handler(move || flag.store(true, Ordering::SeqCst)) {
            Ok(()) => Ok(()),
            Err(source) => Err(Error::Signal { source }),
        }
    }
    fn requested(&self) -> bool {
        self.flag.load(Ordering::SeqCst)
    }
}

/// Plain developer output with stable namespaces.
pub(crate) struct SystemReporter;

impl Reporter for SystemReporter {
    fn decision(&self, decision: Decision) {
        println!("{decision}");
    }
    fn executor(&self, message: &str) {
        eprintln!("[xtask/executor] {message}");
    }
    fn progress(&self, message: &str) {
        eprintln!("[xtask/remote] {message}");
    }
}
