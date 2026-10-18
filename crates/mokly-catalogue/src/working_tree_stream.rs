//! Open a captured physical identity through non-following directory handles.

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
    match confined(path) {
        Ok((file, length)) => Ok(Box::new(OpenedSource {
            reader: Box::new(file),
            length,
        })),
        Err(source) => Err(SourceError::Io {
            operation: "open resource stream",
            path: path.into(),
            source,
        }),
    }
}

pub(crate) fn digest(path: &Path) -> Result<String> {
    match confined(path) {
        Ok((file, _)) => working_tree_read::digest_opened(path, file),
        Err(source) => Err(SourceError::Io {
            operation: "hash opaque resource",
            path: path.into(),
            source,
        }),
    }
}

fn confined(path: &Path) -> io::Result<(File, u64)> {
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
    let mut options = OpenOptions::new();
    options.read(true).follow(FollowSymlinks::No);
    #[cfg(unix)]
    options.custom_flags(libc::O_NONBLOCK);
    let file = directory.open_with(file, &options)?;
    let metadata = file.metadata()?;
    if !metadata.is_file() {
        return Err(io::ErrorKind::InvalidInput.into());
    }
    Ok((file.into_std(), metadata.len()))
}
