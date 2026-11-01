//! Hash-only batches and streamed opaque delivery over pinned source entries.

use std::fmt;
use std::io::Write;

use mokly_git::error;
use mokly_git::identity::RepoPath;
use mokly_git::repository::BlobDigest;
use mokly_git::tree::Limits;

use crate::error::{Error, GitResult, InternalError, Result};
use crate::source_digest::SourceDigest;
use crate::sources::{GitSources, Sources};

impl GitSources {
    pub(crate) fn digest_source_batch(
        &self,
        paths: &[RepoPath],
    ) -> Result<Vec<Result<SourceDigest>>> {
        if paths.is_empty() {
            return Ok(Vec::new());
        }
        self.ensure(paths)?;
        let index = self.index()?;
        let entries: Vec<_> = paths
            .iter()
            .map(|path| {
                index.entries.get(path).cloned().ok_or_else(|| Error::Git {
                    source: error::Error::MissingBlob {
                        path: path.to_string(),
                    },
                })
            })
            .collect();
        if let Some(files) = self.extraction() {
            let mut results = Vec::with_capacity(paths.len());
            for (entry, path) in entries.into_iter().zip(paths) {
                let result = entry.and_then(|entry| {
                    let hash = self
                        .repository
                        .digest_extracted(&self.commit, &entry, &files)
                        .at_path(path.as_str())?;
                    Ok(SourceDigest { hash, length: None })
                });
                results.push(result);
            }
            return Ok(results);
        }
        let mut results: Vec<Option<Result<SourceDigest>>> =
            (0..paths.len()).map(|_| None).collect();
        let mut valid = Vec::new();
        for (index, entry) in entries.into_iter().enumerate() {
            match entry {
                Ok(entry) => valid.push((index, entry)),
                Err(error) => results[index] = Some(Err(error)),
            }
        }
        let valid_entries: Vec<_> = valid.iter().map(|(_, entry)| entry.clone()).collect();
        for ((index, _), result) in valid
            .iter()
            .zip(self.repository.digest_many(&self.commit, &valid_entries))
        {
            results[*index] = Some(result.at_path(paths[*index].as_str()).map(
                |digest: BlobDigest| SourceDigest {
                    hash: digest.digest,
                    length: Some(digest.length),
                },
            ));
        }
        Ok(results
            .into_iter()
            .map(|result| {
                result.unwrap_or_else(|| {
                    Err(Error::Git {
                        source: error::Error::MalformedOutput,
                    })
                })
            })
            .collect())
    }

    pub(crate) fn stream_source(
        &self,
        path: &RepoPath,
        output: &mut (dyn Write + Send),
        limit: usize,
    ) -> Result<usize> {
        let limit = limit.min(self.limits.blob).min(self.limits.bytes);
        self.ensure(std::slice::from_ref(path))?;
        let index = self.index()?;
        let entry = index.entries.get(path).ok_or_else(|| Error::Git {
            source: error::Error::MissingBlob {
                path: path.to_string(),
            },
        })?;
        if !entry.mode.regular() {
            return Err(Error::Git {
                source: error::Error::NotRegular {
                    path: path.to_string(),
                },
            });
        }
        match self.extraction() {
            Some(files) => self
                .repository
                .read_extracted(
                    &self.commit,
                    std::slice::from_ref(entry),
                    Limits {
                        blob: limit,
                        bytes: limit,
                        ..Limits::default()
                    },
                    &files,
                )
                .at_path(path.as_str())?
                .first()
                .map_or(Ok(0), |bytes| {
                    if let Err(source) = output.write_all(bytes) {
                        return Err(Error::Internal(InternalError::Io { source }));
                    }
                    Ok(bytes.len())
                }),
            None => self
                .repository
                .stream(&self.commit, entry, output, limit)
                .at_path(path.as_str()),
        }
    }
}

impl fmt::Debug for dyn Sources + '_ {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("Sources")
    }
}
