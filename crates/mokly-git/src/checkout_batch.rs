//! Filtered conversion requests: one Git process for each batch of files.

use std::hash::{BuildHasher, RandomState};
use std::time::Duration;

use crate::checkout_files::{BatchFiles, EntryWriter, Indexed};
use crate::checkout_output::{BatchSink, HEADER_BYTES, conversion};
use crate::command::{Cancellation, DEFAULT_OUTPUT_LIMIT, DEFAULT_STDERR_LIMIT, Request};
use crate::error::{Error, Result};
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
fn batchable(entry: &Entry) -> bool {
    !entry.path.as_str().starts_with([' ', '\t'])
}

/// Converts `entries` into `files` and returns their total converted bytes,
/// which stay within `limit`. Two or more entries within 48 MiB convert in
/// one batch process. When that process reaches its deadline, each of its
/// files converts again alone with its own deadline. Every other entry, and
/// every entry of a larger call, converts alone, and its failure names it.
pub(crate) fn convert_entries(
    repository: &GitRepository,
    commit: &ObjectId,
    entries: &[Entry],
    files: &mut dyn BatchFiles,
    limit: usize,
) -> Result<usize> {
    if let Some(entry) = timed_out(repository, commit, entries) {
        return Err(Error::Conversion {
            path: entry.path.to_string(),
            source: Box::new(Error::CheckoutTimeout),
        });
    }
    let mut remaining = limit;
    let mut done = vec![false; entries.len()];
    let bytes = entries
        .iter()
        .fold(0usize, |total, entry| total.saturating_add(entry.size));
    let converted = if bytes <= BATCH_BYTES {
        let indices: Vec<_> = (0..entries.len())
            .filter(|index| batchable(&entries[*index]))
            .collect();
        if indices.len() > 1 {
            let batch: Vec<_> = indices
                .iter()
                .map(|index| entries[*index].clone())
                .collect();
            let mut subset = Indexed {
                files: &mut *files,
                indices: &indices,
            };
            match convert(repository, commit, &batch, &mut subset, remaining) {
                Ok(written) => {
                    remaining -= written;
                    for index in &indices {
                        done[*index] = true;
                    }
                }
                Err(Error::CheckoutTimeout) => {
                    tracing::debug!(
                        files = batch.len(),
                        "a conversion batch reached its deadline"
                    );
                }
                Err(error) => return Err(error),
            }
        }
        None
    } else {
        Some(repository.converted_paths(commit, entries)?)
    };
    for (index, entry) in entries.iter().enumerate() {
        if done[index] {
            continue;
        }
        files.open(index)?;
        let mut output = EntryWriter::new(&mut *files, index);
        let converted = converted
            .as_ref()
            .is_none_or(|converted| converted.contains(&entry.path));
        let request = request(
            repository,
            commit,
            conversion_args(entry, converted),
            Vec::new(),
        );
        let streamed = repository
            .runner
            .stream_cancellable_with_environment_timeout(
                &request,
                &Active,
                &[("LC_ALL", "C".into())],
                FILTER_TIMEOUT,
                &mut output,
                remaining,
            );
        if let Some(error) = output.failure() {
            return Err(error);
        }
        if matches!(streamed, Err(Error::CheckoutTimeout)) {
            repository
                .timed_out
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .insert((commit.clone(), entry.object.clone(), entry.path.clone()));
        }
        conversion(streamed, std::slice::from_ref(entry))?;
        remaining = remaining.saturating_sub(output.written());
    }
    Ok(limit - remaining)
}

/// The first entry whose own conversion already reached its deadline in this
/// repository session. It fails at once, so no later call waits for it again.
fn timed_out<'a>(
    repository: &GitRepository,
    commit: &ObjectId,
    entries: &'a [Entry],
) -> Option<&'a Entry> {
    let timed_out = repository
        .timed_out
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    entries.iter().find(|entry| {
        timed_out.contains(&(commit.clone(), entry.object.clone(), entry.path.clone()))
    })
}

/// Converts `entries` with one `cat-file --batch --filters -Z` process into
/// `files`, at batch positions. Returns the converted bytes.
fn convert(
    repository: &GitRepository,
    commit: &ObjectId,
    entries: &[Entry],
    files: &mut dyn BatchFiles,
    limit: usize,
) -> Result<usize> {
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
    let mut sink = BatchSink::new(entries, files, &sentinel, limit);
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
    sink.finish()
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

#[cfg(test)]
#[path = "_tests_/checkout_batch_tests.rs"]
mod checkout_batch_tests;
