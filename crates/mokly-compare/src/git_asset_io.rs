//! Opaque Git digests retain hashes and lengths without filling the byte LRU.

use std::io;
use std::path::{Path, PathBuf};

use mokly_git::identity::RepoPath;
use mokly_model::material::digest;
use mokly_source_interface::error::{Result, SourceError};

use crate::git_tree::{GitTree, failure};
use crate::source_digest::SourceDigest;

impl GitTree {
    pub(crate) fn digest_file(&self, path: &Path) -> Result<String> {
        let Some(relative) = self.relative(path)? else {
            return Err(failure("digest", path, io::ErrorKind::IsADirectory));
        };
        if let Some(result) = self.retained_digest(&relative, path) {
            return Ok(result?.hash);
        }
        if let Err(source) = self.sources.ensure(std::slice::from_ref(&relative)) {
            return Err(self.failed("digest", path, source));
        }
        let index = self.index(path)?;
        let Some(entry) = index.entries.get(&relative) else {
            return Err(failure("digest", path, io::ErrorKind::NotFound));
        };
        if !entry.mode.regular() {
            return Err(failure("digest", path, io::ErrorKind::InvalidInput));
        }
        let cached = self
            .cache
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .get(&relative);
        let record = if let Some(bytes) = cached {
            SourceDigest {
                hash: digest(&bytes),
                length: Some(bytes.len()),
            }
        } else {
            let hash = match self.sources.digest(&relative) {
                Ok(hash) => hash,
                Err(source) => return Err(self.failed("digest", path, source)),
            };
            SourceDigest { hash, length: None }
        };
        self.remember_digest(relative, &record);
        Ok(record.hash)
    }

    pub(crate) fn digest_record(&self, path: &Path) -> Result<SourceDigest> {
        self.digest_files(&[path.into()])
            .pop()
            .unwrap_or_else(|| Err(failure("digest", path, io::ErrorKind::UnexpectedEof)))
    }

    pub(crate) fn digest_files(&self, paths: &[PathBuf]) -> Vec<Result<SourceDigest>> {
        let mut results: Vec<Option<Result<SourceDigest>>> =
            (0..paths.len()).map(|_| None).collect();
        let mut pending = Vec::new();
        for (index, path) in paths.iter().enumerate() {
            match self.relative(path) {
                Ok(Some(relative)) => match self.retained_digest(&relative, path) {
                    Some(result) => results[index] = Some(result),
                    None => pending.push((index, relative)),
                },
                Ok(None) => {
                    results[index] =
                        Some(Err(failure("digest", path, io::ErrorKind::IsADirectory)));
                }
                Err(error) => results[index] = Some(Err(error)),
            }
        }
        if !pending.is_empty() {
            let relatives: Vec<_> = pending.iter().map(|(_, path)| path.clone()).collect();
            match self.sources.ensure(&relatives) {
                Ok(()) => self.digest_known(paths, pending, &mut results),
                Err(_) => {
                    for (index, _) in pending {
                        results[index] = Some(self.digest_one(&paths[index]));
                    }
                }
            }
        }
        paths
            .iter()
            .zip(results)
            .map(|(path, result)| {
                result.unwrap_or_else(|| Err(failure("digest", path, io::ErrorKind::UnexpectedEof)))
            })
            .collect()
    }

    fn retained_digest(&self, relative: &RepoPath, path: &Path) -> Option<Result<SourceDigest>> {
        if let Some(message) = self
            .unavailable
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .get(relative)
            .cloned()
        {
            return Some(Err(SourceError::Unavailable {
                path: path.into(),
                message,
            }));
        }
        self.digests
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .get(relative)
            .cloned()
            .map(Ok)
    }

    fn digest_one(&self, path: &Path) -> Result<SourceDigest> {
        let Some(relative) = self.relative(path)? else {
            return Err(failure("digest", path, io::ErrorKind::IsADirectory));
        };
        if let Err(source) = self.sources.ensure(std::slice::from_ref(&relative)) {
            return Err(self.failed("digest", path, source));
        }
        let mut results = vec![None];
        self.digest_known(&[path.into()], vec![(0, relative)], &mut results);
        results
            .pop()
            .flatten()
            .unwrap_or_else(|| Err(failure("digest", path, io::ErrorKind::UnexpectedEof)))
    }

    fn digest_known(
        &self,
        paths: &[PathBuf],
        pending: Vec<(usize, RepoPath)>,
        results: &mut [Option<Result<SourceDigest>>],
    ) {
        let index = match self.sources.index() {
            Ok(index) => index,
            Err(_) => {
                for (position, _) in pending {
                    results[position] = Some(match self.index(&paths[position]) {
                        Err(error) => Err(error),
                        Ok(_) => Err(failure(
                            "digest",
                            &paths[position],
                            io::ErrorKind::UnexpectedEof,
                        )),
                    });
                }
                return;
            }
        };
        let mut uncached = Vec::new();
        for (position, relative) in pending {
            let path = &paths[position];
            let Some(entry) = index.entries.get(&relative) else {
                results[position] = Some(Err(failure("digest", path, io::ErrorKind::NotFound)));
                continue;
            };
            if !entry.mode.regular() {
                results[position] = Some(Err(failure("digest", path, io::ErrorKind::InvalidInput)));
                continue;
            }
            let cached = self
                .cache
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .get(&relative);
            if let Some(bytes) = cached {
                let record = SourceDigest {
                    hash: digest(&bytes),
                    length: Some(bytes.len()),
                };
                self.remember_digest(relative, &record);
                results[position] = Some(Ok(record));
            } else {
                uncached.push((position, relative));
            }
        }
        if uncached.is_empty() {
            return;
        }
        let relatives: Vec<_> = uncached.iter().map(|(_, path)| path.clone()).collect();
        let batch = match self.sources.digest_with_length(&relatives) {
            Ok(batch) => batch,
            Err(source) => {
                if let [(position, _)] = uncached.as_slice() {
                    results[*position] =
                        Some(Err(self.failed("digest", &paths[*position], source)));
                    return;
                }
                for (position, _) in uncached {
                    results[position] = Some(self.digest_one(&paths[position]));
                }
                return;
            }
        };
        for ((position, relative), result) in uncached.into_iter().zip(batch) {
            results[position] = Some(match result {
                Ok(record) => {
                    self.remember_digest(relative, &record);
                    Ok(record)
                }
                Err(source) => Err(self.failed("digest", &paths[position], source)),
            });
        }
    }

    fn remember_digest(&self, relative: RepoPath, record: &SourceDigest) {
        self.digests
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .insert(relative, record.clone());
    }
}

#[cfg(test)]
#[path = "_tests_/git_asset_io_tests.rs"]
mod git_asset_io_tests;

#[cfg(test)]
#[path = "_tests_/git_asset_batch_tests.rs"]
mod git_asset_batch_tests;
