//! Lossless NUL-delimited Git status and rename records.

use crate::error::{Error, Result};
use crate::tree::text;

/// A Git candidate path. It confers no permission to read a source file.
#[derive(Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
pub struct ChangedPath(String);

impl ChangedPath {
    /// Preserve exact UTF-8 Git spelling, including nonportable filename characters.
    pub fn parse(value: &str) -> Result<Self> {
        if value.is_empty()
            || value.contains('\0')
            || value.split('/').any(|part| matches!(part, "" | "." | ".."))
        {
            return Err(Error::InvalidPath {
                path: value.to_owned(),
            });
        }
        Ok(Self(value.to_owned()))
    }

    /// Repository-relative spelling reported by Git.
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// A tracked diff or an untracked working-tree addition.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Change {
    /// Current path, or the former path for a deletion.
    pub path: ChangedPath,
    /// Git's status, including the original path for a rename.
    pub kind: Kind,
}

/// Git status without inferring moves from untracked files.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Kind {
    /// New tracked or untracked file.
    Added,
    /// Removed tracked file.
    Deleted,
    /// Modified bytes or file mode.
    Modified,
    /// Changed file type.
    TypeChanged,
    /// Unmerged index entry.
    Unmerged,
    /// Rename detected by Git itself.
    Renamed {
        /// Path in the base commit.
        from: ChangedPath,
        /// Git similarity percentage.
        similarity: u8,
    },
}

pub(crate) fn parse(bytes: &[u8]) -> Result<Vec<Change>> {
    let mut fields = fields(bytes)?;
    let mut result = Vec::new();
    while let Some(status) = fields.next() {
        let Some(path) = fields.next() else {
            return Err(Error::MalformedOutput);
        };
        let path = ChangedPath::parse(text(path)?)?;
        let kind = match status {
            b"A" => Kind::Added,
            b"D" => Kind::Deleted,
            b"M" => Kind::Modified,
            b"T" => Kind::TypeChanged,
            b"U" => Kind::Unmerged,
            value if value.starts_with(b"R") => {
                let similarity = match text(&value[1..])?.parse::<u8>() {
                    Ok(value) if value <= 100 => value,
                    _ => return Err(Error::MalformedOutput),
                };
                let Some(next) = fields.next() else {
                    return Err(Error::MalformedOutput);
                };
                result.push(Change {
                    path: ChangedPath::parse(text(next)?)?,
                    kind: Kind::Renamed {
                        from: path,
                        similarity,
                    },
                });
                continue;
            }
            _ => return Err(Error::MalformedOutput),
        };
        result.push(Change { path, kind });
    }
    Ok(result)
}

pub(crate) fn fields(bytes: &[u8]) -> Result<impl Iterator<Item = &[u8]>> {
    if !bytes.is_empty() && bytes.last() != Some(&0) {
        return Err(Error::MalformedOutput);
    }
    Ok(bytes
        .split_inclusive(|byte| *byte == 0)
        .map(|record| &record[..record.len() - 1]))
}
