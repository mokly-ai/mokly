//! Source reads keep the historical extraction and dependency installation leased.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_source_interface::error::Result;
use mokly_source_interface::read_evidence::ReadBaseline;
use mokly_source_interface::stream::SourceStream;
use mokly_source_interface::tree::{Child, Node, SourceTree};

use crate::side::BaseSide;

/// Keep the extraction and dependency leases until the last graph reader closes.
pub(crate) struct LeasedTree {
    pub(crate) tree: Arc<dyn SourceTree>,
    /// Dependency mapping is restricted to already planned opaque asset streams.
    pub(crate) assets: Arc<dyn SourceTree>,
    pub(crate) _base: Option<Arc<BaseSide>>,
}

impl SourceTree for LeasedTree {
    fn observe_inputs(&self, path: &Path, baselines: &BTreeSet<ReadBaseline>) -> Result<()> {
        self.tree.observe_inputs(path, baselines)
    }
    fn observe_pinned_input(
        &self,
        path: &Path,
        baseline: &ReadBaseline,
        digest: Option<&str>,
    ) -> Result<()> {
        self.tree.observe_pinned_input(path, baseline, digest)
    }
    fn observe_input(&self, path: &Path, baseline: &ReadBaseline) -> Result<()> {
        self.tree.observe_input(path, baseline)
    }
    fn prefetch(&self, paths: &[PathBuf]) -> mokly_source_interface::error::Result<()> {
        self.tree.prefetch(paths)
    }
    fn open_stream(&self, path: &Path) -> Result<Box<dyn SourceStream>> {
        self.assets.open_stream(path)
    }
    fn digest_unretained(&self, path: &Path) -> Result<String> {
        self.tree.digest_unretained(path)
    }
    fn read_public(&self, path: &Path) -> mokly_source_interface::error::Result<Vec<u8>> {
        self.tree.read_public(path)
    }
    fn digest(&self, path: &Path) -> mokly_source_interface::error::Result<String> {
        self.tree.digest(path)
    }
    fn project(&self, path: &Path) -> Result<Option<Node>> {
        self.tree.project(path)
    }
    fn children(&self, path: &Path) -> Result<Vec<Child>> {
        self.tree.children(path)
    }
    fn read(&self, path: &Path) -> Result<Vec<u8>> {
        self.tree.read(path)
    }
    fn read_shared(&self, path: &Path) -> Result<Arc<[u8]>> {
        self.tree.read_shared(path)
    }
}
