//! Cache-aware Linux process memory-controller limits.

use std::path::Path;
use std::sync::Arc;

use crate::cgroup_discovery::{Controller, discover};
use crate::cgroup_level::headroom;
use crate::host_memory::MemoryLimits;

/// A controller file's contents or its distinct absence and access failure.
#[derive(Clone)]
pub enum MemoryFile {
    /// The file was read completely.
    Text(String),
    /// The kernel exposes no file at this path.
    Missing,
    /// An existing or applicable file could not be read.
    Unreadable,
}

impl MemoryFile {
    pub(crate) fn text(self) -> Option<String> {
        match self {
            Self::Text(text) => Some(text),
            _ => None,
        }
    }
}

/// Text reads used to discover and sample the process memory controller.
#[cfg_attr(test, unimock::unimock(api = MemoryFilesMock))]
pub trait MemoryFiles: Send + Sync {
    /// Read a complete controller or proc file, or report unavailable data.
    fn read(&self, path: &Path) -> MemoryFile;
}

/// Native proc and cgroup filesystem adapter.
pub struct SystemMemoryFiles;

impl MemoryFiles for SystemMemoryFiles {
    fn read(&self, path: &Path) -> MemoryFile {
        match std::fs::read_to_string(path) {
            Ok(text) => MemoryFile::Text(text),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => MemoryFile::Missing,
            Err(_) => MemoryFile::Unreadable,
        }
    }
}

/// Limits of the command's memory cgroup and its visible ancestors.
pub struct CgroupMemory {
    files: Arc<dyn MemoryFiles>,
}

impl CgroupMemory {
    /// Inject proc membership, mounts, and controller file reads.
    pub fn new(files: Arc<dyn MemoryFiles>) -> Self {
        Self { files }
    }
}

impl MemoryLimits for CgroupMemory {
    fn headroom_bytes(&self, host: u64) -> Option<u64> {
        let Some(location) = discover(self.files.as_ref())? else {
            return Some(host);
        };
        if location.controller == Controller::V2 {
            let controllers = self
                .files
                .read(&location.mount.join("cgroup.controllers"))
                .text()?;
            if !controllers.split_whitespace().any(|name| name == "memory") {
                return Some(host);
            }
        }
        let mut available = host;
        for path in location.base.ancestors() {
            if let Some(level) = headroom(
                self.files.as_ref(),
                path,
                location.controller,
                path == location.mount,
                path != location.base,
            )? {
                available = available.min(level);
            }
            if path == location.mount {
                return Some(available);
            }
        }
        None
    }
}

#[cfg(test)]
#[path = "_tests_/cgroup_memory_tests.rs"]
mod cgroup_memory_tests;
