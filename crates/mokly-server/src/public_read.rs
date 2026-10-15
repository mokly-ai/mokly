//! Read authored resources through directory handles without following symlinks.

use std::io::Read;
use std::path::{Component, Path, PathBuf};
use std::sync::Arc;

use cap_fs_ext::{DirExt, FollowSymlinks, OpenOptionsFollowExt};
use cap_std::ambient_authority;
use cap_std::fs::{Dir, OpenOptions};
use mokly_graph::policy::PublicPolicy;

use crate::assets::{File, content_type};
use crate::error::{Result, ServerError};

/// Read-time public eligibility and confinement boundary.
#[cfg_attr(test, unimock::unimock(api = PublicReaderMock))]
pub trait PublicReader: Send + Sync {
    /// Open a confined regular file without reading its contents.
    fn open(&self, path: &str) -> Option<OpenedFile>;
    /// Copy a confined preview asset only within the remaining store budget.
    fn read(&self, path: &str, remaining: usize) -> Result<Option<File>>;
}

/// An already confined handle streamed without reopening the authored path.
pub struct OpenedFile {
    /// Open file, owned by the response.
    pub file: std::fs::File,
    /// Byte length from the open handle.
    pub length: u64,
    /// MIME type derived from the public path.
    pub content_type: String,
}

/// Handle-relative reads recheck every directory and the final open file.
pub struct ConfinedReader {
    /// Canonical repository path resolved before listening.
    pub repo_root: PathBuf,
    /// Fresh per-request policy, with no retained eligibility decisions.
    pub policy: Arc<dyn PublicPolicy>,
}

impl PublicReader for ConfinedReader {
    fn open(&self, path: &str) -> Option<OpenedFile> {
        self.policy.recheck(path).ok()?;
        let mut directory = open_root(&self.repo_root)?;
        let mut parts = path.split('/').peekable();
        while let Some(part) = parts.next() {
            if matches!(part, "" | "." | "..") {
                return None;
            }
            if parts.peek().is_some() {
                directory = directory.open_dir_nofollow(part).ok()?;
                continue;
            }
            let mut options = OpenOptions::new();
            options.read(true).follow(FollowSymlinks::No);
            let file = directory.open_with(part, &options).ok()?;
            let metadata = file.metadata().ok()?;
            if !metadata.is_file() {
                return None;
            }
            return Some(OpenedFile {
                file: file.into_std(),
                length: metadata.len(),
                content_type: content_type(path),
            });
        }
        None
    }
    fn read(&self, path: &str, remaining: usize) -> Result<Option<File>> {
        let Some(opened) = self.open(path) else {
            return Ok(None);
        };
        if opened.length > remaining as u64 {
            return Err(ServerError::PreviewCapacity);
        }
        let mut bytes = Vec::new();
        if opened
            .file
            .take(remaining as u64 + 1)
            .read_to_end(&mut bytes)
            .is_err()
        {
            return Ok(None);
        }
        if bytes.len() > remaining {
            return Err(ServerError::PreviewCapacity);
        }
        Ok(Some(File {
            bytes,
            content_type: opened.content_type,
        }))
    }
}

fn open_root(root: &Path) -> Option<Dir> {
    let mut anchor = PathBuf::new();
    let mut names = Vec::new();
    for component in root.components() {
        match component {
            Component::Prefix(_) | Component::RootDir => anchor.push(component.as_os_str()),
            Component::Normal(name) => names.push(name),
            Component::CurDir | Component::ParentDir => return None,
        }
    }
    let mut directory = Dir::open_ambient_dir(anchor, ambient_authority()).ok()?;
    for name in names {
        directory = directory.open_dir_nofollow(name).ok()?;
    }
    Some(directory)
}
