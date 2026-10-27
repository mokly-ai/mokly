//! The Git listings and file reads behind the fingerprint.

use std::fs::{self, Metadata};
use std::io;
#[cfg(unix)]
use std::os::unix::ffi::OsStringExt;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};

use crate::child_environment::{GIT_REPOSITORY_VARIABLES, SECRET_VARIABLES};

use super::error::{Error, Result};

/// The type of one listed path, as `lstat` reports it.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum Entry {
    /// A regular file, and whether any executable permission bit is set.
    File {
        /// Whether any executable permission bit is set.
        executable: bool,
    },
    /// A symbolic link.
    Symlink,
    /// A directory.
    Directory,
    /// A socket, a FIFO, a device, or another type.
    Other,
}

/// The Git and file-system reads of one fingerprint.
#[cfg_attr(
    test,
    unimock::unimock(api = [
        TreeIndexMock,
        TreeUntrackedMock,
        TreeHeadMock,
        TreeEntryMock,
        TreeReadFileMock,
        TreeReadLinkMock
    ])
)]
pub(crate) trait TreeSystem: Send + Sync {
    /// The output of `git ls-files --stage -z` in `root`.
    fn index(&self, root: &Path) -> Result<Vec<u8>>;
    /// The output of `git ls-files -z --others --exclude-standard` in `root`.
    fn untracked(&self, root: &Path) -> Result<Vec<u8>>;
    /// The output of `git rev-parse HEAD` in `root`.
    fn head(&self, root: &Path) -> Result<Vec<u8>>;
    /// The `lstat` type of `path`, or none when the path or a component of
    /// it is missing or is not a directory.
    fn entry(&self, path: &Path) -> Result<Option<Entry>>;
    /// The bytes of a regular file.
    fn read_file(&self, path: &Path) -> Result<Vec<u8>>;
    /// The target bytes of a symbolic link.
    fn read_link(&self, path: &Path) -> Result<Vec<u8>>;
}

/// The Git and operating-system implementation.
pub(crate) struct SystemTree;

impl TreeSystem for SystemTree {
    fn index(&self, root: &Path) -> Result<Vec<u8>> {
        git(root, &["ls-files", "--stage", "-z"])
    }

    fn untracked(&self, root: &Path) -> Result<Vec<u8>> {
        git(root, &["ls-files", "-z", "--others", "--exclude-standard"])
    }

    fn head(&self, root: &Path) -> Result<Vec<u8>> {
        git(root, &["rev-parse", "HEAD"])
    }

    fn entry(&self, path: &Path) -> Result<Option<Entry>> {
        match fs::symlink_metadata(path) {
            Ok(metadata) => Ok(Some(entry(&metadata))),
            Err(error)
                if matches!(
                    error.kind(),
                    io::ErrorKind::NotFound | io::ErrorKind::NotADirectory
                ) =>
            {
                Ok(None)
            }
            Err(source) => Err(read_error(path, source)),
        }
    }

    fn read_file(&self, path: &Path) -> Result<Vec<u8>> {
        match fs::read(path) {
            Ok(bytes) => Ok(bytes),
            Err(source) => Err(read_error(path, source)),
        }
    }

    fn read_link(&self, path: &Path) -> Result<Vec<u8>> {
        match fs::read_link(path) {
            Ok(target) => Ok(link_bytes(target)),
            Err(source) => Err(read_error(path, source)),
        }
    }
}

fn entry(metadata: &Metadata) -> Entry {
    let kind = metadata.file_type();
    if kind.is_symlink() {
        Entry::Symlink
    } else if kind.is_file() {
        Entry::File {
            executable: executable(metadata),
        }
    } else if kind.is_dir() {
        Entry::Directory
    } else {
        Entry::Other
    }
}

#[cfg(unix)]
fn executable(metadata: &Metadata) -> bool {
    metadata.permissions().mode() & 0o111 != 0
}

#[cfg(not(unix))]
fn executable(_metadata: &Metadata) -> bool {
    false
}

#[cfg(unix)]
fn link_bytes(target: PathBuf) -> Vec<u8> {
    target.into_os_string().into_vec()
}

#[cfg(not(unix))]
fn link_bytes(target: PathBuf) -> Vec<u8> {
    target.to_string_lossy().into_owned().into_bytes()
}

fn read_error(path: &Path, source: io::Error) -> Error {
    Error::Read {
        path: path.display().to_string(),
        source,
    }
}

/// Run Git in `root` without the caller's repository and secret variables,
/// and require a successful exit.
fn git(root: &Path, args: &[&str]) -> Result<Vec<u8>> {
    let mut command = Command::new("git");
    command.args(args).current_dir(root);
    for name in GIT_REPOSITORY_VARIABLES.iter().chain(SECRET_VARIABLES) {
        command.env_remove(name);
    }
    let display = format!("git {}", args.join(" "));
    let output: Output = match command.output() {
        Ok(output) => output,
        Err(source) => {
            return Err(Error::GitStart {
                command: display,
                source,
            });
        }
    };
    if output.status.success() {
        Ok(output.stdout)
    } else {
        Err(Error::GitCommand {
            command: display,
            stderr: String::from_utf8_lossy(&output.stderr).trim().to_owned(),
        })
    }
}

#[cfg(all(test, unix))]
#[path = "_tests_/system_tests.rs"]
mod system_tests;
