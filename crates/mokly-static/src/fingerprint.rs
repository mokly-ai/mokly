//! Selected source digests and root membership protect one static generation.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_graph::source_snapshot::SourceSnapshot;
use mokly_model::output::validation::digest;
use mokly_source_interface::error;
use mokly_source_interface::tree::{Child, Node, SourceTree};

use crate::error::{Error, InternalError, Result};
use crate::fingerprint_observation::Observation;
use crate::fingerprint_walk::{self, Membership};
use crate::input_selection::Selection;

/// Captured source reads. Rechecks include inputs beneath normally excluded directories.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = InputTreeMock))]
pub trait InputTree: SourceTree {
    /// Select configured root members and authored configuration inputs before callbacks.
    fn begin(&self, config: &ResolvedConfig, excluded: &[PathBuf]) -> Result<()>;
    /// Capture inventoried sources and require the sidecar's consumed module digests.
    fn capture(
        &self,
        root: &Path,
        paths: &[String],
        module_digests: &BTreeMap<String, Option<String>>,
    ) -> Result<()>;
    /// Verify every explicitly read source and its resolved identity.
    fn verify(&self) -> Result<()>;
}

/// Generation source wrapper with immutable reads and a final live recheck.
pub struct CapturedTree {
    snapshot: SourceSnapshot,
    live: Arc<dyn SourceTree>,
    reads: Mutex<BTreeMap<PathBuf, Observation<String>>>,
    nodes: Mutex<BTreeMap<PathBuf, Observation<Option<Node>>>>,
    roots: Mutex<Option<RootCapture>>,
}

struct RootCapture {
    selection: Selection,
    members: Membership,
}
impl CapturedTree {
    /// Capture one build's inputs without retaining a second copy of their bytes.
    pub fn new(tree: Arc<dyn SourceTree>) -> Self {
        Self {
            snapshot: SourceSnapshot::new(tree.clone()),
            live: tree,
            reads: Mutex::new(BTreeMap::new()),
            nodes: Mutex::new(BTreeMap::new()),
            roots: Mutex::new(None),
        }
    }
}
impl SourceTree for CapturedTree {
    fn prefetch(&self, paths: &[PathBuf]) -> error::Result<()> {
        self.snapshot.prefetch(paths)
    }
    #[tracing::instrument(name = "output.input-read", skip_all, err, fields(action = "public", read_bytes = tracing::field::Empty, retained_bytes = tracing::field::Empty))]
    fn read_public(&self, path: &Path) -> error::Result<Vec<u8>> {
        let bytes = self.snapshot.read_public(path)?;
        tracing::Span::current().record("read_bytes", bytes.len() as u64);
        tracing::Span::current().record("retained_bytes", self.snapshot.retained_bytes() as u64);
        self.reads
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .entry(path.into())
            .or_insert_with(|| Observation::Value(digest(&bytes)));
        Ok(bytes)
    }
    fn digest(&self, path: &Path) -> error::Result<String> {
        let hash = self.snapshot.digest(path);
        self.reads
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .entry(path.into())
            .or_insert_with(|| Observation::from(&hash));
        hash
    }

    fn project(&self, path: &Path) -> error::Result<Option<Node>> {
        let result = self.snapshot.project(path);
        self.nodes
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .entry(path.into())
            .or_insert_with(|| Observation::from(&result));
        result
    }
    fn children(&self, path: &Path) -> error::Result<Vec<Child>> {
        self.snapshot.children(path)
    }
    fn read(&self, path: &Path) -> error::Result<Vec<u8>> {
        Ok(self.read_shared(path)?.to_vec())
    }
    #[tracing::instrument(name = "output.input-read", skip_all, err, fields(action = "private", read_bytes = tracing::field::Empty, retained_bytes = tracing::field::Empty))]
    fn read_shared(&self, path: &Path) -> error::Result<Arc<[u8]>> {
        let bytes = self.snapshot.read_shared(path)?;
        tracing::Span::current().record("read_bytes", bytes.len() as u64);
        tracing::Span::current().record("retained_bytes", self.snapshot.retained_bytes() as u64);
        self.reads
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .entry(path.into())
            .or_insert_with(|| Observation::Value(digest(&bytes)));
        Ok(bytes)
    }
}
impl InputTree for CapturedTree {
    #[tracing::instrument(name = "output.fingerprint", skip_all, err, fields(input_paths = tracing::field::Empty, retained_bytes = tracing::field::Empty))]
    fn begin(&self, config: &ResolvedConfig, excluded: &[PathBuf]) -> Result<()> {
        let selection = Selection::new(config, excluded)?;
        for root in &config.roots {
            let _ = self.project(&root.directory);
        }
        let members = fingerprint_walk::capture(self, &selection);
        for path in members
            .files
            .iter()
            .chain(&config.authored_inputs)
            .chain([&config.file])
        {
            if let Ok(Some(node)) = self.project(path)
                && node.identity.starts_with(&config.repo_root)
            {
                let _ = self.digest(&node.identity);
            }
        }
        tracing::Span::current().record(
            "input_paths",
            self.reads
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .len() as u64,
        );
        tracing::Span::current().record("retained_bytes", self.snapshot.retained_bytes() as u64);
        *self.roots.lock().unwrap_or_else(|error| error.into_inner()) =
            Some(RootCapture { selection, members });
        Ok(())
    }

    #[tracing::instrument(name = "output.input-digests", skip_all, err, fields(input_paths = tracing::field::Empty, retained_bytes = tracing::field::Empty))]
    fn capture(
        &self,
        root: &Path,
        paths: &[String],
        module_digests: &BTreeMap<String, Option<String>>,
    ) -> Result<()> {
        for path in paths {
            let absolute = root.join(path);
            if let Some(None) = module_digests.get(path) {
                return Err(InternalError::MissingModuleDigest { path: absolute }.into());
            }
            let node = source(self.project(&absolute))?.ok_or_else(|| Error::InputsChanged {
                path: absolute.clone(),
            })?;
            if !node.identity.starts_with(root) {
                return Err(Error::InputsChanged { path: absolute });
            }
            let captured = Observation::from(&self.digest(&node.identity));
            if let Some(Some(expected)) = module_digests.get(path) {
                let baseline = Observation::Value(expected.clone());
                let previous = self
                    .reads
                    .lock()
                    .unwrap_or_else(|error| error.into_inner())
                    .insert(node.identity, baseline.clone());
                if captured != baseline || previous.as_ref().is_some_and(|hash| *hash != baseline) {
                    return Err(Error::InputsChanged { path: absolute });
                }
            }
        }
        tracing::Span::current().record(
            "input_paths",
            self.reads
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .len() as u64,
        );
        tracing::Span::current().record("retained_bytes", self.snapshot.retained_bytes() as u64);
        Ok(())
    }
    #[tracing::instrument(name = "output.recheck", skip_all, err, fields(input_paths = tracing::field::Empty, retained_bytes = tracing::field::Empty))]
    fn verify(&self) -> Result<()> {
        let roots = self.roots.lock().unwrap_or_else(|error| error.into_inner());
        if let Some(roots) = roots.as_ref() {
            roots.members.verify(&fingerprint_walk::capture(
                self.live.as_ref(),
                &roots.selection,
            ))?;
        }
        let reads = self.reads.lock().unwrap_or_else(|error| error.into_inner());
        tracing::Span::current().record("input_paths", reads.len() as u64);
        tracing::Span::current().record("retained_bytes", self.snapshot.retained_bytes() as u64);
        for (path, node) in self
            .nodes
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .iter()
        {
            let selected = reads.contains_key(path)
                || node
                    .value()
                    .and_then(Option::as_ref)
                    .is_some_and(|node| reads.contains_key(&node.identity))
                || roots.as_ref().is_some_and(|roots| {
                    roots.selection.root(path) || roots.members.files.contains(path)
                });
            if !selected {
                continue;
            }
            if Observation::from(&self.live.project(path)) != *node {
                return Err(Error::InputsChanged { path: path.clone() });
            }
        }
        for (path, hash) in reads.iter() {
            if Observation::from(&self.live.digest(path)) != *hash {
                return Err(Error::InputsChanged { path: path.clone() });
            }
        }
        Ok(())
    }
}

/// Preserve typed source errors at the assembly boundary.
pub fn source<T>(result: error::Result<T>) -> Result<T> {
    match result {
        Ok(value) => Ok(value),
        Err(source) => Err(InternalError::Source { source }.into()),
    }
}
