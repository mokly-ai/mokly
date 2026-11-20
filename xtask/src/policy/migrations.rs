//! Append-only migration lock and SQL layout validation.

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use std::result;

use crate::policy::diagnostic::Violation;

/// FNV-1a 64-bit checksum over the exact SQL file bytes.
pub(super) fn checksum(bytes: &[u8]) -> u64 {
    bytes.iter().fold(0xcbf29ce484222325, |hash, byte| {
        (hash ^ u64::from(*byte)).wrapping_mul(0x100000001b3)
    })
}

fn parse(text: &str) -> result::Result<BTreeMap<PathBuf, u64>, Vec<Violation>> {
    let mut entries = BTreeMap::new();
    let mut violations = Vec::new();
    let mut previous = None;
    if !text.is_empty() && !text.starts_with('#') {
        violations.push(Violation::InvalidLock(1));
    }
    for (index, line) in text.lines().enumerate() {
        if line.starts_with('#') || line.is_empty() {
            continue;
        }
        let Some((hash, path)) = line.split_once(' ') else {
            violations.push(Violation::InvalidLock(index + 1));
            continue;
        };
        let hash = hash.strip_prefix("fnv1a64:").unwrap_or_default();
        if hash.len() != 16
            || !hash
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
            || !valid_path(Path::new(path))
        {
            violations.push(Violation::InvalidLock(index + 1));
            continue;
        }
        let Ok(hash) = u64::from_str_radix(hash, 16) else {
            violations.push(Violation::InvalidLock(index + 1));
            continue;
        };
        if previous.is_some_and(|previous| previous >= path) {
            violations.push(Violation::LockOrder);
        }
        previous = Some(path);
        entries.insert(PathBuf::from(path), hash);
    }
    if violations.is_empty() {
        Ok(entries)
    } else {
        Err(violations)
    }
}

fn valid_path(path: &Path) -> bool {
    let Ok(relative) = path.strip_prefix("crates/mkc-db/migrations") else {
        return false;
    };
    let parts: Vec<_> = relative.iter().collect();
    if parts.len() != 2 || !(parts[1] == "up.sql" || parts[1] == "down.sql") {
        return false;
    }
    let Some(directory) = parts[0].to_str() else {
        return false;
    };
    let Some((timestamp, description)) = directory.split_once('_') else {
        return false;
    };
    timestamp.len() == 12
        && timestamp.bytes().all(|byte| byte.is_ascii_digit())
        && !description.is_empty()
        && description
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'_')
}

pub(super) fn validate(lock: &str, baseline: &str, files: &[(PathBuf, Vec<u8>)]) -> Vec<Violation> {
    let current = match parse(lock) {
        Ok(entries) => entries,
        Err(violations) => return violations,
    };
    let baseline = match parse(baseline) {
        Ok(entries) => entries,
        Err(violations) => return violations,
    };
    let mut violations = Vec::new();
    for (path, hash) in &baseline {
        if current.get(path) != Some(hash) {
            violations.push(Violation::ChangedBaseline(path.clone()));
        }
    }
    if let Some(last) = baseline.keys().last() {
        for path in current.keys() {
            if path < last && !baseline.contains_key(path) {
                violations.push(Violation::ChangedBaseline(path.clone()));
            }
        }
    }
    let sql: BTreeMap<_, _> = files
        .iter()
        .filter(|(path, _)| path.extension().is_some_and(|ext| ext == "sql"))
        .map(|(path, bytes)| (path.clone(), checksum(bytes)))
        .collect();
    for (path, hash) in &current {
        if sql.get(path) != Some(hash) {
            violations.push(Violation::ChangedMigration(path.clone()));
        }
    }
    let mut directories = BTreeSet::new();
    for path in sql.keys() {
        if !current.contains_key(path) {
            violations.push(Violation::UnlockedMigration(path.clone()));
        }
        if !valid_path(path) {
            violations.push(Violation::MigrationLayout(path.clone()));
        }
        if let Some(parent) = path.parent() {
            directories.insert(parent);
        }
    }
    for directory in directories {
        if !sql.contains_key(&directory.join("up.sql"))
            || !sql.contains_key(&directory.join("down.sql"))
        {
            violations.push(Violation::MigrationLayout(directory.to_owned()));
        }
    }
    violations
}

#[cfg(test)]
#[path = "_tests_/migrations_tests.rs"]
mod migrations_tests;
