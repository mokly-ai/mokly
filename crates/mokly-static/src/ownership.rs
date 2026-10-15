//! Existing-output validation and bounded disposal of a captured backup.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use mokly_model::output::ownership::Ownership;
use mokly_model::output::validation::{FILE_LIMIT, MARKER};

use crate::error::{Error, Result};
use crate::filesystem::{Entry, Files, Identity};

/// Exact list checked on the actual directory, never derived as deletion authority alone.
#[derive(Clone, Debug)]
pub(crate) struct Owned {
    pub(crate) identity: Identity,
    pub(crate) files: Vec<PathBuf>,
    pub(crate) directories: Vec<PathBuf>,
    pub(crate) marker: bool,
}

pub(crate) fn validate(files: &dyn Files, root: &Path) -> Result<Option<Owned>> {
    let identity = match files.entry(root)? {
        None => return Ok(None),
        Some(Entry::Directory(identity)) => identity,
        Some(_) => return Err(Error::Unexpected { path: root.into() }),
    };
    let children = files.children(root)?;
    let marker = root.join(MARKER);
    let owned = match files.entry(&marker)? {
        None if children.is_empty() => {
            return Ok(Some(Owned {
                identity,
                files: Vec::new(),
                directories: Vec::new(),
                marker: false,
            }));
        }
        None => {
            return Err(Error::Unowned {
                path: root.into(),
                entries: names(root, &children),
            });
        }
        Some(Entry::File(size)) if size <= FILE_LIMIT as u64 => {
            match Ownership::parse(&files.read(&marker, FILE_LIMIT)?) {
                Ok(owned) => owned,
                Err(_) => return Err(Error::Ownership { path: root.into() }),
            }
        }
        Some(Entry::File(_)) => return Err(Error::Ownership { path: root.into() }),
        Some(_) => return Err(Error::Unexpected { path: marker }),
    };
    let allowed: BTreeSet<_> = owned
        .files
        .iter()
        .map(|entry| root.join(&entry.path))
        .collect();
    let mut directories = BTreeSet::new();
    for path in &allowed {
        let mut cursor = path.parent();
        while let Some(parent) = cursor.filter(|parent| *parent != root) {
            directories.insert(parent.to_owned());
            cursor = parent.parent();
        }
    }
    let mut validated = Owned {
        identity,
        files: Vec::new(),
        directories: Vec::new(),
        marker: true,
    };
    let mut pending = children;
    let mut unexpected = Vec::new();
    while let Some(path) = pending.pop() {
        match files.entry(&path)? {
            Some(Entry::File(_)) if path == marker => {}
            Some(Entry::File(_)) if allowed.contains(&path) => validated.files.push(path),
            Some(Entry::Directory(_)) if directories.contains(&path) => {
                pending.extend(files.children(&path)?);
                validated.directories.push(path);
            }
            _ => unexpected.push(path),
        }
    }
    if !unexpected.is_empty() {
        return Err(Error::UnexpectedEntries {
            path: root.into(),
            entries: names(root, &unexpected),
        });
    }
    Ok(Some(validated))
}

pub(crate) fn dispose(files: &dyn Files, root: &Path, mut owned: Owned) -> Result<()> {
    for path in owned.files {
        if !matches!(files.entry(&path)?, Some(Entry::File(_))) {
            return Err(Error::Unexpected { path });
        }
        files.unlink(&path)?;
    }
    owned
        .directories
        .sort_by_key(|path| std::cmp::Reverse(path.components().count()));
    for path in owned.directories {
        files.rmdir(&path)?;
    }
    if owned.marker {
        files.unlink(&root.join(MARKER))?;
    }
    files.rmdir(root)
}

fn names(root: &Path, paths: &[PathBuf]) -> Vec<String> {
    let mut names: Vec<_> = paths
        .iter()
        .map(|path| {
            path.strip_prefix(root)
                .unwrap_or(path)
                .to_string_lossy()
                .replace('\\', "/")
        })
        .collect();
    names.sort_by(|a, b| a.encode_utf16().cmp(b.encode_utf16()));
    names.dedup();
    names
}
