//! Stream plan-only directory checks against a bounded candidate index.

use std::collections::{BTreeMap, BTreeSet};
use std::ffi::OsStr;
use std::fs;
use std::io::{self, ErrorKind};
use std::path::Path;

use mokly_sidecar::compiled::{PhysicalEntryKind, PhysicalInput};

use crate::physical_inputs::real_path;

pub(crate) fn matches(path: &Path, expected: &PhysicalInput, names: &[String]) -> io::Result<bool> {
    let PhysicalInput::Directory { entries } = expected else {
        return Ok(false);
    };
    let mut saved = BTreeMap::new();
    let mut folded = BTreeSet::new();
    for entry in entries {
        if !entry.name.is_ascii() || !folded.insert(entry.name.to_ascii_lowercase()) {
            return Ok(false);
        }
        if names
            .binary_search(&entry.name.to_ascii_lowercase())
            .is_ok()
        {
            saved.insert(entry.name.as_str(), (saved.len(), entry));
        }
    }
    let mut seen = vec![false; saved.len()];
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let target = if file_type.is_symlink() {
            Some(real_path(&entry.path())?)
        } else {
            None
        };
        let file_name = entry.file_name();
        let name = utf8_name(&file_name)?;
        if !name.is_ascii() {
            return Ok(false);
        }
        if names.binary_search(&name.to_ascii_lowercase()).is_err() {
            continue;
        }
        let Some((index, expected)) = saved.get(name) else {
            return Ok(false);
        };
        let kind = if file_type.is_symlink() {
            PhysicalEntryKind::Link
        } else if file_type.is_file() {
            PhysicalEntryKind::File
        } else if file_type.is_dir() {
            PhysicalEntryKind::Directory
        } else {
            PhysicalEntryKind::Other
        };
        if seen[*index] || expected.kind != kind || expected.target != target {
            return Ok(false);
        }
        seen[*index] = true;
    }
    Ok(seen.into_iter().all(|value| value) && Path::new(&real_path(path)?) == path)
}

fn utf8_name(name: &OsStr) -> io::Result<&str> {
    name.to_str().ok_or(io::Error::from(ErrorKind::InvalidData))
}

#[cfg(test)]
#[path = "_tests_/plan_directory_tests.rs"]
mod plan_directory_tests;
