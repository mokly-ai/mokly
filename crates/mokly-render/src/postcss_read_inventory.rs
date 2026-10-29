//! Select read witnesses without changing plugin privacy or catalogue membership.

use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;
use std::sync::{Arc, Condvar, Mutex, MutexGuard};

use mokly_catalogue::config::{normalize, relative};
use mokly_sidecar::postcss_evidence::{Evidence, Read};
use mokly_source_interface::read_evidence::{FileIdentity, ReadBaseline, ReadEvidence};
use mokly_source_interface::tree::SourceTree;

use crate::postcss_inventory::Inventory;
use crate::side::SideInputs;
use crate::source_paths::SOURCE_INPUT_PREFIX;

/// The late digests of one context's modules. The attempt's tree keeps each answer, so a
/// context projects and hashes each module once. The tree calls run outside the map lock.
#[derive(Default)]
pub(crate) struct ModuleDigests(Mutex<BTreeMap<String, Arc<ModuleCell>>>);

struct ModuleCell {
    state: Mutex<ModuleState>,
    ready: Condvar,
}

enum ModuleState {
    Running,
    Ready(String),
    Failed,
}

impl ModuleDigests {
    fn late(&self, tree: &dyn SourceTree, root: &Path, name: &str) -> Option<String> {
        let cell = {
            let mut known = self.known();
            if let Some(cell) = known.get(name) {
                (cell.clone(), false)
            } else {
                let cell = Arc::new(ModuleCell {
                    state: Mutex::new(ModuleState::Running),
                    ready: Condvar::new(),
                });
                known.insert(name.into(), cell.clone());
                (cell, true)
            }
        };
        if !cell.1 {
            let mut state = cell
                .0
                .state
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            loop {
                match &*state {
                    ModuleState::Running => {
                        state = cell
                            .0
                            .ready
                            .wait(state)
                            .unwrap_or_else(|error| error.into_inner());
                    }
                    ModuleState::Ready(digest) => return Some(digest.clone()),
                    ModuleState::Failed => {
                        drop(state);
                        self.remove_failed(name, &cell.0);
                        break;
                    }
                }
            }
        }
        let digest = match tree.project(&root.join(name)).ok() {
            Some(Some(node)) => tree.digest(&node.identity).ok(),
            Some(None) | None => None,
        };
        let mut state = cell
            .0
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if let Some(digest) = &digest {
            *state = ModuleState::Ready(digest.clone());
        } else {
            *state = ModuleState::Failed;
        }
        cell.0.ready.notify_all();
        drop(state);
        if digest.is_none() {
            self.remove_failed(name, &cell.0);
        }
        digest
    }

    fn remove_failed(&self, name: &str, cell: &Arc<ModuleCell>) {
        let mut known = self.known();
        if known
            .get(name)
            .is_some_and(|current| Arc::ptr_eq(current, cell))
        {
            known.remove(name);
        }
    }

    fn known(&self) -> MutexGuard<'_, BTreeMap<String, Arc<ModuleCell>>> {
        self.0.lock().unwrap_or_else(|error| error.into_inner())
    }
}

pub(crate) fn collect(
    tree: &dyn SourceTree,
    root: &Path,
    side: &SideInputs,
    inventory: &Inventory,
    evidence: &Evidence,
    digests: &ModuleDigests,
) -> ReadEvidence {
    let mut result = ReadEvidence::default();
    for (path, digest) in &inventory.inputs {
        result.insert(
            format!("{SOURCE_INPUT_PREFIX}{path}"),
            ReadBaseline::Late(digest.clone()),
        );
    }
    let modules: BTreeSet<_> = evidence
        .modules
        .iter()
        .filter_map(|file| logical(file, side))
        .collect();
    for name in &modules {
        if let Some(digest) = digests.late(tree, root, name) {
            result.insert(name.clone(), ReadBaseline::Late(digest));
        }
    }
    for read in &evidence.reads {
        let (path, baseline) = match read {
            Read::WholeFile {
                path,
                digest,
                identity,
            } => (
                path,
                match identity {
                    Some(identity) => ReadBaseline::ObservedFile {
                        digest: digest.clone(),
                        identity: file_identity(identity),
                    },
                    None => ReadBaseline::ObservedWholeFile(digest.clone()),
                },
            ),
            Read::ByteRange {
                path,
                digest,
                offset,
                length,
                eof,
                identity,
            } => (
                path,
                ReadBaseline::ObservedRange {
                    offset: *offset,
                    length: *length,
                    eof: *eof,
                    digest: digest.clone(),
                    identity: identity.as_ref().map(file_identity),
                },
            ),
        };
        let physical = normalize(Path::new(path));
        if physical.starts_with(&side.source_root) {
            let name = relative(&physical, &side.source_root);
            if inventory.inputs.contains_key(&name) {
                result.insert(format!("{SOURCE_INPUT_PREFIX}{name}"), baseline.clone());
            }
        }
        if let Some(name) = logical(path, side)
            && modules.contains(&name)
        {
            result.insert(name, baseline);
        }
    }
    result
}

fn file_identity(identity: &mokly_sidecar::postcss_evidence::FileIdentity) -> FileIdentity {
    FileIdentity {
        object: identity.object.clone(),
        canonical: identity
            .canonical
            .as_ref()
            .map(|name| normalize(Path::new(name))),
    }
}

fn logical(file: &str, side: &SideInputs) -> Option<String> {
    let path = normalize(Path::new(file));
    side.logical_dependency(&path).or_else(|| {
        path.starts_with(&side.source_root)
            .then(|| relative(&path, &side.source_root))
    })
}

#[cfg(test)]
#[path = "_tests_/postcss_read_inventory_tests.rs"]
mod postcss_read_inventory_tests;

#[cfg(test)]
#[path = "_tests_/postcss_module_digest_tests.rs"]
mod postcss_module_digest_tests;
