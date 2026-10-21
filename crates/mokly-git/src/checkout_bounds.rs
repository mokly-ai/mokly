//! Size and diagnostic guards for checkout conversion commands.

use std::fs;
use std::path::{Path, PathBuf};

use crate::command;

pub(crate) struct SizeBound {
    pub(crate) root: PathBuf,
    pub(crate) limit: usize,
}

impl command::Cancellation for SizeBound {
    fn is_cancelled(&self) -> bool {
        directory_bytes(&self.root, self.limit).is_some_and(|bytes| bytes > self.limit)
    }
}

impl SizeBound {
    pub(crate) fn exceeded(&self) -> bool {
        command::Cancellation::is_cancelled(self)
    }
}

pub(crate) fn filter_failed(stderr: &[u8]) -> bool {
    let stderr = String::from_utf8_lossy(stderr).to_ascii_lowercase();
    stderr.contains("external filter") && stderr.contains("failed")
}

fn directory_bytes(root: &Path, limit: usize) -> Option<usize> {
    let mut pending = vec![root.to_path_buf()];
    let mut total = 0usize;
    while let Some(path) = pending.pop() {
        let entries = fs::read_dir(path).ok()?;
        for entry in entries.flatten() {
            let metadata = entry.metadata().ok()?;
            if metadata.is_dir() {
                pending.push(entry.path());
            } else if metadata.is_file() {
                total = total.saturating_add(usize::try_from(metadata.len()).ok()?);
                if total > limit {
                    return Some(total);
                }
            }
        }
    }
    Some(total)
}
