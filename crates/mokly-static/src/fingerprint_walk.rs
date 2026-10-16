//! Explicit enter/leave tasks retain fingerprint order and ancestor confinement.

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};

use crate::filesystem::{Entry, Files};

enum Work {
    Enter(PathBuf, PathBuf),
    Leave(PathBuf),
    Link(PathBuf, String),
}

pub(crate) fn capture(
    files: &dyn Files,
    root: &Path,
    logical: &Path,
    excluded: &[PathBuf],
) -> BTreeMap<PathBuf, String> {
    let mut output = BTreeMap::new();
    let mut ancestors = BTreeSet::new();
    let mut pending = vec![Work::Enter(root.into(), logical.into())];
    while let Some(work) = pending.pop() {
        let (physical, logical) = match work {
            Work::Enter(physical, logical) => (physical, logical),
            Work::Leave(path) => {
                ancestors.remove(&path);
                continue;
            }
            Work::Link(path, link) => {
                let content = output.remove(&path).unwrap_or_default();
                output.insert(path, format!("{link}:{content}"));
                continue;
            }
        };
        if excluded.iter().any(|path| physical.starts_with(path)) {
            continue;
        }
        let entry = match files.entry(&physical) {
            Ok(entry) => entry,
            Err(_) => {
                output.insert(logical, "unreadable".into());
                continue;
            }
        };
        match entry {
            Some(Entry::Directory(_)) => {
                if !ancestors.insert(physical.clone()) {
                    continue;
                }
                pending.push(Work::Leave(physical.clone()));
                match files.children(&physical) {
                    Ok(children) => {
                        for child in children.into_iter().rev() {
                            let Some(name) = child.file_name() else {
                                continue;
                            };
                            if !skip(name.to_str()) {
                                let target = logical.join(name);
                                pending.push(Work::Enter(child, target));
                            }
                        }
                    }
                    Err(_) => {
                        output.insert(logical, "unreadable".into());
                    }
                }
            }
            Some(Entry::File(_)) => {
                output.insert(
                    logical,
                    files
                        .hash(&physical)
                        .unwrap_or_else(|_| "unreadable".into()),
                );
            }
            Some(Entry::Unsafe) => {
                if let Ok(target) = files.link(&physical) {
                    let link = format!("link:{target:?}");
                    output.insert(logical.clone(), link.clone());
                    if let Ok(real) = files.project(&physical)
                        && real.starts_with(root)
                        && real != physical
                    {
                        pending.push(Work::Link(logical.clone(), link));
                        pending.push(Work::Enter(real, logical));
                    }
                }
            }
            None => {}
        }
    }
    output
}

fn skip(name: Option<&str>) -> bool {
    matches!(
        name,
        Some(
            ".git"
                | ".context"
                | ".mokly-export-reservations"
                | "node_modules"
                | "target"
                | "dist"
                | "mokly-static"
                | "coverage"
                | "test-results"
                | "playwright-report"
        )
    )
}
