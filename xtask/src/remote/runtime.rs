//! Operating-system environment, PATH, time, signal and terminal adapters.

use std::env;
use std::fs;
use std::io::{self, Write};
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicU8, Ordering};
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

/// PATH lookup with injected environment and file access.
pub(crate) struct SystemPrograms {
    /// Environment source.
    pub(crate) environment: Arc<dyn Environment + Send + Sync>,
    /// Candidate file lookup.
    pub(crate) files: Arc<dyn ProgramFiles + Send + Sync>,
}

/// File type and execute-permission lookup for one PATH candidate.
#[cfg_attr(test, unimock::unimock(api = [ProgramFilesExecutableMock]))]
pub(crate) trait ProgramFiles: Send + Sync {
    /// Check whether the candidate is an executable regular file.
    fn executable(&self, path: &Path) -> Result<bool>;
}

/// Operating-system candidate file lookup.
pub(crate) struct SystemProgramFiles;

impl ProgramFiles for SystemProgramFiles {
    fn executable(&self, path: &Path) -> Result<bool> {
        let metadata = match fs::metadata(path) {
            Ok(metadata) => metadata,
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
        Ok(metadata.is_file() && executable)
    }
}

impl Programs for SystemPrograms {
    fn find(&self, name: &str) -> Result<bool> {
        let Some(path) = self.environment.get("PATH") else {
            return Ok(false);
        };
        for directory in env::split_paths(&path) {
            let candidate = directory.join(name);
            match self.files.executable(&candidate) {
                Ok(true) => return Ok(true),
                Ok(false) | Err(_) => continue,
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
    /// One atomic orders signal requests with release to prevent a lost signal.
    state: Arc<AtomicU8>,
}

impl Interrupt for SystemInterrupt {
    fn arm(&self) -> Result<()> {
        let state = Arc::clone(&self.state);
        match ctrlc::set_handler(move || {
            let previous = state.fetch_or(REQUESTED, Ordering::SeqCst);
            if signal_action(previous & RELEASED != 0) == SignalAction::Exit {
                std::process::exit(130);
            }
        }) {
            Ok(()) => Ok(()),
            Err(source) => Err(Error::Signal { source }),
        }
    }
    fn release(&self) {
        self.state.fetch_or(RELEASED, Ordering::SeqCst);
    }
    fn requested(&self) -> bool {
        self.state.load(Ordering::SeqCst) & REQUESTED != 0
    }
}

/// Plain developer output with stable namespaces.
pub(crate) struct SystemReporter;

impl Reporter for SystemReporter {
    fn decision(&self, decision: Decision) {
        let _ = writeln!(io::stdout().lock(), "{decision}");
    }
    fn executor(&self, message: &str) {
        let _ = writeln!(io::stderr().lock(), "[xtask/executor] {message}");
    }
    fn progress(&self, message: &str) {
        let _ = writeln!(io::stderr().lock(), "[xtask/remote] {message}");
    }
}

#[cfg(test)]
#[path = "_tests_/runtime_programs_tests.rs"]
mod runtime_programs_tests;

/// Bit set by the callback before it observes the release state.
const REQUESTED: u8 = 1;
/// Bit set before the application reads the interrupt flag again.
const RELEASED: u8 = 2;

/// Signal behavior selected from the installed handler's release state.
#[derive(Debug, Eq, PartialEq)]
enum SignalAction {
    Request,
    Exit,
}

/// Pure decision shared by the callback and its regression test.
fn signal_action(released: bool) -> SignalAction {
    if released {
        SignalAction::Exit
    } else {
        SignalAction::Request
    }
}

#[cfg(test)]
#[path = "_tests_/runtime_signal_tests.rs"]
mod runtime_signal_tests;
