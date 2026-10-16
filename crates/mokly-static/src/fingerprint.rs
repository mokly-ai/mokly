//! Confined source fingerprints exclude output while retaining explicit hidden inputs.

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use mokly_graph::source_snapshot::SourceSnapshot;
use mokly_model::output::validation::digest;
use mokly_source_interface::error;
use mokly_source_interface::tree::{Child, Node, SourceTree};

use crate::error::{Error, InternalError, Result};
use crate::filesystem::{Entry, Files};

/// Captured source reads. Rechecks include inputs beneath normally excluded directories.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = InputTreeMock))]
pub trait InputTree: SourceTree {
    /// Capture the complete inventoried sources before document callbacks run.
    fn capture(&self, root: &Path, paths: &[String]) -> Result<()>;
    /// Verify every explicitly read source and its resolved identity.
    fn verify(&self) -> Result<()>;
}

/// Generation source wrapper with immutable reads and a final live recheck.
pub struct CapturedTree {
    snapshot: SourceSnapshot,
    live: Arc<dyn SourceTree>,
    reads: Mutex<BTreeMap<PathBuf, String>>,
    nodes: Mutex<BTreeMap<PathBuf, Option<Node>>>,
}
impl CapturedTree {
    /// Capture one build's inputs without retaining a second copy of their bytes.
    pub fn new(tree: Arc<dyn SourceTree>) -> Self {
        Self {
            snapshot: SourceSnapshot::new(tree.clone()),
            live: tree,
            reads: Mutex::new(BTreeMap::new()),
            nodes: Mutex::new(BTreeMap::new()),
        }
    }
}
impl SourceTree for CapturedTree {
    fn digest(&self, path: &Path) -> error::Result<String> {
        let hash = self.snapshot.digest(path)?;
        self.reads
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .entry(path.into())
            .or_insert_with(|| hash.clone());
        Ok(hash)
    }

    fn project(&self, path: &Path) -> error::Result<Option<Node>> {
        let result = self.snapshot.project(path)?;
        self.nodes
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .entry(path.into())
            .or_insert(result.clone());
        Ok(result)
    }
    fn children(&self, path: &Path) -> error::Result<Vec<Child>> {
        self.snapshot.children(path)
    }
    fn read(&self, path: &Path) -> error::Result<Vec<u8>> {
        Ok(self.read_shared(path)?.to_vec())
    }
    fn read_shared(&self, path: &Path) -> error::Result<Arc<[u8]>> {
        let bytes = self.snapshot.read_shared(path)?;
        self.reads
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .entry(path.into())
            .or_insert_with(|| digest(&bytes));
        Ok(bytes)
    }
}
impl InputTree for CapturedTree {
    fn capture(&self, root: &Path, paths: &[String]) -> Result<()> {
        for path in paths {
            let absolute = root.join(path);
            let node = source(self.project(&absolute))?.ok_or_else(|| Error::InputsChanged {
                path: absolute.clone(),
            })?;
            if !node.identity.starts_with(root) {
                return Err(Error::InputsChanged { path: absolute });
            }
            source(self.digest(&node.identity))?;
        }
        Ok(())
    }
    fn verify(&self) -> Result<()> {
        for (path, node) in self
            .nodes
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .iter()
        {
            if self.live.project(path).ok().as_ref() != Some(node) {
                return Err(Error::InputsChanged { path: path.clone() });
            }
        }
        for (path, hash) in self
            .reads
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .iter()
        {
            if !self.live.digest(path).is_ok_and(|current| current == *hash) {
                return Err(Error::InputsChanged { path: path.clone() });
            }
        }
        Ok(())
    }
}

/// Broader source membership fingerprint catches additions and sidecar-owned reads.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = FingerprintsMock))]
pub trait Fingerprints: Send + Sync {
    /// Hash a confined tree without output, dependency, and build artifacts.
    fn capture(&self, root: &Path, excluded: &[PathBuf]) -> Result<BTreeMap<PathBuf, String>>;
}

/// Host fingerprint adapter through injected filesystem operations.
pub struct SourceFingerprints {
    /// Non-following filesystem boundary.
    pub files: Arc<dyn Files>,
}
impl Fingerprints for SourceFingerprints {
    fn capture(&self, root: &Path, excluded: &[PathBuf]) -> Result<BTreeMap<PathBuf, String>> {
        let physical = self.files.project(root)?;
        let excluded = excluded
            .iter()
            .map(|path| self.files.project(path))
            .collect::<Result<Vec<_>>>()?;
        let mut result = BTreeMap::new();
        self.walk(
            &physical,
            &physical,
            root,
            &excluded,
            &BTreeSet::new(),
            &mut result,
        )?;
        Ok(result)
    }
}
impl SourceFingerprints {
    fn walk(
        &self,
        root: &Path,
        physical: &Path,
        logical: &Path,
        excluded: &[PathBuf],
        ancestors: &BTreeSet<PathBuf>,
        output: &mut BTreeMap<PathBuf, String>,
    ) -> Result<()> {
        if excluded.iter().any(|path| physical.starts_with(path)) {
            return Ok(());
        }
        let entry = match self.files.entry(physical) {
            Ok(entry) => entry,
            Err(_) => {
                output.insert(logical.into(), "unreadable".into());
                return Ok(());
            }
        };
        match entry {
            Some(Entry::Directory(_)) => {
                if ancestors.contains(physical) {
                    return Ok(());
                }
                let mut ancestors = ancestors.clone();
                ancestors.insert(physical.into());
                let children = match self.files.children(physical) {
                    Ok(children) => children,
                    Err(_) => {
                        output.insert(logical.into(), "unreadable".into());
                        return Ok(());
                    }
                };
                for child in children {
                    let Some(name) = child.file_name() else {
                        continue;
                    };
                    if matches!(
                        name.to_str(),
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
                    ) {
                        continue;
                    }
                    self.walk(
                        root,
                        &child,
                        &logical.join(name),
                        excluded,
                        &ancestors,
                        output,
                    )?;
                }
            }
            Some(Entry::File(_)) => {
                output.insert(
                    logical.into(),
                    self.files
                        .hash(physical)
                        .unwrap_or_else(|_| "unreadable".into()),
                );
            }
            Some(Entry::Unsafe) => {
                if let Ok(target) = self.files.link(physical) {
                    let link = format!("link:{target:?}");
                    output.insert(logical.into(), link.clone());
                    if let Ok(real) = self.files.project(physical)
                        && real.starts_with(root)
                        && real != physical
                    {
                        self.walk(root, &real, logical, excluded, ancestors, output)?;
                        let content = output.remove(logical).unwrap_or_default();
                        output.insert(logical.into(), format!("{link}:{content}"));
                    }
                }
            }
            None => {}
        }
        Ok(())
    }
}

/// Compare two complete memberships and name the first changed input.
pub fn verify(before: &BTreeMap<PathBuf, String>, after: &BTreeMap<PathBuf, String>) -> Result<()> {
    for path in before.keys().chain(after.keys()) {
        if before.get(path) != after.get(path) {
            return Err(Error::InputsChanged { path: path.clone() });
        }
    }
    Ok(())
}

/// Preserve typed source errors at the assembly boundary.
pub fn source<T>(result: error::Result<T>) -> Result<T> {
    match result {
        Ok(value) => Ok(value),
        Err(source) => Err(InternalError::Source { source }.into()),
    }
}
