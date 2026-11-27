//! One bounded Git command in the validated checkout, without optional locks.

use std::collections::BTreeSet;
use std::ffi::OsString;

use crate::batches::{self, MAX_ARGUMENT_BYTES, MAX_ARGUMENTS};
use crate::changes::fields;
use crate::command::{DEFAULT_OUTPUT_LIMIT, DEFAULT_STDERR_LIMIT, ProcessMode, Request};
use crate::error::Result;
use crate::identity::RepoPath;
use crate::repository::GitRepository;
use crate::tree::candidate;

impl GitRepository {
    pub(crate) fn command(&self, args: &[&str], stdin: Vec<u8>, limit: usize) -> Result<Vec<u8>> {
        self.command_with_mode(ProcessMode::default(), args, stdin, limit)
    }

    pub(crate) fn command_with_mode(
        &self,
        process_mode: ProcessMode,
        args: &[&str],
        stdin: Vec<u8>,
        limit: usize,
    ) -> Result<Vec<u8>> {
        Ok(self
            .runner
            .run(&self.request(process_mode, args, stdin, limit))?
            .stdout)
    }

    pub(crate) fn file_listing(&self, flags: &[&str]) -> Result<Vec<u8>> {
        Ok(self.runner.run(&self.file_listing_request(flags))?.stdout)
    }

    /// Disable monitor helpers while retaining promisor object-fetch ownership.
    pub(crate) fn file_listing_request(&self, flags: &[&str]) -> Request {
        let mut args = vec!["-c", "core.fsmonitor=false", "ls-files"];
        args.extend_from_slice(flags);
        self.tree_request(&args)
    }

    pub(crate) fn index_paths(&self, pathspecs: &[&str]) -> Result<Vec<RepoPath>> {
        let mut request = self.file_listing_request(&["--cached", "-z", "--"]);
        request.args.retain(|arg| arg != "--literal-pathspecs");
        let arguments = pathspecs.iter().map(OsString::from).collect::<Vec<_>>();
        let batches = if arguments.is_empty() {
            vec![request.args.clone()]
        } else {
            batches::split(&request.args, &arguments, MAX_ARGUMENTS, MAX_ARGUMENT_BYTES)?
        };
        let mut paths = BTreeSet::new();
        for args in batches {
            request.args = args;
            let output = self.runner.run(&request)?.stdout;
            for path in fields(&output)?.filter_map(candidate) {
                paths.insert(RepoPath::parse(path)?);
            }
        }
        Ok(paths.into_iter().collect())
    }

    /// Own lazy-fetch helpers whenever this repository has a promisor remote.
    pub(crate) fn tree_request(&self, args: &[&str]) -> Request {
        let mode = if self.promisor_remotes.is_empty() {
            ProcessMode::PlainGroup
        } else {
            ProcessMode::FullTree
        };
        self.request(mode, args, Vec::new(), DEFAULT_OUTPUT_LIMIT)
    }

    fn request(
        &self,
        process_mode: ProcessMode,
        args: &[&str],
        stdin: Vec<u8>,
        limit: usize,
    ) -> Request {
        let mut arguments = vec![
            OsString::from("--no-optional-locks"),
            OsString::from("--literal-pathspecs"),
        ];
        arguments.extend(args.iter().map(OsString::from));
        Request {
            process_mode,
            directory: self.directory.clone(),
            args: arguments,
            stdin,
            output_limit: limit,
            stderr_limit: DEFAULT_STDERR_LIMIT,
        }
    }
}

#[cfg(test)]
#[path = "_tests_/file_listing_requests_tests.rs"]
mod file_listing_requests_tests;
