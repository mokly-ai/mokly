//! Commit-pinned checkout conversion through an isolated temporary index.

use std::ffi::OsString;
use std::fs;
use std::io::Read;
use std::path::PathBuf;
use std::time::Duration;

use crate::checkout_bounds::{SizeBound, filter_failed};
use crate::checkout_output::{conversion, parse_output};
use crate::command::{self, DEFAULT_OUTPUT_LIMIT, DEFAULT_STDERR_LIMIT, Request, Runner};
use crate::error::{Error, IoResult, Result};
use crate::identity::{ObjectId, RepoPath};
use crate::repository::GitRepository;
use crate::tree::{Entry, Limits};

const FILTER_TIMEOUT: Duration = Duration::from_secs(120);
const MAX_CHECKOUT_OUTPUT: usize = DEFAULT_OUTPUT_LIMIT;

struct NeverCancelled;

impl command::Cancellation for NeverCancelled {
    fn is_cancelled(&self) -> bool {
        false
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
        for entry in entries {
            if entry.size > limits.blob {
                return Err(Error::ByteLimit { limit: limits.blob });
            }
        }
        if entries
            .iter()
            .fold(0usize, |total, entry| total.saturating_add(entry.size))
            > limits.bytes
        {
            return Err(Error::ByteLimit {
                limit: limits.bytes,
            });
        }
        if entries.is_empty() {
            return Ok(Vec::new());
        }
        let checkout = conversion(
            Checkout::new(self, commit, entries, Some(limits.bytes)),
            entries,
        )?;
        let mut total = 0usize;
        let mut result = Vec::with_capacity(entries.len());
        for entry in entries {
            let bytes = conversion(
                checkout.read(&entry.path, limits.blob),
                std::slice::from_ref(entry),
            )?;
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
        self.checkout_index(commit, std::slice::from_ref(entry))?;
        let request = Request {
            directory: self.directory.clone(),
            args: vec![
                "--no-optional-locks".into(),
                format!("--attr-source={commit}").into(),
                "cat-file".into(),
                "--filters".into(),
                format!("--path={}", entry.path).into(),
                entry.object.as_str().into(),
            ],
            stdin: Vec::new(),
            output_limit: DEFAULT_OUTPUT_LIMIT,
            stderr_limit: DEFAULT_STDERR_LIMIT,
        };
        conversion(
            self.runner.digest_cancellable_with_environment_timeout(
                &request,
                &NeverCancelled,
                &[("LC_ALL", "C".into())],
                FILTER_TIMEOUT,
            ),
            std::slice::from_ref(entry),
        )
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
        let index_input = repository.checkout_index(commit, entries)?;
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
            ("LC_ALL", OsString::from("C")),
        ];
        let cancellation = NeverCancelled;
        run(
            repository.runner.as_ref(),
            repository,
            &["update-index", "-z", "--index-info"],
            index_input,
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
        if size_bound.as_ref().is_some_and(SizeBound::exceeded) {
            return Err(Error::ByteLimit {
                limit: size_bound.as_ref().map_or(0, |bound| bound.limit),
            });
        }
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

impl GitRepository {
    pub(crate) fn checkout(
        &self,
        entries: &[Entry],
        commit: &ObjectId,
        limits: Limits,
    ) -> Result<Checkout> {
        validate_entries(entries, limits)?;
        conversion(
            Checkout::new(self, commit, entries, Some(limits.bytes)),
            entries,
        )
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
