//! Debug-only rename failures exercise the actual CLI recovery reporter.

use std::io;
use std::path::Path;
use std::sync::Arc;

use mokly_platform::error::{Error, Result};
use mokly_platform::rename::Rename;

use super::Faults;

pub(super) struct Injected {
    pub(super) inner: Arc<dyn Rename>,
    pub(super) faults: Faults,
}
impl Rename for Injected {
    fn exclusive(&self, source: &Path, destination: &Path) -> Result<()> {
        let name = source
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("");
        let step = match name {
            "stage" => "install",
            "backup" => "restore",
            _ => "capture",
        };
        self.faults.event(step);
        if self.faults.has(step) {
            return Err(Error::io(io::Error::other(format!(
                "injected {step} failure"
            ))));
        }
        self.inner.exclusive(source, destination)?;
        if step == "capture" {
            let _ = self.faults.gate("capture-signal");
        }
        Ok(())
    }
}
