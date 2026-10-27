//! The fingerprint of one working tree: the Git listings, the
//! leading-directory checks, and one record for each regular file and
//! symbolic link.

use std::collections::{HashMap, HashSet};
#[cfg(unix)]
use std::ffi::OsStr;
#[cfg(unix)]
use std::os::unix::ffi::OsStrExt;
use std::path::{Path, PathBuf};

use super::error::{Error, Result};
use super::records::{Mode, Record, SourceFingerprint, fingerprint_records, source_paths};
use super::system::{Entry, TreeSystem};

/// The index mode of a submodule entry.
const SUBMODULE: &[u8] = b"160000";

/// Read the tracked and non-ignored working tree below `root`.
pub(crate) fn read_source_tree(system: &dyn TreeSystem, root: &Path) -> Result<SourceFingerprint> {
    let index = source_paths(&system.index(root)?);
    if index.iter().any(|entry| entry.starts_with(SUBMODULE)) {
        return Err(Error::Submodule);
    }
    let tracked: Vec<&[u8]> = index.iter().map(|entry| index_path(entry)).collect();
    let cached: HashSet<&[u8]> = tracked.iter().copied().collect();
    let mut listing = Vec::new();
    for name in &tracked {
        listing.extend_from_slice(name);
        listing.push(0);
    }
    listing.extend_from_slice(&system.untracked(root)?);
    let mut directories = HashMap::new();
    let mut records = Vec::new();
    for name in source_paths(&listing) {
        if !leading_directories(system, root, &name, &mut directories)? {
            continue;
        }
        let file = tree_path(root, &name)?;
        let Some(entry) = system.entry(&file)? else {
            continue;
        };
        let (mode, contents) = match entry {
            Entry::Symlink => (Mode::Symlink, system.read_link(&file)?),
            Entry::File { executable: true } => (Mode::Executable, system.read_file(&file)?),
            Entry::File { executable: false } => (Mode::Regular, system.read_file(&file)?),
            Entry::Directory
                if cached.contains(name.as_slice())
                    && system.entry(&file.join(".git"))?.is_none() =>
            {
                continue;
            }
            Entry::Directory | Entry::Other => {
                return Err(Error::UnsupportedType {
                    path: String::from_utf8_lossy(&name).into_owned(),
                });
            }
        };
        records.push(Record::new(mode, name, &contents));
    }
    Ok(fingerprint_records(&records))
}

/// The path bytes after the tab of one `git ls-files --stage` entry.
fn index_path(entry: &[u8]) -> &[u8] {
    entry
        .iter()
        .position(|byte| *byte == b'\t')
        .map_or(entry, |tab| &entry[tab + 1..])
}

/// Whether every leading component of `name` is a real directory. A Git
/// path below a symbolic link, a file, or a missing component is a deletion.
fn leading_directories(
    system: &dyn TreeSystem,
    root: &Path,
    name: &[u8],
    cache: &mut HashMap<Vec<u8>, bool>,
) -> Result<bool> {
    for (slash, _) in name.iter().enumerate().filter(|(_, byte)| **byte == b'/') {
        if slash + 1 == name.len() {
            break;
        }
        let directory = &name[..slash];
        let allowed = match cache.get(directory) {
            Some(allowed) => *allowed,
            None => {
                let allowed = system.entry(&tree_path(root, directory)?)? == Some(Entry::Directory);
                cache.insert(directory.to_vec(), allowed);
                allowed
            }
        };
        if !allowed {
            return Ok(false);
        }
    }
    Ok(true)
}

/// The path of a repository-relative Git name below `root`.
#[cfg(unix)]
fn tree_path(root: &Path, name: &[u8]) -> Result<PathBuf> {
    Ok(root.join(OsStr::from_bytes(name)))
}

/// The path of a repository-relative Git name below `root`.
#[cfg(not(unix))]
fn tree_path(root: &Path, name: &[u8]) -> Result<PathBuf> {
    match std::str::from_utf8(name) {
        Ok(name) => Ok(root.join(name)),
        Err(_) => Err(Error::PathEncoding {
            path: String::from_utf8_lossy(name).into_owned(),
        }),
    }
}

#[cfg(test)]
#[path = "_tests_/scan_tests.rs"]
mod scan_tests;
