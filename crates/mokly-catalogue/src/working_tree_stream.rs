//! Open a captured physical identity through non-following directory handles.

use std::ffi::OsStr;
use std::fs::File;
use std::io;
use std::path::{Component, Path, PathBuf};

use cap_fs_ext::{DirExt, FollowSymlinks, OpenOptionsFollowExt};
use cap_std::ambient_authority;
#[cfg(unix)]
use cap_std::fs::OpenOptionsExt;
use cap_std::fs::{Dir, OpenOptions};
use mokly_source_interface::error::{Result, SourceError};
use mokly_source_interface::stream::{OpenedSource, SourceStream};

use crate::working_tree_read;

pub(crate) fn open(path: &Path) -> Result<Box<dyn SourceStream>> {
    match confined(path, "open resource stream")? {
        Some((file, length)) => Ok(Box::new(OpenedSource {
            reader: Box::new(file),
            length,
        })),
        None => Err(SourceError::Changed { path: path.into() }),
    }
}

pub(crate) fn digest(path: &Path) -> Result<String> {
    match confined(path, "hash opaque resource")? {
        Some((file, _)) => working_tree_read::digest_opened(path, file),
        None => Err(SourceError::Changed { path: path.into() }),
    }
}

fn confined(path: &Path, operation: &'static str) -> Result<Option<(File, u64)>> {
    let (directory, name) = match parent(path) {
        Ok(parent) => parent,
        Err(source) => return Err(failure(operation, path, source)),
    };
    let mut options = OpenOptions::new();
    options.read(true).follow(FollowSymlinks::No);
    #[cfg(unix)]
    options.custom_flags(libc::O_NONBLOCK);
    let file = match directory.open_with(name, &options) {
        Ok(file) => file,
        Err(source) => {
            let error = failure(operation, path, source);
            if !error.is_vanished()
                && !error.is_symlink_error()
                && directory
                    .symlink_metadata(name)
                    .is_ok_and(|metadata| !metadata.is_file())
            {
                return Ok(None);
            }
            return Err(error);
        }
    };
    let metadata = match file.metadata() {
        Ok(metadata) => metadata,
        Err(source) => return Err(failure(operation, path, source)),
    };
    if !metadata.is_file() {
        return Ok(None);
    }
    Ok(Some((file.into_std(), metadata.len())))
}

fn parent(path: &Path) -> io::Result<(Dir, &OsStr)> {
    let mut anchor = PathBuf::new();
    let mut names = Vec::new();
    for part in path.components() {
        match part {
            Component::Prefix(_) | Component::RootDir => anchor.push(part.as_os_str()),
            Component::Normal(name) => names.push(name),
            Component::CurDir | Component::ParentDir => {
                return Err(io::ErrorKind::InvalidInput.into());
            }
        }
    }
    if !anchor.is_absolute() {
        return Err(io::ErrorKind::InvalidInput.into());
    }
    let Some((file, directories)) = names.split_last() else {
        return Err(io::ErrorKind::InvalidInput.into());
    };
    let mut directory = Dir::open_ambient_dir(anchor, ambient_authority())?;
    for name in directories {
        directory = directory.open_dir_nofollow(name)?;
    }
    Ok((directory, file))
}

fn failure(operation: &'static str, path: &Path, source: io::Error) -> SourceError {
    SourceError::Io {
        operation,
        path: path.into(),
        source,
    }
}
