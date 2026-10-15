//! Publication checkout checks through the bounded mokly-git runner.

use std::collections::BTreeSet;
use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_git::command::{DEFAULT_OUTPUT_LIMIT, Request, Runner};
use mokly_git::error;
use mokly_model::output::repository::Repository;
use mokly_model::output::upload::Publication;
use mokly_model::output::validation::{hexadecimal, text};

use crate::error::{Error, OutputResult, Result};
use crate::hints::OutputHints;
use crate::identity::ActionsContext;
use crate::runtime::Cancellation;

/// Repository state captured before or after a static build.
#[derive(Clone, Debug)]
pub struct Inspection {
    /// Actual Git repository root, even from a nested working directory.
    pub root: PathBuf,
    /// Full committed checked-out object id.
    pub head_sha: String,
    /// Changed paths except pinned operation-owned paths and authenticated reservations.
    pub changed_paths: Vec<String>,
    /// Output folders used only to suggest literal Git ignore rules.
    pub build_directories: Vec<String>,
}

/// Git boundary used by publication orchestration.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = CheckoutMock))]
pub trait Checkout: Send + Sync {
    /// Check root, committed HEAD, and every porcelain status record.
    fn inspect(
        &self,
        directory: &Path,
        owned: &[PathBuf],
        cancellation: &dyn Cancellation,
    ) -> Result<Inspection>;
    /// Determine repository and branch metadata without replacing the inspected HEAD.
    fn publication(
        &self,
        inspection: &Inspection,
        version: &str,
        repository: Option<&str>,
        actions: &ActionsContext,
        cancellation: &dyn Cancellation,
    ) -> Result<Publication>;
}

/// Git adapter, composed with a dyn Runner at the command boundary.
pub struct GitCheckout {
    /// Git runner with bounded streams and command cancellation.
    pub runner: Arc<dyn Runner>,
    /// Identify build outputs for guidance and authenticate reservation exclusions.
    pub hints: Arc<dyn OutputHints>,
}

impl Checkout for GitCheckout {
    fn inspect(
        &self,
        directory: &Path,
        owned: &[PathBuf],
        cancellation: &dyn Cancellation,
    ) -> Result<Inspection> {
        let root = self.revision(directory, &["rev-parse", "--show-toplevel"], cancellation)?;
        let root = PathBuf::from(line(&root)?);
        let head = self.revision(
            &root,
            &["rev-parse", "--verify", "HEAD^{commit}"],
            cancellation,
        )?;
        let head_sha = line(&head)?.to_owned();
        if !hexadecimal(&head_sha, &[40, 64]) {
            return Err(Error::Checkout);
        }
        let status = self.run(
            &root,
            &[
                "status",
                "--porcelain=v1",
                "-z",
                "--untracked-files=all",
                "--ignore-submodules=none",
                "--renames",
            ],
            cancellation,
        )?;
        let paths = status_paths(&status)?;
        let reservations = if paths.iter().any(|path| {
            path.split('/')
                .any(|part| part == ".mokly-export-reservations")
        }) {
            self.hints.reservations(&root, &paths)
        } else {
            Vec::new()
        };
        let changed_paths: Vec<_> = paths
            .into_iter()
            .filter(|path| {
                let candidate = root.join(path);
                !owned.iter().any(|owned| candidate.starts_with(owned))
                    && !reservations.iter().any(|directory| {
                        path == directory
                            || path
                                .strip_prefix(directory)
                                .is_some_and(|suffix| suffix.starts_with('/'))
                    })
            })
            .collect();
        let build_directories = if changed_paths.is_empty() {
            Vec::new()
        } else {
            self.hints.directories(&root, &changed_paths)
        };
        Ok(Inspection {
            build_directories,
            root,
            head_sha,
            changed_paths,
        })
    }

    fn publication(
        &self,
        inspection: &Inspection,
        version: &str,
        repository: Option<&str>,
        actions: &ActionsContext,
        cancellation: &dyn Cancellation,
    ) -> Result<Publication> {
        let repository = match repository {
            Some(repository) => Repository::parse(repository).upload()?,
            None => {
                let remotes = self.run(&inspection.root, &["remote"], cancellation)?;
                let remotes = std::str::from_utf8(&remotes)
                    .ok()
                    .ok_or(Error::Repository)?;
                let names: Vec<_> = remotes.lines().filter(|name| !name.is_empty()).collect();
                let name = if names.contains(&"origin") {
                    "origin"
                } else if names.len() == 1 {
                    names[0]
                } else {
                    return Err(Error::Repository);
                };
                let remote = self.run(
                    &inspection.root,
                    &["remote", "get-url", "--", name],
                    cancellation,
                )?;
                Repository::remote(line(&remote)?).upload()?
            }
        };
        let symbolic = match self.run(
            &inspection.root,
            &["symbolic-ref", "--quiet", "--short", "HEAD"],
            cancellation,
        ) {
            Ok(bytes) => line(&bytes)?.to_owned(),
            Err(Error::Git {
                source:
                    error::Error::CommandFailed {
                        status: Some(1), ..
                    },
            }) => "HEAD".to_owned(),
            Err(error) => return Err(error),
        };
        let branch = actions.branch(&symbolic);
        if !text(&branch, 255) {
            return Err(Error::Repository);
        }
        Ok(Publication {
            mokly_version: version.to_owned(),
            repository,
            branch,
            head_sha: inspection.head_sha.clone(),
            pull_request: actions.pull_request(),
        })
    }
}

impl GitCheckout {
    fn revision(
        &self,
        directory: &Path,
        args: &[&str],
        cancellation: &dyn Cancellation,
    ) -> Result<Vec<u8>> {
        match self.run(directory, args, cancellation) {
            Err(Error::Git { .. }) => Err(Error::Checkout),
            result => result,
        }
    }

    fn run(
        &self,
        directory: &Path,
        args: &[&str],
        cancellation: &dyn Cancellation,
    ) -> Result<Vec<u8>> {
        let request = Request {
            directory: directory.to_owned(),
            args: args.iter().map(OsString::from).collect(),
            output_limit: DEFAULT_OUTPUT_LIMIT,
        };
        match self.runner.run_cancellable(&request, cancellation) {
            Ok(output) => Ok(output.stdout),
            Err(error::Error::Cancelled) => Err(Error::Cancelled),
            Err(source) => Err(Error::Git { source }),
        }
    }
}

fn line(bytes: &[u8]) -> Result<&str> {
    let Ok(value) = std::str::from_utf8(bytes) else {
        return Err(Error::Checkout);
    };
    let value = value.strip_suffix('\n').unwrap_or(value);
    if value.is_empty() {
        return Err(Error::Checkout);
    }
    Ok(value)
}

/// Parse porcelain v1 -z, retaining both rename or copy paths and escaping no data yet.
pub fn status_paths(bytes: &[u8]) -> Result<Vec<String>> {
    if !bytes.is_empty() && bytes.last() != Some(&0) {
        return Err(Error::Checkout);
    }
    let mut records = bytes.split(|byte| *byte == 0).peekable();
    let mut paths = BTreeSet::new();
    while let Some(record) = records.next() {
        if record.is_empty() {
            continue;
        }
        if record.len() < 4 || record[2] != b' ' {
            return Err(Error::Checkout);
        }
        let path = String::from_utf8_lossy(&record[3..]).into_owned();
        paths.insert(path);
        if record[..2].iter().any(|byte| matches!(byte, b'R' | b'C')) {
            let Some(source) = records.next().filter(|record| !record.is_empty()) else {
                return Err(Error::Checkout);
            };
            paths.insert(String::from_utf8_lossy(source).into_owned());
        }
    }
    let mut paths: Vec<_> = paths.into_iter().collect();
    paths.sort_by(|left, right| left.encode_utf16().cmp(right.encode_utf16()));
    Ok(paths)
}
