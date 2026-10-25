//! Shared parent-side Node selection for probes and rendering.

use std::env;
use std::fs;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};

use crate::error::{Error, IoResult, Result};

/// Resolve the operator's Node without searching relative PATH entries.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = NodeExecutableMock))]
pub trait NodeExecutable: Send + Sync {
    /// Return a parent-resolved executable, before changing child directories.
    fn resolve(&self) -> Result<PathBuf>;
}

/// Host executable resolution shared by the CLI and install process adapter.
pub struct SystemNodeExecutable;

impl NodeExecutable for SystemNodeExecutable {
    fn resolve(&self) -> Result<PathBuf> {
        let supplied = env::var_os("MOKLY_NODE_EXECUTABLE");
        let name = supplied.as_deref().unwrap_or_else(|| "node".as_ref());
        let candidate = Path::new(name);
        if candidate.is_absolute() || candidate.components().count() > 1 {
            let candidate = if candidate.is_absolute() {
                candidate.to_owned()
            } else {
                env::current_dir().base()?.join(candidate)
            };
            return if executable(&candidate) {
                Ok(candidate)
            } else {
                Err(Error::CommandUnavailable)
            };
        }
        let path = env::var_os("PATH").unwrap_or_default();
        env::split_paths(&path)
            .filter(|directory| directory.is_absolute())
            .map(|directory| {
                let candidate = directory.join(name);
                #[cfg(windows)]
                let candidate = if candidate.extension().is_none() {
                    candidate.with_extension("exe")
                } else {
                    candidate
                };
                candidate
            })
            .find(|candidate| executable(candidate))
            .ok_or(Error::CommandUnavailable)
    }
}

fn executable(path: &Path) -> bool {
    fs::metadata(path).is_ok_and(|metadata| {
        #[cfg(unix)]
        if metadata.permissions().mode() & 0o111 == 0 {
            return false;
        }
        metadata.is_file()
    })
}
