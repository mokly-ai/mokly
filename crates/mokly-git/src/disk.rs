//! Host path projection and safe extraction of an immutable source archive.

use std::fs;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};

use crate::error::{Error, IoResult, Result};
use crate::identity::RepoPath;

/// One regular file in a bounded source archive.
#[derive(Debug)]
pub struct ArchiveFile {
    /// Confined repository-relative path.
    pub path: RepoPath,
    /// Exact unconverted blob bytes.
    pub bytes: Vec<u8>,
    /// Whether Git marks the source executable.
    pub executable: bool,
}

/// Filesystem boundary for repository identity and archive publication.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = DiskMock))]
pub trait Disk: Send + Sync {
    /// Resolve the filesystem identity of an existing directory.
    fn canonicalize(&self, path: &Path) -> Result<PathBuf>;
    /// Create a fresh directory and extract regular blobs without following links.
    fn extract(&self, destination: &Path, files: &[ArchiveFile]) -> Result<()>;
}

/// Host extraction adapter. A failed extraction removes its fresh directory.
pub struct SystemDisk;

impl Disk for SystemDisk {
    fn canonicalize(&self, path: &Path) -> Result<PathBuf> {
        fs::canonicalize(path).git()
    }

    fn extract(&self, destination: &Path, files: &[ArchiveFile]) -> Result<()> {
        fs::create_dir(destination).git()?;
        let result = write_files(destination, files);
        if result.is_err() {
            let _ = fs::remove_dir_all(destination);
        }
        result
    }
}

fn write_files(destination: &Path, files: &[ArchiveFile]) -> Result<()> {
    for file in files {
        if file
            .path
            .as_str()
            .split('/')
            .any(|part| part.eq_ignore_ascii_case(".git"))
        {
            return Err(Error::InvalidPath {
                path: file.path.as_str().to_owned(),
            });
        }
        let path = destination.join(file.path.as_str());
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).git()?;
        }
        let mut output = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&path)
            .git()?;
        if !output.metadata().git()?.is_file() {
            return Err(Error::NotRegular {
                path: file.path.as_str().to_owned(),
            });
        }
        use_write(&mut output, &file.bytes)?;
        #[cfg(unix)]
        fs::set_permissions(
            &path,
            fs::Permissions::from_mode(if file.executable { 0o755 } else { 0o644 }),
        )
        .git()?;
    }
    Ok(())
}

fn use_write(output: &mut dyn std::io::Write, bytes: &[u8]) -> Result<()> {
    output.write_all(bytes).git()
}
