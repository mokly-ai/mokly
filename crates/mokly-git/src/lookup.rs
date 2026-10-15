//! Exact tree metadata batches and streamed immutable blob hashes.

use std::ffi::OsString;

use crate::batches::{self, MAX_ARGUMENT_BYTES, MAX_ARGUMENTS};
use crate::command::{DEFAULT_OUTPUT_LIMIT, DEFAULT_STDERR_LIMIT, Request};
use crate::error::{Error, Result};
use crate::identity::{ObjectId, RepoPath};
use crate::repository::GitRepository;
use crate::tree::{self, Entry, Limits};

impl GitRepository {
    pub(crate) fn lookup_paths(
        &self,
        commit: &ObjectId,
        paths: &[RepoPath],
        limits: Limits,
    ) -> Result<Vec<Entry>> {
        let prefix: Vec<_> = [
            "--no-optional-locks",
            "--literal-pathspecs",
            "ls-tree",
            "-l",
            "-z",
            "--full-tree",
            commit.as_str(),
            "--",
        ]
        .into_iter()
        .map(OsString::from)
        .collect();
        let paths: Vec<_> = paths
            .iter()
            .map(|path| OsString::from(path.as_str()))
            .collect();
        let mut entries = Vec::new();
        for args in batches::split(&prefix, &paths, MAX_ARGUMENTS, MAX_ARGUMENT_BYTES)? {
            let output = self.runner.run(&Request {
                directory: self.directory.clone(),
                args,
                stdin: Vec::new(),
                output_limit: DEFAULT_OUTPUT_LIMIT,
                stderr_limit: DEFAULT_STDERR_LIMIT,
            })?;
            entries.extend(tree::parse(&output.stdout, limits)?);
        }
        Ok(entries)
    }

    pub(crate) fn digest_blob(&self, entry: &Entry) -> Result<String> {
        if !entry.mode.regular() {
            return Err(Error::NotRegular {
                path: entry.path.to_string(),
            });
        }
        self.runner.digest(&Request {
            directory: self.directory.clone(),
            args: [
                "--no-optional-locks",
                "cat-file",
                "blob",
                entry.object.as_str(),
            ]
            .into_iter()
            .map(OsString::from)
            .collect(),
            stdin: Vec::new(),
            output_limit: DEFAULT_OUTPUT_LIMIT,
            stderr_limit: DEFAULT_STDERR_LIMIT,
        })
    }
}
