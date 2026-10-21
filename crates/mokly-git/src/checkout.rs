//! Commit-pinned checkout conversion through an isolated temporary index.

use std::ffi::OsString;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::Duration;

use sha2::{Digest, Sha256};

use crate::command::{self, DEFAULT_OUTPUT_LIMIT, DEFAULT_STDERR_LIMIT, Request, Runner};
use crate::error::{Error, IoResult, Result};
use crate::identity::{ObjectId, RepoPath};
use crate::repository::GitRepository;
use crate::tree::{Entry, Limits};

const FILTER_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_CHECKOUT_OUTPUT: usize = DEFAULT_OUTPUT_LIMIT;

struct NeverCancelled;

impl command::Cancellation for NeverCancelled {
    fn is_cancelled(&self) -> bool {
        false
    }
}

struct SizeBound {
    root: PathBuf,
    limit: usize,
}

impl command::Cancellation for SizeBound {
    fn is_cancelled(&self) -> bool {
        directory_bytes(&self.root, self.limit).is_some_and(|bytes| bytes > self.limit)
    }
}

impl SizeBound {
    fn exceeded(&self) -> bool {
        command::Cancellation::is_cancelled(self)
    }
}

impl GitRepository {
    pub(crate) fn checkout_read(
        &self,
        commit: &ObjectId,
        entries: &[Entry],
        limits: Limits,
    ) -> Result<Vec<Vec<u8>>> {
        validate_entries(entries, limits)?;
        if entries.is_empty() {
            return Ok(Vec::new());
        }
        let checkout = Checkout::new(self, commit, entries, Some(limits.bytes))?;
        let mut total = 0usize;
        let mut result = Vec::with_capacity(entries.len());
        for entry in entries {
            let bytes = checkout.read(&entry.path, limits.blob)?;
            total = total.saturating_add(bytes.len());
            if total > limits.bytes {
                return Err(Error::ByteLimit {
                    limit: limits.bytes,
                });
            }
            result.push(bytes);
        }
        Ok(result)
    }

    pub(crate) fn checkout_digest(&self, commit: &ObjectId, entry: &Entry) -> Result<String> {
        validate_entries(std::slice::from_ref(entry), Limits::default())?;
        let checkout = Checkout::new(
            self,
            commit,
            std::slice::from_ref(entry),
            Some(DEFAULT_OUTPUT_LIMIT),
        )?;
        let path = checkout.file(&entry.path)?;
        let mut input = fs::File::open(path).git()?;
        let mut digest = Sha256::new();
        let mut buffer = [0; 64 * 1024];
        loop {
            let count = input.read(&mut buffer).git()?;
            if count == 0 {
                break;
            }
            digest.update(&buffer[..count]);
        }
        Ok(digest
            .finalize()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect())
    }
}

fn validate_entries(entries: &[Entry], limits: Limits) -> Result<()> {
    if entries.len() > limits.files {
        return Err(Error::FileCount {
            limit: limits.files,
        });
    }
    for entry in entries {
        if !entry.mode.regular() {
            return Err(Error::NotRegular {
                path: entry.path.to_string(),
            });
        }
    }
    Ok(())
}

pub(crate) struct Checkout {
    _root: tempfile::TempDir,
    files: std::collections::BTreeMap<RepoPath, PathBuf>,
}

impl Checkout {
    fn new(
        repository: &GitRepository,
        commit: &ObjectId,
        entries: &[Entry],
        byte_limit: Option<usize>,
    ) -> Result<Self> {
        repository.ensure_objects(entries)?;
        let root = tempfile::Builder::new()
            .prefix("mokly-git-checkout-")
            .tempdir()
            .git()?;
        let worktree = root.path().join("worktree");
        fs::create_dir(&worktree).git()?;
        let index = root.path().join("index");
        let environment = [
            ("GIT_INDEX_FILE", index.as_os_str().to_os_string()),
            ("GIT_WORK_TREE", worktree.as_os_str().to_os_string()),
        ];
        let cancellation = NeverCancelled;
        run(
            repository.runner.as_ref(),
            repository,
            &["read-tree", "--reset", commit.as_str()],
            Vec::new(),
            &environment,
            &cancellation,
            MAX_CHECKOUT_OUTPUT,
            None,
        )?;
        let mut input = Vec::new();
        for entry in entries {
            input.extend_from_slice(entry.path.as_str().as_bytes());
            input.push(0);
        }
        let size_bound = byte_limit.map(|limit| SizeBound {
            root: worktree.clone(),
            limit,
        });
        let filter_cancellation: &dyn command::Cancellation =
            size_bound.as_ref().map_or(&cancellation, |bound| bound);
        let output = match run(
            repository.runner.as_ref(),
            repository,
            &["checkout-index", "--force", "--temp", "--stdin", "-z"],
            input,
            &environment,
            filter_cancellation,
            MAX_CHECKOUT_OUTPUT,
            Some(FILTER_TIMEOUT),
        ) {
            Err(Error::Cancelled) if size_bound.as_ref().is_some_and(SizeBound::exceeded) => {
                return Err(Error::ByteLimit {
                    limit: size_bound.as_ref().map_or(0, |bound| bound.limit),
                });
            }
            result => result,
        }?;
        if filter_failed(&output.stderr) {
            return Err(Error::CheckoutFailed {
                stderr: output.stderr,
            });
        }
        let files = parse_output(&output.stdout, &worktree, entries)?;
        Ok(Self { _root: root, files })
    }

    pub(crate) fn file(&self, path: &RepoPath) -> Result<PathBuf> {
        self.files.get(path).cloned().ok_or(Error::MalformedOutput)
    }

    fn read(&self, path: &RepoPath, limit: usize) -> Result<Vec<u8>> {
        let file = self.file(path)?;
        let metadata = fs::metadata(file.clone()).git()?;
        if metadata.len() > limit as u64 {
            return Err(Error::ByteLimit { limit });
        }
        let input = fs::File::open(file).git()?;
        let mut bytes = Vec::new();
        input
            .take(limit.saturating_add(1) as u64)
            .read_to_end(&mut bytes)
            .git()?;
        if bytes.len() > limit {
            return Err(Error::ByteLimit { limit });
        }
        Ok(bytes)
    }
}

fn filter_failed(stderr: &[u8]) -> bool {
    let stderr = String::from_utf8_lossy(stderr).to_ascii_lowercase();
    stderr.contains("external filter") && stderr.contains("failed")
}

fn directory_bytes(root: &Path, limit: usize) -> Option<usize> {
    let mut pending = vec![root.to_path_buf()];
    let mut total = 0usize;
    while let Some(path) = pending.pop() {
        let entries = fs::read_dir(path).ok()?;
        for entry in entries.flatten() {
            let metadata = entry.metadata().ok()?;
            if metadata.is_dir() {
                pending.push(entry.path());
            } else if metadata.is_file() {
                total = total.saturating_add(usize::try_from(metadata.len()).ok()?);
                if total > limit {
                    return Some(total);
                }
            }
        }
    }
    Some(total)
}

impl GitRepository {
    pub(crate) fn checkout(
        &self,
        entries: &[Entry],
        commit: &ObjectId,
        limits: Limits,
    ) -> Result<Checkout> {
        validate_entries(entries, limits)?;
        Checkout::new(self, commit, entries, Some(limits.bytes))
    }
}

#[expect(
    clippy::too_many_arguments,
    reason = "keeps the checkout command adapter explicit"
)]
fn run(
    runner: &dyn Runner,
    repository: &GitRepository,
    args: &[&str],
    stdin: Vec<u8>,
    environment: &[(&str, OsString)],
    cancellation: &dyn command::Cancellation,
    output_limit: usize,
    timeout: Option<Duration>,
) -> Result<crate::command::Output> {
    let request = Request {
        directory: repository.directory.clone(),
        args: args.iter().map(OsString::from).collect(),
        stdin,
        output_limit,
        stderr_limit: DEFAULT_STDERR_LIMIT,
    };
    match timeout {
        Some(timeout) => runner.run_cancellable_with_environment_timeout(
            &request,
            cancellation,
            environment,
            timeout,
        ),
        None => runner.run_cancellable_with_environment(&request, cancellation, environment),
    }
}

fn parse_output(
    output: &[u8],
    worktree: &Path,
    entries: &[Entry],
) -> Result<std::collections::BTreeMap<RepoPath, PathBuf>> {
    let expected: std::collections::BTreeSet<_> =
        entries.iter().map(|entry| entry.path.clone()).collect();
    let mut files = std::collections::BTreeMap::new();
    for record in output
        .split(|byte| *byte == 0)
        .filter(|record| !record.is_empty())
    {
        let Some(tab) = record.iter().position(|byte| *byte == b'\t') else {
            return Err(Error::MalformedOutput);
        };
        let temporary = std::str::from_utf8(&record[..tab]).map_err(|_| Error::PathEncoding)?;
        let path = RepoPath::parse(
            std::str::from_utf8(&record[tab + 1..]).map_err(|_| Error::PathEncoding)?,
        )?;
        if !expected.contains(&path) || files.contains_key(&path) {
            return Err(Error::MalformedOutput);
        }
        let temporary = Path::new(temporary);
        if temporary.is_absolute()
            || temporary
                .components()
                .any(|component| matches!(component, std::path::Component::ParentDir))
        {
            return Err(Error::MalformedOutput);
        }
        files.insert(path, worktree.join(temporary));
    }
    if files.len() != expected.len() {
        return Err(Error::MalformedOutput);
    }
    Ok(files)
}
