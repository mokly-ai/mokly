//! Dependency candidates and clean identities from Git's working-tree view.

use mokly_git::error;
use mokly_git::repository::Repository;
use mokly_git::tree::Limits;

use crate::error::{Error, GitResult, Result};
use crate::inputs::{Inputs, selected};

/// Working-side dependency inventory boundary.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = WorkingInputsMock))]
pub trait WorkingInputs: Send + Sync {
    /// Read tracked and nonignored inputs, using base bytes for clean-equal files.
    fn read(&self, repository: &dyn Repository, base: &Inputs, limits: Limits) -> Result<Inputs>;
}

/// Git candidate adapter. It does not traverse ignored trees or submodules.
pub struct SystemWorkingInputs;

impl WorkingInputs for SystemWorkingInputs {
    fn read(&self, repository: &dyn Repository, base: &Inputs, limits: Limits) -> Result<Inputs> {
        let mut inputs = Inputs::default();
        let mut total = 0usize;
        for path in repository.working_paths().base()? {
            if !selected(path.as_str())
                || path.as_str().split('/').any(|part| part == "node_modules")
            {
                continue;
            }
            let file = match repository.working(&path, limits.blob) {
                Ok(Some(file)) => file,
                Ok(None) => continue,
                Err(error::Error::NotRegular { .. }) => {
                    tracing::trace!(path = %path, "skipping nonregular dependency candidate");
                    continue;
                }
                Err(error::Error::Cancelled) => return Err(Error::Cancelled),
                Err(source) => return Err(Error::Git { source }),
            };
            total = total.saturating_add(file.bytes.len());
            if total > limits.bytes || inputs.files.len() >= limits.files {
                return Err(Error::CacheLimit {
                    limit: limits.bytes as u64,
                });
            }
            let bytes = if base.objects.get(&path) == Some(&file.object) {
                base.files.get(&path).cloned().unwrap_or(file.bytes)
            } else {
                file.bytes
            };
            inputs.objects.insert(path.clone(), file.object);
            inputs.files.insert(path, bytes);
        }
        Ok(inputs)
    }
}
