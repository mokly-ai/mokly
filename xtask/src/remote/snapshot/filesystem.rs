//! Exclusive filesystem reservations for snapshot directories and indexes.

use std::fs::{self, OpenOptions};
use std::io::{self, ErrorKind};
use std::path::Path;

use crate::remote::error::{Error, Operation, Result};
use crate::remote::snapshot::contracts::SnapshotFiles;

/// Operating-system ownership adapter constructed at the CLI composition root.
pub(crate) struct SystemSnapshotFiles;

impl SnapshotFiles for SystemSnapshotFiles {
    fn parent(&self, workspace: &Path) -> Result<()> {
        io(fs::create_dir_all(
            workspace.join(".context/verification-snapshots"),
        ))
    }

    fn absent(&self, path: &Path) -> Result<()> {
        match fs::symlink_metadata(path) {
            Ok(_) => Err(Error::SnapshotExists {
                path: path.to_owned(),
            }),
            Err(source) if source.kind() == ErrorKind::NotFound => Ok(()),
            Err(source) => Err(Error::Io {
                operation: Operation::Snapshot,
                source,
            }),
        }
    }

    fn directory(&self, path: &Path) -> Result<()> {
        reserve(fs::create_dir(path), path)
    }

    fn index(&self, path: &Path) -> Result<()> {
        reserve(
            OpenOptions::new().write(true).create_new(true).open(path),
            path,
        )?;
        Ok(())
    }

    fn remove_directory(&self, path: &Path) -> Result<()> {
        remove(fs::remove_dir_all(path))
    }

    fn remove_index(&self, path: &Path) -> Result<()> {
        remove(fs::remove_file(path))
    }
}

/// Distinguish an existing path from other operating-system failures.
fn reserve<T>(result: io::Result<T>, path: &Path) -> Result<T> {
    match result {
        Ok(value) => Ok(value),
        Err(source) if source.kind() == ErrorKind::AlreadyExists => Err(Error::SnapshotExists {
            path: path.to_owned(),
        }),
        Err(source) => Err(Error::Io {
            operation: Operation::Snapshot,
            source,
        }),
    }
}

/// Absence after removal is already a successful ownership release.
fn remove(result: io::Result<()>) -> Result<()> {
    match result {
        Err(source) if source.kind() == ErrorKind::NotFound => Ok(()),
        result => io(result),
    }
}

/// Preserve the original operating-system cause without string conversion.
fn io<T>(result: io::Result<T>) -> Result<T> {
    match result {
        Ok(value) => Ok(value),
        Err(source) => Err(Error::Io {
            operation: Operation::Snapshot,
            source,
        }),
    }
}
