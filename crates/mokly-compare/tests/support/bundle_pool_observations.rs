//! Read-only cache listings and actual captured-input differences aid diagnosis.

use std::collections::BTreeSet;
use std::fs;
use std::path::Path;

use mokly_sidecar::compiled::ReuseEvidence;

/// Report the first unequal input recorded by the two actual sidecar captures.
pub(super) fn first_evidence_difference(before: &ReuseEvidence, after: &ReuseEvidence) -> String {
    let paths = before
        .inputs
        .keys()
        .chain(after.inputs.keys())
        .collect::<BTreeSet<_>>();
    let difference = paths.into_iter().find_map(|path| {
        let previous = before.inputs.get(path);
        let current = after.inputs.get(path);
        (previous != current).then_some((path, previous, current))
    });
    format!("{difference:?}")
}

/// Return sorted relative paths, kinds, and sizes, including diagnostic read errors.
pub(super) fn cache_files(cache: &Path) -> Vec<String> {
    let mut files = Vec::new();
    let mut pending = vec![cache.to_path_buf()];
    while let Some(path) = pending.pop() {
        let relative = path
            .strip_prefix(cache)
            .unwrap_or(&path)
            .display()
            .to_string();
        match fs::symlink_metadata(&path) {
            Ok(metadata) => {
                files.push(format!(
                    "{relative}: {:?}, {} bytes",
                    metadata.file_type(),
                    metadata.len()
                ));
                if metadata.is_dir() {
                    match fs::read_dir(&path) {
                        Ok(entries) => {
                            for entry in entries {
                                match entry {
                                    Ok(entry) => pending.push(entry.path()),
                                    Err(error) => {
                                        files.push(format!("{relative}: read entry: {error}"))
                                    }
                                }
                            }
                        }
                        Err(error) => files.push(format!("{relative}: read directory: {error}")),
                    }
                }
            }
            Err(error) => files.push(format!("{relative}: metadata: {error}")),
        }
    }
    files.sort();
    files
}
