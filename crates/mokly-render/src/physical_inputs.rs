//! Read cache-only filesystem observations outside the logical source tree.

use std::collections::{BTreeMap, BTreeSet};
use std::fs::{self, File};
use std::io::{self, ErrorKind};
use std::path::Path;

use mokly_catalogue::config::normalize;
use mokly_sidecar::compiled::{PhysicalEntry, PhysicalEntryKind, PhysicalInput, ReuseEvidence};
use mokly_source_interface::error::{Result, SourceError};
use mokly_source_interface::stream::{OpenedSource, SourceStream};

use crate::plan_directory;

/// Physical reads used only to decide whether an earlier compilation remains current.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = PhysicalInputsMock))]
pub trait PhysicalInputs: Send + Sync {
    /// Compare one observation. Read errors must reject reuse, including recorded absence.
    /// The adjacent inputs authorize the lexical target of a dangling link.
    fn matches(
        &self,
        path: &Path,
        expected: &PhysicalInput,
        inputs: &BTreeMap<String, PhysicalInput>,
    ) -> Result<bool>;
    /// Compare a plan directory using proved names. Other readers retain full checks.
    fn matches_candidates(
        &self,
        path: &Path,
        expected: &PhysicalInput,
        names: &[String],
        inputs: &BTreeMap<String, PhysicalInput>,
    ) -> Result<bool> {
        let _ = names;
        self.matches(path, expected, inputs)
    }
}

/// Native filesystem reader. File content checks retain one 64 KiB streaming buffer.
pub struct SystemPhysicalInputs;

impl PhysicalInputs for SystemPhysicalInputs {
    fn matches(
        &self,
        path: &Path,
        expected: &PhysicalInput,
        inputs: &BTreeMap<String, PhysicalInput>,
    ) -> Result<bool> {
        checked_result(path, self.read(path, expected, inputs))
    }

    fn matches_candidates(
        &self,
        path: &Path,
        expected: &PhysicalInput,
        names: &[String],
        inputs: &BTreeMap<String, PhysicalInput>,
    ) -> Result<bool> {
        if !matches!(expected, PhysicalInput::Directory { .. }) {
            return self.matches(path, expected, inputs);
        }
        checked_result(path, plan_directory::matches(path, expected, names))
    }
}

impl SystemPhysicalInputs {
    fn read(
        &self,
        path: &Path,
        expected: &PhysicalInput,
        inputs: &BTreeMap<String, PhysicalInput>,
    ) -> io::Result<bool> {
        match expected {
            PhysicalInput::FilePath => {
                Ok(fs::metadata(path)?.is_file() && Path::new(&real_path(path)?) == path)
            }
            PhysicalInput::Absent => match fs::symlink_metadata(path) {
                Err(error)
                    if matches!(error.kind(), ErrorKind::NotFound | ErrorKind::NotADirectory) =>
                {
                    Ok(true)
                }
                Err(error) => Err(error),
                Ok(_) => Ok(false),
            },
            PhysicalInput::File { digest } => {
                if Path::new(&real_path(path)?) != path {
                    return Ok(false);
                }
                let file = File::open(path)?;
                let metadata = file.metadata()?;
                if !metadata.is_file() {
                    return Ok(false);
                }
                let mut stream = OpenedSource {
                    reader: Box::new(file),
                    length: metadata.len(),
                };
                Ok(stream.copy_verified(path, digest, &mut io::sink()).is_ok())
            }
            PhysicalInput::Directory { entries } => {
                let mut actual = Vec::new();
                for entry in fs::read_dir(path)? {
                    if actual.len() >= entries.len() {
                        return Ok(false);
                    }
                    let entry = entry?;
                    let kind = entry.file_type()?;
                    actual.push(PhysicalEntry {
                        name: entry
                            .file_name()
                            .to_str()
                            .ok_or(io::Error::from(ErrorKind::InvalidData))?
                            .to_owned(),
                        kind: if kind.is_symlink() {
                            PhysicalEntryKind::Link
                        } else if kind.is_file() {
                            PhysicalEntryKind::File
                        } else if kind.is_dir() {
                            PhysicalEntryKind::Directory
                        } else {
                            PhysicalEntryKind::Other
                        },
                        target: if kind.is_symlink() {
                            Some(real_path(&entry.path())?)
                        } else {
                            None
                        },
                    });
                }
                actual.sort_by(|a, b| a.name.cmp(&b.name));
                Ok(&actual == entries && Path::new(&real_path(path)?) == path)
            }
            PhysicalInput::Link { target } => {
                if !fs::symlink_metadata(path)?.file_type().is_symlink() {
                    return Ok(false);
                }
                match real_path(path) {
                    Ok(actual) => Ok(actual == *target),
                    Err(error)
                        if matches!(
                            error.kind(),
                            ErrorKind::NotFound | ErrorKind::NotADirectory
                        ) =>
                    {
                        Ok(matches!(inputs.get(target), Some(PhysicalInput::Absent))
                            && lexical_link_target(path)? == *target)
                    }
                    Err(error) => Err(error),
                }
            }
        }
    }
}

fn lexical_link_target(path: &Path) -> io::Result<String> {
    let mut current = path.to_owned();
    let mut seen = BTreeSet::new();
    loop {
        if !seen.insert(current.clone()) {
            return Err(io::Error::from(ErrorKind::InvalidData));
        }
        match fs::symlink_metadata(&current) {
            Ok(metadata) if metadata.file_type().is_symlink() => {
                let target = fs::read_link(&current)?;
                current = normalize(&current.parent().unwrap_or(&current).join(target));
                current = dunce::simplified(&current).to_owned();
            }
            Ok(_) => break,
            Err(error)
                if matches!(error.kind(), ErrorKind::NotFound | ErrorKind::NotADirectory) =>
            {
                break;
            }
            Err(error) => return Err(error),
        }
    }
    match current.into_os_string().into_string() {
        Ok(target) => Ok(target),
        Err(_) => Err(io::Error::from(ErrorKind::InvalidData)),
    }
}

/// Keep the physical input path and operation on each native read error.
pub(crate) fn checked_result<T>(path: &Path, result: io::Result<T>) -> Result<T> {
    match result {
        Ok(value) => Ok(value),
        Err(source) => Err(SourceError::Io {
            operation: "check physical compilation input",
            path: path.into(),
            source,
        }),
    }
}

pub(crate) fn real_path(path: &Path) -> io::Result<String> {
    let real = dunce::canonicalize(path)?;
    match real.into_os_string().into_string() {
        Ok(real) => Ok(real),
        Err(_) => Err(io::Error::from(ErrorKind::InvalidData)),
    }
}

pub(crate) fn current(evidence: &ReuseEvidence, reader: &dyn PhysicalInputs) -> bool {
    evidence.captured() && entries_current(evidence, reader)
}

/// Compare eligible marked file observations without admitting them to full reuse.
pub(crate) fn marked_current(evidence: &ReuseEvidence, reader: &dyn PhysicalInputs) -> bool {
    evidence.serve_edit() && entries_current(evidence, reader)
}

fn entries_current(evidence: &ReuseEvidence, reader: &dyn PhysicalInputs) -> bool {
    evidence.inputs.iter().all(|(path, expected)| {
        reader
            .matches(Path::new(path), expected, &evidence.inputs)
            .unwrap_or(false)
    })
}

#[cfg(test)]
#[path = "_tests_/physical_inputs_tests.rs"]
mod physical_inputs_tests;
