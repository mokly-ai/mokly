//! OS cache location and a process-scoped terminal announcement.

#[cfg(windows)]
use std::env;
#[cfg(windows)]
use std::ffi::OsString;
#[cfg(windows)]
use std::os::windows::ffi::OsStringExt;
#[cfg(windows)]
use std::path::{Component, Prefix};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use directories::BaseDirs;
use sha2::{Digest, Sha256};

use crate::cache_types::Reporter;
use crate::error::{Error, InternalError, IoResult, Result};

/// Operating-system cache-location boundary.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = LocationsMock))]
pub trait Locations: Send + Sync {
    /// Return the external cache root for the canonical repository identity.
    fn repository(&self, repository: &Path) -> Result<PathBuf>;
}

/// Host OS cache root. No cache directory is created by this lookup.
pub struct SystemLocations;

impl Locations for SystemLocations {
    fn repository(&self, repository: &Path) -> Result<PathBuf> {
        let repository = dunce::canonicalize(repository).base()?;
        let Some(base) = BaseDirs::new() else {
            return Err(Error::UnsafeCache { path: repository });
        };
        #[cfg(windows)]
        let local = env::var_os("LOCALAPPDATA").map(PathBuf::from);
        #[cfg(not(windows))]
        let local: Option<PathBuf> = None;
        let directory = project_cache_root(
            &cache_directory(base.cache_dir(), local.as_deref())
                .join("mokly")
                .join(repository_key(&repository)),
        )?;
        if inside_repository(&directory, &repository) {
            return Err(Error::UnsafeCache { path: directory });
        }
        Ok(directory)
    }
}

fn cache_directory<'a>(default: &'a Path, local: Option<&'a Path>) -> &'a Path {
    local.filter(|path| path.is_absolute()).unwrap_or(default)
}

#[cfg(windows)]
/// Convert supported Windows verbatim prefixes to their plain equivalents.
fn plain(path: &Path) -> PathBuf {
    let mut components = path.components();
    let Some(Component::Prefix(prefix)) = components.next() else {
        return path.to_owned();
    };
    let mut plain = match prefix.kind() {
        Prefix::VerbatimDisk(drive) => {
            PathBuf::from(OsString::from_wide(&[u16::from(drive), u16::from(b':')]))
        }
        Prefix::VerbatimUNC(server, share) => {
            let mut prefix = OsString::from(r"\\");
            prefix.push(server);
            prefix.push(r"\");
            prefix.push(share);
            PathBuf::from(prefix)
        }
        _ => return path.to_owned(),
    };
    for component in components {
        plain.push(component);
    }
    plain
}

#[cfg(not(windows))]
/// Keep non-Windows paths unchanged.
fn plain(path: &Path) -> PathBuf {
    path.to_owned()
}

/// Test cache containment after converting both paths to one prefix form.
fn inside_repository(directory: &Path, repository: &Path) -> bool {
    plain(directory).starts_with(plain(repository))
}

/// Stable key of a canonical repository path, including its exact OS spelling.
pub fn repository_key(repository: &Path) -> String {
    Sha256::digest(repository.as_os_str().as_encoded_bytes())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// Exact stdout line for the CLI's plain reporter.
pub fn plain_line(directory: &Path) -> String {
    format!("Mokly cache: {}\n", directory.display())
}

/// Reporter decorator shared once at the CLI composition root.
pub struct OnceReporter {
    /// Actual terminal reporter.
    pub reporter: Arc<dyn Reporter>,
    /// Process-scoped announcement state.
    pub announced: AtomicBool,
}

impl Reporter for OnceReporter {
    fn opened(&self, directory: &Path) {
        if !self.announced.swap(true, Ordering::AcqRel) {
            self.reporter.opened(directory);
        }
    }
}

/// Canonical paths keep Windows' plain drive form when it can name the
/// location. npm and Node do not treat `\\?\C:\` and `C:\` as one root, so a
/// verbatim cache path breaks base installs and module resolution.
fn project_cache_root(path: &Path) -> Result<PathBuf> {
    match dunce::canonicalize(path) {
        Ok(path) => Ok(path),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            let (Some(parent), Some(name)) = (path.parent(), path.file_name()) else {
                return Err(Error::UnsafeCache {
                    path: path.to_owned(),
                });
            };
            Ok(project_cache_root(parent)?.join(name))
        }
        Err(source) => Err(InternalError::Io { source }.into()),
    }
}

#[cfg(test)]
#[path = "_tests_/locations_tests.rs"]
mod locations_tests;
