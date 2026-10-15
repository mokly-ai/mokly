//! Confined working-tree reads of dependency manifests and lockfiles.

use std::collections::BTreeMap;
use std::fs;
use std::io::Read;
use std::path::Path;

use mokly_git::identity::RepoPath;
use mokly_git::tree::Limits;

use crate::error::{Error, GitResult, IoResult, Result};
use crate::inputs::{Inputs, excluded, selected};

/// Working-side dependency inventory boundary.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = WorkingInputsMock))]
pub trait WorkingInputs: Send + Sync {
    /// Read the complete confined dependency input set.
    fn read(&self, repository: &Path, limits: Limits) -> Result<Inputs>;
}

/// Host adapter. Symlinked dependency inputs are rejected rather than followed.
pub struct SystemWorkingInputs;

impl WorkingInputs for SystemWorkingInputs {
    fn read(&self, repository: &Path, limits: Limits) -> Result<Inputs> {
        let repository = fs::canonicalize(repository).base()?;
        let mut files = BTreeMap::new();
        let mut pending = vec![repository.clone()];
        let mut total = 0usize;
        while let Some(directory) = pending.pop() {
            for item in fs::read_dir(directory).base()? {
                let item = item.base()?;
                let path = item.path();
                let relative = match path.strip_prefix(&repository) {
                    Ok(path) => path,
                    Err(_) => return Err(Error::UnsafeCache { path }),
                };
                let relative = match relative
                    .iter()
                    .map(|part| part.to_str())
                    .collect::<Option<Vec<_>>>()
                {
                    Some(parts) => parts.join("/"),
                    None => {
                        return Err(Error::InvalidInput {
                            path: relative.to_string_lossy().into_owned(),
                        });
                    }
                };
                if excluded(&relative) {
                    continue;
                }
                let metadata = fs::symlink_metadata(&path).base()?;
                if metadata.is_dir() {
                    pending.push(path);
                    continue;
                }
                if !selected(&relative) {
                    continue;
                }
                if !metadata.is_file() {
                    return Err(Error::InvalidInput { path: relative });
                }
                if files.len() >= limits.files {
                    return Err(Error::InvalidInput { path: relative });
                }
                if metadata.len() > limits.blob as u64 {
                    return Err(Error::CacheLimit {
                        limit: limits.blob as u64,
                    });
                }
                let mut bytes = Vec::new();
                fs::File::open(&path)
                    .base()?
                    .take((limits.blob as u64).saturating_add(1))
                    .read_to_end(&mut bytes)
                    .base()?;
                total = total.saturating_add(bytes.len());
                if total > limits.bytes || bytes.len() > limits.blob {
                    return Err(Error::CacheLimit {
                        limit: limits.bytes as u64,
                    });
                }
                files.insert(RepoPath::parse(&relative).base()?, bytes);
            }
        }
        Ok(Inputs { files })
    }
}
