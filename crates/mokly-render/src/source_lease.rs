//! Source reads keep the historical extraction and dependency installation leased.

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
    pub(crate) _base: Option<Arc<BaseSide>>,
}

impl SourceTree for LeasedTree {
    fn observe_pinned_input(
        &self,
        path: &Path,
        baseline: &ReadBaseline,
        digest: &str,
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
        self.tree.open_stream(path)
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
