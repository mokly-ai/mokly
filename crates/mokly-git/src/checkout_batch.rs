//! Filtered conversion requests: one Git process for each batch of files.

use std::fs;
use std::hash::{BuildHasher, RandomState};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::Duration;

use crate::checkout_output::{BatchFiles, BatchSink, HEADER_BYTES};
use crate::command::{Cancellation, DEFAULT_OUTPUT_LIMIT, DEFAULT_STDERR_LIMIT, Request};
use crate::error::{IoResult, Result};
use crate::identity::ObjectId;
use crate::repository::GitRepository;
use crate::tree::Entry;

/// The deadline of one conversion process, a batch or a single file.
pub(crate) const FILTER_TIMEOUT: Duration = Duration::from_secs(120);

/// The raw byte bound of a batch that converts in one process.
pub(crate) const BATCH_BYTES: usize = 48 * 1024 * 1024;

pub(crate) struct Active;
impl Cancellation for Active {
    fn is_cancelled(&self) -> bool {
        false
    }
}

/// Git strips leading spaces and tabs from a batch path, so such a path
/// converts alone with an exact `--path` argument.
pub(crate) fn batchable(entry: &Entry) -> bool {
    !entry.path.as_str().starts_with([' ', '\t'])
}

/// Converts `entries` with one `cat-file --batch --filters -Z` process and
/// writes each file into `directory`. Returns the files in batch order and
/// their total converted bytes, which stay within `limit`.
pub(crate) fn convert(
    repository: &GitRepository,
    commit: &ObjectId,
    entries: &[Entry],
    directory: &Path,
    limit: usize,
) -> Result<(Vec<PathBuf>, usize)> {
    let sentinel = sentinel();
    let mut input = Vec::new();
    for entry in entries {
        input
            .extend_from_slice(format!("{} {}\0{sentinel}\0", entry.object, entry.path).as_bytes());
    }
    let request = request(
        repository,
        commit,
        vec!["--batch".into(), "--filters".into(), "-Z".into()],
        input,
    );
    let framing = entries.len().saturating_mul(
        HEADER_BYTES
            .saturating_add(sentinel.len())
            .saturating_add(16),
    );
    let mut files = DirectoryFiles {
        directory,
        paths: Vec::with_capacity(entries.len()),
    };
    let mut sink = BatchSink::new(entries, &mut files, &sentinel, limit);
    let streamed = repository
        .runner
        .stream_cancellable_with_environment_timeout(
            &request,
            &Active,
            &[("LC_ALL", "C".into())],
            FILTER_TIMEOUT,
            &mut sink,
            limit.saturating_add(framing),
        );
    if let Some(error) = sink.failure() {
        return Err(error);
    }
    streamed?;
    let written = sink.finish()?;
    Ok((files.paths, written))
}

pub(crate) fn request(
    repository: &GitRepository,
    commit: &ObjectId,
    args: Vec<String>,
    stdin: Vec<u8>,
) -> Request {
    Request {
        directory: repository.directory.clone(),
        args: [
            "--no-optional-locks".to_owned(),
            format!("--attr-source={commit}"),
            "cat-file".into(),
        ]
        .into_iter()
        .chain(args)
        .map(Into::into)
        .collect(),
        stdin,
        output_limit: DEFAULT_OUTPUT_LIMIT,
        stderr_limit: DEFAULT_STDERR_LIMIT,
    }
}

pub(crate) fn conversion_args(entry: &Entry, converted: bool) -> Vec<String> {
    if converted {
        vec![
            "--filters".into(),
            format!("--path={}", entry.path),
            entry.object.to_string(),
        ]
    } else {
        vec!["blob".into(), entry.object.to_string()]
    }
}

/// A name that no repository content can predict. Git answers it with a
/// `{sentinel} missing` record, which ends the file before it.
fn sentinel() -> String {
    let first = RandomState::new().hash_one(0u8);
    let second = RandomState::new().hash_one(1u8);
    format!("mokly-end-{first:016x}{second:016x}")
}

struct DirectoryFiles<'a> {
    directory: &'a Path,
    paths: Vec<PathBuf>,
}

impl BatchFiles for DirectoryFiles<'_> {
    fn open(&mut self, index: usize) -> Result<Box<dyn Write + Send>> {
        let path = self.directory.join(format!("batch-{index}"));
        let file = fs::File::create(&path).git()?;
        self.paths.push(path);
        Ok(Box::new(file))
    }
}

#[cfg(test)]
#[path = "_tests_/checkout_batch_tests.rs"]
mod checkout_batch_tests;
