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
        let (cell, owner) = {
            let mut known = self.known();
            match known.get(name) {
                Some(cell) => (cell.clone(), false),
                None => {
                    let cell = Arc::new(ModuleCell {
                        state: Mutex::new(ModuleState::Running),
                        ready: Condvar::new(),
                    });
                    known.insert(name.into(), cell.clone());
                    (cell, true)
                }
            }
        };
        if !owner {
            let mut state = cell.state.lock().unwrap_or_else(|error| error.into_inner());
            loop {
                match &*state {
                    ModuleState::Running => {
                        state = cell
                            .ready
                            .wait(state)
                            .unwrap_or_else(|error| error.into_inner());
                    }
                    ModuleState::Ready(digest) => return Some(digest.clone()),
                    ModuleState::Failed => return None,
                }
            }
        }
        let digest = tree
            .project(&root.join(name))
            .ok()
            .flatten()
            .and_then(|node| tree.digest(&node.identity).ok());
        {
            let mut state = cell.state.lock().unwrap_or_else(|error| error.into_inner());
            *state = match &digest {
                Some(digest) => ModuleState::Ready(digest.clone()),
                None => ModuleState::Failed,
            };
        }
        if digest.is_none() {
            let mut known = self.known();
            if known
                .get(name)
                .is_some_and(|current| Arc::ptr_eq(current, &cell))
            {
                known.remove(name);
            }
        }
        cell.ready.notify_all();
        digest
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

#[cfg(test)]
#[path = "_tests_/postcss_module_flight_tests.rs"]
mod postcss_module_flight_tests;
