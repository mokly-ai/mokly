//! Dependency candidates and clean identities from Git's working-tree view.

use mokly_git::error;
use mokly_git::identity::RepoPath;
use mokly_git::repository::Repository;
use mokly_git::tree::Limits;

use crate::error::{Error, GitResult, Result};
use crate::inputs::{Inputs, manager_lock, selected};

/// Working-side dependency inventory boundary.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = WorkingInputsMock))]
pub trait WorkingInputs: Send + Sync {
    /// Read tracked and nonignored inputs, using base bytes for clean-equal files.
    fn read(&self, repository: &dyn Repository, base: &Inputs, limits: Limits) -> Result<Inputs>;
    /// Read and normalize only the supplied confined paths, without working-tree enumeration.
    fn read_paths(
        &self,
        repository: &dyn Repository,
        base: &Inputs,
        paths: &[RepoPath],
        limits: Limits,
    ) -> Result<Inputs>;
}

/// Git candidate adapter. It does not traverse ignored trees or submodules.
pub struct SystemWorkingInputs;

impl WorkingInputs for SystemWorkingInputs {
    fn read(&self, repository: &dyn Repository, base: &Inputs, limits: Limits) -> Result<Inputs> {
        let paths = repository.working_paths().base()?;
        let manager_config = paths.iter().any(|path| manager_lock(path.as_str()));
        let paths = paths
            .into_iter()
            .filter(|path| {
                selected(path.as_str(), manager_config)
                    && !path.as_str().split('/').any(|part| part == "node_modules")
            })
            .collect::<Vec<_>>();
        self.read_paths(repository, base, &paths, limits)
    }

    fn read_paths(
        &self,
        repository: &dyn Repository,
        base: &Inputs,
        paths: &[RepoPath],
        limits: Limits,
    ) -> Result<Inputs> {
        if paths.is_empty() {
            return Ok(Inputs::default());
        }
        let mut inputs = Inputs::default();
        let mut total = 0usize;
        let mut changed = Vec::new();
        for path in paths.iter().cloned() {
            let bytes = match repository.working_bytes(&path, limits.blob) {
                Ok(Some(bytes)) => bytes,
                Ok(None) => continue,
                Err(error::Error::NotRegular { .. }) => {
                    tracing::trace!(path = %path, "skipping nonregular dependency candidate");
                    continue;
                }
                Err(error::Error::Cancelled) => return Err(Error::Cancelled),
                Err(source) => return Err(Error::Git { source }),
            };
            total = total.saturating_add(bytes.len());
            if inputs.files.len() >= limits.files {
                return Err(Error::Git {
                    source: error::Error::FileCount {
                        limit: limits.files,
                    },
                });
            }
            if total > limits.bytes {
                return Err(Error::Git {
                    source: error::Error::ByteLimit {
                        limit: limits.bytes,
                    },
                });
            }
            if base.files.get(&path) == Some(&bytes) {
                if let Some(object) = base.objects.get(&path) {
                    inputs.objects.insert(path.clone(), object.clone());
                }
            } else {
                changed.push(path.clone());
            }
            inputs.files.insert(path, bytes);
        }
        let hashes = repository.working_hashes(&changed, limits.blob).base()?;
        if hashes.len() != changed.len() {
            return Err(Error::Git {
                source: error::Error::MalformedOutput,
            });
        }
        for (path, object) in changed.into_iter().zip(hashes) {
            if base.objects.get(&path) == Some(&object)
                && let Some(bytes) = base.files.get(&path)
            {
                inputs.files.insert(path.clone(), bytes.clone());
            }
            inputs.objects.insert(path, object);
        }
        Ok(inputs)
    }
}

#[cfg(test)]
#[path = "_tests_/working_inputs_tests.rs"]
mod working_inputs_tests;
