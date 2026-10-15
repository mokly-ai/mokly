//! Read authored resources through directory handles without following symlinks.

use std::io::Read;
use std::path::{Component, Path, PathBuf};
use std::sync::Arc;

use cap_fs_ext::{DirExt, FollowSymlinks, OpenOptionsFollowExt};
use cap_std::ambient_authority;
use cap_std::fs::{Dir, OpenOptions};
use mokly_graph::policy::PublicPolicy;

use crate::assets::{File, content_type};

/// Read-time public eligibility and confinement boundary.
#[cfg_attr(test, unimock::unimock(api = PublicReaderMock))]
pub trait PublicReader: Send + Sync {
    /// Return only a confined regular file; every denial is not found.
    fn read(&self, path: &str) -> Option<File>;
}

/// Handle-relative reads recheck every directory and the final open file.
pub struct ConfinedReader {
    /// Canonical repository path resolved before listening.
    pub repo_root: PathBuf,
    /// Fresh per-request policy, with no retained eligibility decisions.
    pub policy: Arc<dyn PublicPolicy>,
}

impl PublicReader for ConfinedReader {
    fn read(&self, path: &str) -> Option<File> {
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
            let mut file = directory.open_with(part, &options).ok()?;
            if !file.metadata().ok()?.is_file() {
                return None;
            }
            let mut bytes = Vec::new();
            file.read_to_end(&mut bytes).ok()?;
            return Some(File {
                bytes,
                content_type: content_type(path),
            });
        }
        None
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
