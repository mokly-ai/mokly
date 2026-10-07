//! Fresh run directories, streamed log files and bounded failure tails.

use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use crate::remote::contracts::{LogSink, Logs};
use crate::remote::error::{Error, Operation, Result};

/// Filesystem log factory rooted in the checkout.
pub(crate) struct SystemLogs {
    /// Workspace root.
    pub(crate) workspace: PathBuf,
}

impl Logs for SystemLogs {
    fn prepare(&self, run: &str) -> Result<()> {
        for relative in [
            ".context/verification-logs/remote",
            ".context/verification-reports/remote",
        ] {
            let parent = self.workspace.join(relative);
            io(fs::create_dir_all(&parent))?;
            io(fs::create_dir(parent.join(run)))?;
        }
        Ok(())
    }
    fn open(&self, path: &Path) -> Result<Arc<dyn LogSink + Send + Sync>> {
        let file = io(OpenOptions::new().create_new(true).write(true).open(path))?;
        Ok(Arc::new(FileSink {
            file: Mutex::new(file),
        }))
    }
    fn tail(&self, path: &Path) -> Result<String> {
        let text = io(fs::read_to_string(path))?;
        let lines: Vec<_> = text.lines().collect();
        Ok(lines[lines.len().saturating_sub(60)..].join("\n"))
    }
}

/// One synchronized resource returned by the log factory.
struct FileSink {
    /// Log file shared by stdout and stderr readers.
    file: Mutex<File>,
}

impl LogSink for FileSink {
    fn write(&self, bytes: &[u8]) -> Result<()> {
        let mut file = match self.file.lock() {
            Ok(file) => file,
            Err(_) => {
                return Err(Error::Poisoned {
                    operation: Operation::Logs,
                });
            }
        };
        io(file.write_all(bytes))?;
        io(file.flush())
    }
}

/// Preserve the original I/O error at this filesystem seam.
fn io<T>(result: std::io::Result<T>) -> Result<T> {
    match result {
        Ok(value) => Ok(value),
        Err(source) => Err(Error::Io {
            operation: Operation::Logs,
            source,
        }),
    }
}

#[cfg(test)]
#[path = "_tests_/logs_adapter_tests.rs"]
mod logs_adapter_tests;
