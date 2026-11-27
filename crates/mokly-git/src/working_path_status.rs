//! Working path status from exact index entries and Git exclude rules.

use std::collections::{BTreeMap, BTreeSet};
use std::ffi::OsString;

use crate::batches::{self, MAX_ARGUMENT_BYTES, MAX_ARGUMENTS};
use crate::changes::fields;
use crate::error::{Error, Result};
use crate::identity::RepoPath;
use crate::repository::{GitRepository, WorkingPathStatus};

impl GitRepository {
    pub(crate) fn classify_working_paths(
        &self,
        paths: &[RepoPath],
    ) -> Result<Vec<WorkingPathStatus>> {
        if paths.is_empty() {
            return Ok(Vec::new());
        }
        let mut working = Vec::with_capacity(paths.len());
        for path in paths {
            self.runner.checkpoint()?;
            working.push(self.disk.working_path(&self.directory, path)?);
        }
        let mut statuses: Vec<_> = {
            let entries = working.iter().map(|path| path.entry.as_str()).collect();
            let output =
                self.file_listing(&["-z", "--cached", "--format=%(objectmode)%x09%(path)"])?;
            let index = IndexPaths::parse(&output, &entries)?;
            working
                .iter()
                .map(|path| index.status(&path.entry))
                .collect()
        };

        let checkouts = working
            .iter()
            .zip(&statuses)
            .filter(|(_, status)| status.is_none())
            .filter_map(|(path, _)| path.checkout_candidate.as_ref());
        let nested = self.other_paths(checkouts, false)?;
        for (path, status) in working.iter().zip(&mut statuses) {
            if status.is_none()
                && let Some(root) = nested.directory(&path.entry)
            {
                *status = Some(WorkingPathStatus::NestedRepository(root.clone()));
            }
        }

        let unchecked = working
            .iter()
            .zip(&statuses)
            .filter(|(_, status)| status.is_none())
            .map(|(path, _)| path.checkout_candidate.as_ref().unwrap_or(&path.entry));
        let ignored = self.other_paths(unchecked, true)?;
        self.runner.checkpoint()?;
        Ok(working
            .into_iter()
            .zip(statuses)
            .map(|(path, status)| {
                status.unwrap_or_else(|| {
                    if ignored.files.contains(path.entry.as_str())
                        || ignored.directory(&path.entry).is_some()
                    {
                        WorkingPathStatus::Ignored
                    } else {
                        WorkingPathStatus::Untracked
                    }
                })
            })
            .collect())
    }

    /// Include paths with index type conflicts so a nested checkout that
    /// replaces an indexed file still appears with its directory marker.
    fn other_paths<'a>(
        &self,
        paths: impl Iterator<Item = &'a RepoPath>,
        ignored: bool,
    ) -> Result<OtherPaths> {
        let paths: BTreeSet<_> = paths.map(|path| OsString::from(path.as_str())).collect();
        let paths: Vec<_> = paths.into_iter().collect();
        let mut flags = vec!["-z", "--others", "--killed", "--exclude-standard"];
        if ignored {
            flags.push("--ignored");
        }
        flags.push("--");
        let mut request = self.file_listing_request(&flags);
        let mut listing = OtherPaths::default();
        for args in batches::split(&request.args, &paths, MAX_ARGUMENTS, MAX_ARGUMENT_BYTES)? {
            request.args = args;
            listing.add(&self.runner.run(&request)?.stdout, ignored)?;
        }
        Ok(listing)
    }
}

#[derive(Default)]
struct IndexPaths<'a> {
    tracked: BTreeSet<&'a str>,
    submodules: BTreeMap<&'a str, RepoPath>,
}

impl<'a> IndexPaths<'a> {
    fn parse(output: &'a [u8], entries: &BTreeSet<&str>) -> Result<Self> {
        let mut index = Self::default();
        for field in fields(output)? {
            let Ok(record) = std::str::from_utf8(field) else {
                continue;
            };
            let (mode, path) = record.split_once('\t').ok_or(Error::MalformedOutput)?;
            if mode == "160000" {
                index.submodules.insert(path, RepoPath::parse(path)?);
            } else if entries.contains(path) {
                index.tracked.insert(path);
            }
        }
        Ok(index)
    }

    fn status(&self, path: &RepoPath) -> Option<WorkingPathStatus> {
        if self.tracked.contains(path.as_str()) {
            return Some(WorkingPathStatus::Tracked);
        }
        path.prefixes()
            .find_map(|prefix| self.submodules.get(prefix))
            .map(|root| WorkingPathStatus::Submodule(root.clone()))
    }
}

#[derive(Default)]
struct OtherPaths {
    files: BTreeSet<String>,
    directories: BTreeMap<String, RepoPath>,
}

impl OtherPaths {
    fn add(&mut self, output: &[u8], keep_files: bool) -> Result<()> {
        for field in fields(output)? {
            let Ok(path) = std::str::from_utf8(field) else {
                continue;
            };
            if let Some(directory) = path.strip_suffix('/') {
                self.directories
                    .insert(directory.to_owned(), RepoPath::parse(directory)?);
            } else if keep_files {
                self.files.insert(path.to_owned());
            }
        }
        Ok(())
    }

    fn directory(&self, path: &RepoPath) -> Option<&RepoPath> {
        path.prefixes()
            .find_map(|prefix| self.directories.get(prefix))
    }
}
