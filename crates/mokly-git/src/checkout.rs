//! Checkout-converted bytes retain the user's real repository filter context.

use std::collections::BTreeMap;
use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::time::Duration;

use crate::checkout_output::{conversion, decode_batch};
use crate::command::{Cancellation, DEFAULT_OUTPUT_LIMIT, DEFAULT_STDERR_LIMIT, Request};
use crate::error::{Error, IoResult, Result};
use crate::identity::{ObjectId, RepoPath};
use crate::repository::GitRepository;
use crate::tree::{Entry, Limits};

const FILTER_TIMEOUT: Duration = Duration::from_secs(120);

struct Active;
impl Cancellation for Active {
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
        let checkout = self.checkout(entries, commit, limits)?;
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
        self.ensure_checkout_objects(commit, std::slice::from_ref(entry))?;
        let converted = self.converted_paths(commit, std::slice::from_ref(entry))?;
        let request = request(
            self,
            commit,
            conversion_args(entry, converted.contains(&entry.path)),
            Vec::new(),
        );
        conversion(
            self.runner.digest_cancellable_with_environment_timeout(
                &request,
                &Active,
                &[("LC_ALL", "C".into())],
                FILTER_TIMEOUT,
            ),
            std::slice::from_ref(entry),
        )
    }

    pub(crate) fn checkout(
        &self,
        entries: &[Entry],
        commit: &ObjectId,
        limits: Limits,
    ) -> Result<Checkout> {
        validate_entries(entries, limits)?;
        self.ensure_checkout_objects(commit, entries)?;
        conversion(Checkout::new(self, commit, entries, limits.bytes), entries)
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
    files: BTreeMap<RepoPath, PathBuf>,
}

impl Checkout {
    fn new(
        repository: &GitRepository,
        commit: &ObjectId,
        entries: &[Entry],
        limit: usize,
    ) -> Result<Self> {
        let root = tempfile::Builder::new()
            .prefix("mokly-git-converted-")
            .tempdir()
            .git()?;
        let mut files = BTreeMap::new();
        let converted = repository.converted_paths(commit, entries)?;
        let batch_bytes = entries
            .iter()
            .fold(0usize, |total, entry| total.saturating_add(entry.size));
        let raw: Vec<_> = entries
            .iter()
            .filter(|entry| !converted.contains(&entry.path) && batch_bytes <= 48 * 1024 * 1024)
            .cloned()
            .collect();
        let mut remaining = limit;
        if !raw.is_empty() {
            let input = raw
                .iter()
                .map(|entry| format!("{}\0", entry.object))
                .collect::<String>()
                .into_bytes();
            let request = request(
                repository,
                commit,
                vec!["--batch".into(), "-Z".into()],
                input,
            );
            let output = repository.runner.run_cancellable_with_environment_timeout(
                &request,
                &Active,
                &[("LC_ALL", "C".into())],
                FILTER_TIMEOUT,
            )?;
            let bytes = decode_batch(&output.stdout, &raw, remaining)?;
            for (index, (entry, bytes)) in raw.iter().zip(bytes).enumerate() {
                let path = root.path().join(format!("raw-{index}"));
                fs::File::create(&path).git()?.write_all(bytes).git()?;
                remaining -= bytes.len();
                files.insert(entry.path.clone(), path);
            }
        }
        for (index, entry) in entries.iter().enumerate() {
            if files.contains_key(&entry.path) {
                continue;
            }
            let path = root.path().join(format!("converted-{index}"));
            let mut output = fs::File::create(&path).git()?;
            let request = request(
                repository,
                commit,
                conversion_args(entry, converted.contains(&entry.path)),
                Vec::new(),
            );
            repository
                .runner
                .stream_cancellable_with_environment_timeout(
                    &request,
                    &Active,
                    &[("LC_ALL", "C".into())],
                    FILTER_TIMEOUT,
                    &mut output,
                    remaining,
                )?;
            remaining = remaining.saturating_sub(output.metadata().git()?.len() as usize);
            files.insert(entry.path.clone(), path);
        }
        Ok(Self { _root: root, files })
    }

    pub(crate) fn file(&self, path: &RepoPath) -> Result<PathBuf> {
        self.files.get(path).cloned().ok_or(Error::MalformedOutput)
    }

    fn read(&self, path: &RepoPath, limit: usize) -> Result<Vec<u8>> {
        let file = self.file(path)?;
        if fs::metadata(&file).git()?.len() > limit as u64 {
            return Err(Error::ByteLimit { limit });
        }
        let mut bytes = Vec::new();
        fs::File::open(file)
            .git()?
            .take(limit.saturating_add(1) as u64)
            .read_to_end(&mut bytes)
            .git()?;
        if bytes.len() > limit {
            return Err(Error::ByteLimit { limit });
        }
        Ok(bytes)
    }
}

fn request(
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

fn conversion_args(entry: &Entry, converted: bool) -> Vec<String> {
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
