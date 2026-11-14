//! Hash converted Git blobs in one bounded checkout batch.

use std::collections::BTreeSet;

use crate::checkout::validate_entries;
use crate::checkout_batch::{BATCH_BYTES, convert_digest_entries};
use crate::checkout_files::DigestFiles;
use crate::checkout_output::conversion;
use crate::error::{Error, Result};
use crate::identity::{ObjectId, RepoPath};
use crate::repository::{BlobDigest, GitRepository};
use crate::tree::{Entry, Limits};

const OPAQUE_LIMIT: usize = 64 * 1024 * 1024;

impl GitRepository {
    pub(crate) fn checkout_digest_many(
        &self,
        commit: &ObjectId,
        entries: &[Entry],
    ) -> Vec<Result<BlobDigest>> {
        let mut results: Vec<Option<Result<BlobDigest>>> =
            (0..entries.len()).map(|_| None).collect();
        let mut valid = Vec::new();
        for (index, entry) in entries.iter().enumerate() {
            if let Err(error) = validate_entries(std::slice::from_ref(entry), Limits::default()) {
                results[index] = Some(Err(error));
            } else {
                valid.push((index, entry.clone()));
            }
        }
        if valid.is_empty() {
            return results
                .into_iter()
                .map(|result| result.unwrap_or(Err(Error::MalformedOutput)))
                .collect();
        }
        let batch: Vec<_> = valid.iter().map(|(_, entry)| entry.clone()).collect();
        let batch_result =
            self.prepare_digest_batch(commit, &batch)
                .and_then(|(limit, converted)| {
                    let mut files = DigestFiles::new(&batch, OPAQUE_LIMIT);
                    conversion(
                        convert_digest_entries(self, commit, &batch, &mut files, limit, &converted),
                        &batch,
                    )?;
                    files.into_digests()
                });
        match batch_result {
            Ok(digests) => {
                for ((index, _), digest) in valid.into_iter().zip(digests) {
                    results[index] = Some(Ok(digest));
                }
            }
            Err(_) => {
                for (index, entry) in valid {
                    results[index] = Some(self.checkout_digest_one(commit, &entry));
                }
            }
        }
        results
            .into_iter()
            .map(|result| result.unwrap_or(Err(Error::MalformedOutput)))
            .collect()
    }

    fn prepare_digest_batch(
        &self,
        commit: &ObjectId,
        entries: &[Entry],
    ) -> Result<(usize, BTreeSet<RepoPath>)> {
        if entries.len() > 1
            && entries
                .iter()
                .fold(0usize, |total, entry| total.saturating_add(entry.size))
                > BATCH_BYTES
        {
            return Err(Error::ByteLimit { limit: BATCH_BYTES });
        }
        for entry in entries {
            if entry.size > OPAQUE_LIMIT {
                return Err(Error::BlobLimit {
                    path: entry.path.to_string(),
                    limit: OPAQUE_LIMIT,
                });
            }
        }
        let converted = self.converted_paths(commit, entries)?;
        let limit = if entries.len() > 1 {
            BATCH_BYTES
        } else {
            OPAQUE_LIMIT
        };
        Ok((limit, converted))
    }

    fn checkout_digest_one(&self, commit: &ObjectId, entry: &Entry) -> Result<BlobDigest> {
        if entry.size > OPAQUE_LIMIT {
            return conversion(
                Err(Error::ByteLimit {
                    limit: OPAQUE_LIMIT,
                }),
                std::slice::from_ref(entry),
            );
        }
        self.ensure_checkout_objects(commit, std::slice::from_ref(entry))?;
        let converted = self.converted_paths(commit, std::slice::from_ref(entry))?;
        let mut files = DigestFiles::new(std::slice::from_ref(entry), OPAQUE_LIMIT);
        conversion(
            convert_digest_entries(
                self,
                commit,
                std::slice::from_ref(entry),
                &mut files,
                OPAQUE_LIMIT,
                &converted,
            ),
            std::slice::from_ref(entry),
        )?;
        files.into_digests()?.pop().ok_or(Error::MalformedOutput)
    }
}

#[cfg(test)]
#[path = "_tests_/checkout_digest_tests.rs"]
mod checkout_digest_tests;
