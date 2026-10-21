//! Confined working reads and incremental immutable-source extraction.

use std::fs;
use std::io::{Read, Write};
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};

use crate::error::{Error, InternalError, IoResult, Result};
use crate::identity::RepoPath;

/// An owned fresh extraction, removed on failure until `finish` succeeds.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ArchiveMock))]
pub trait Archive: Send + Sync {
    /// Open a new regular blob sink; unsupported host paths return none.
    fn file(&mut self, path: &RepoPath, executable: bool) -> Result<Option<Box<dyn Write + Send>>>;
    /// Keep the complete extraction.
    fn finish(&mut self) -> Result<()>;
}

/// Filesystem boundary for checkout identity and source access.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = DiskMock))]
pub trait Disk: Send + Sync {
    /// Resolve an existing directory's identity.
    fn canonicalize(&self, path: &Path) -> Result<PathBuf>;
    /// Read a confined regular working file; a vanished candidate returns none.
    fn read(&self, root: &Path, path: &RepoPath, limit: usize) -> Result<Option<Vec<u8>>>;
    /// Start incremental extraction in a fresh directory.
    fn archive(&self, destination: &Path) -> Result<Box<dyn Archive>>;
}

/// Host source IO adapter.
pub struct SystemDisk;

struct Extraction {
    destination: PathBuf,
    complete: bool,
}

impl Disk for SystemDisk {
    fn canonicalize(&self, path: &Path) -> Result<PathBuf> {
        fs::canonicalize(path).git()
    }

    fn read(&self, root: &Path, path: &RepoPath, limit: usize) -> Result<Option<Vec<u8>>> {
        if !host_path(path) {
            tracing::trace!(path = %path, "skipping a name unsupported by the host");
            return Ok(None);
        }
        let file = root.join(path.as_str());
        for ancestor in file.ancestors().take_while(|ancestor| *ancestor != root) {
            let metadata = match fs::symlink_metadata(ancestor) {
                Ok(metadata) => metadata,
                Err(error)
                    if matches!(
                        error.kind(),
                        std::io::ErrorKind::NotFound | std::io::ErrorKind::NotADirectory
                    ) =>
                {
                    return Ok(None);
                }
                Err(source) => return Err(InternalError::Io { source }.into()),
            };
            if metadata.is_symlink() {
                return Err(Error::NotRegular {
                    path: path.to_string(),
                });
            }
        }
        let metadata = fs::metadata(&file).git()?;
        if !metadata.is_file() {
            return Err(Error::NotRegular {
                path: path.to_string(),
            });
        }
        if metadata.len() > limit as u64 {
            return Err(Error::ByteLimit { limit });
        }
        let mut bytes = Vec::new();
        fs::File::open(file)
            .git()?
            .take(limit.saturating_add(1) as u64)
            .read_to_end(&mut bytes)
            .git()?;
        if bytes.len() > limit {
            return Err(Error::ByteLimit { limit });
        }
        Ok(Some(bytes))
    }

    fn archive(&self, destination: &Path) -> Result<Box<dyn Archive>> {
        fs::create_dir(destination).git()?;
        Ok(Box::new(Extraction {
            destination: destination.to_owned(),
            complete: false,
        }))
    }
}

impl Archive for Extraction {
    fn file(&mut self, path: &RepoPath, executable: bool) -> Result<Option<Box<dyn Write + Send>>> {
        if path
            .as_str()
            .split('/')
            .any(|part| part.eq_ignore_ascii_case(".git"))
        {
            return Err(Error::InvalidPath {
                path: path.to_string(),
            });
        }
        if !host_path(path) {
            tracing::trace!(%path, "skipping a name unsupported by the host");
            return Ok(None);
        }
        let path = self.destination.join(path.as_str());
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).git()?;
        }
        let output = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&path)
            .git()?;
        #[cfg(unix)]
        output
            .set_permissions(fs::Permissions::from_mode(if executable {
                0o755
            } else {
                0o644
            }))
            .git()?;
        #[cfg(not(unix))]
        let _ = executable;
        Ok(Some(Box::new(output)))
    }

    fn finish(&mut self) -> Result<()> {
        self.complete = true;
        Ok(())
    }
}

impl Drop for Extraction {
    fn drop(&mut self) {
        if !self.complete {
            let _ = fs::remove_dir_all(&self.destination);
        }
    }
}

fn host_path(path: &RepoPath) -> bool {
    #[cfg(windows)]
    return path.as_str().split('/').all(|part| {
        let stem = part.split('.').next().unwrap_or("").to_ascii_lowercase();
        !part.contains([':', '\\', '<', '>', '"', '|', '?', '*'])
            && !part.ends_with(['.', ' '])
            && !part.chars().any(char::is_control)
            && !matches!(stem.as_str(), "con" | "prn" | "aux" | "nul")
            && !(stem.len() == 4
                && (stem.starts_with("com") || stem.starts_with("lpt"))
                && matches!(stem.as_bytes()[3], b'1'..=b'9'))
    });
    #[cfg(not(windows))]
    {
        let _ = path;
        true
    }
}
