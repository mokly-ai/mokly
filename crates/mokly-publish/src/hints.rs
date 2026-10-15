//! Identify local static output folders for actionable checkout ignore guidance.

use std::collections::{BTreeMap, BTreeSet};
use std::fs::{self, File};
use std::io::Read;
use std::path::Path;

use mokly_model::output::ownership::Ownership;
use mokly_model::output::validation::{FILE_LIMIT, MARKER};

/// Optional display guidance; failure to read a marker never replaces the dirty-checkout error.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = OutputHintsMock))]
pub trait OutputHints: Send + Sync {
    /// Identify output directories above the paths that the terminal will list.
    fn directories(&self, root: &Path, paths: &[String]) -> Vec<String>;
    /// Return only authenticated Mokly reservation namespaces found in status paths.
    fn reservations(&self, root: &Path, paths: &[String]) -> Vec<String>;
}

/// Read bounded regular ownership markers to identify custom build output folders.
pub struct SystemOutputHints;

impl OutputHints for SystemOutputHints {
    fn reservations(&self, root: &Path, paths: &[String]) -> Vec<String> {
        let mut checked = BTreeMap::new();
        for path in paths {
            let parts: Vec<_> = path.split('/').collect();
            for (index, segment) in parts.iter().enumerate() {
                if *segment != ".mokly-export-reservations" {
                    continue;
                }
                let directory = parts[..=index].join("/");
                checked
                    .entry(directory.clone())
                    .or_insert_with(|| reservation(&root.join(directory)));
            }
        }
        checked
            .into_iter()
            .filter_map(|(path, owned)| owned.then_some(path))
            .collect()
    }

    fn directories(&self, root: &Path, paths: &[String]) -> Vec<String> {
        let mut checked = BTreeMap::new();
        let mut directories = BTreeSet::from(["mokly-static".to_owned()]);
        for path in paths.iter().take(20) {
            for (index, _) in path.match_indices('/') {
                let directory = &path[..index];
                if *checked
                    .entry(directory.to_owned())
                    .or_insert_with(|| owned(&root.join(directory)))
                {
                    directories.insert(directory.to_owned());
                }
            }
        }
        directories.into_iter().collect()
    }
}

fn owned(directory: &Path) -> bool {
    let path = directory.join(MARKER);
    let Ok(metadata) = fs::symlink_metadata(&path) else {
        return false;
    };
    if !metadata.is_file() || metadata.len() > FILE_LIMIT as u64 {
        return false;
    }
    let Ok(file) = File::open(path) else {
        return false;
    };
    let mut bytes = Vec::new();
    file.take(FILE_LIMIT as u64 + 1)
        .read_to_end(&mut bytes)
        .is_ok()
        && Ownership::parse(&bytes).is_ok()
}

fn reservation(directory: &Path) -> bool {
    const OWNER: &[u8] = b"mokly-export-reservations-v1\n";
    let Ok(metadata) = fs::symlink_metadata(directory) else {
        return false;
    };
    if !metadata.is_dir() {
        return false;
    }
    let path = directory.join(".owner");
    let Ok(metadata) = fs::symlink_metadata(&path) else {
        return false;
    };
    if !metadata.is_file() || metadata.len() != OWNER.len() as u64 {
        return false;
    }
    let Ok(file) = File::open(path) else {
        return false;
    };
    let mut bytes = Vec::new();
    file.take(OWNER.len() as u64 + 1)
        .read_to_end(&mut bytes)
        .is_ok()
        && bytes == OWNER
}
