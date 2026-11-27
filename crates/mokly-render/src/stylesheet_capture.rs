//! One root's compiler and resolver retain hashes and projections without source payloads.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use mokly_model::material::digest;
use mokly_source_interface::error::Result;
use mokly_source_interface::read_evidence::{ReadBaseline, ReadEvidence};
use mokly_source_interface::stream::SourceStream;
use mokly_source_interface::tree::{Child, Node, SourceTree};

use crate::input_stamp::InputStamp;

pub(crate) struct Capture {
    pub(crate) stamp: InputStamp,
    pub(crate) evidence: ReadEvidence,
    pub(crate) consistent: bool,
}

impl Default for Capture {
    fn default() -> Self {
        Self {
            stamp: InputStamp::default(),
            evidence: ReadEvidence::default(),
            consistent: true,
        }
    }
}

/// Each compilation owns this recorder. Parallel roots never share its observations.
pub(crate) struct RecordingTree {
    inner: Arc<dyn SourceTree>,
    root: PathBuf,
    captured: Mutex<Capture>,
}

impl RecordingTree {
    pub(crate) fn new(inner: Arc<dyn SourceTree>, root: PathBuf) -> Self {
        Self {
            inner,
            root,
            captured: Mutex::default(),
        }
    }

    pub(crate) fn take(&self) -> Capture {
        std::mem::take(
            &mut *self
                .captured
                .lock()
                .unwrap_or_else(|error| error.into_inner()),
        )
    }

    fn record_digest(&self, path: &Path, hash: Option<String>, unretained: bool, observed: bool) {
        let mut captured = self
            .captured
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if observed && let Some(hash) = &hash {
            let relative = path.strip_prefix(&self.root).unwrap_or(path);
            let name = relative.to_string_lossy().replace('\\', "/");
            let baseline = ReadBaseline::ObservedWholeFile(hash.clone());
            captured.evidence.insert(name, baseline);
        }
        let files = if unretained {
            &mut captured.stamp.unretained
        } else {
            &mut captured.stamp.files
        };
        if let Some(previous) = files.insert(path.into(), hash.clone()) {
            captured.consistent &= previous == hash;
        }
    }
}

impl SourceTree for RecordingTree {
    fn project(&self, path: &Path) -> Result<Option<Node>> {
        let result = self.inner.project(path);
        let mut captured = self
            .captured
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let node = result.as_ref().ok().cloned();
        if let Some(previous) = captured.stamp.projections.insert(path.into(), node.clone()) {
            captured.consistent &= previous == node;
        }
        captured.consistent &= result.is_ok();
        result
    }

    fn read(&self, path: &Path) -> Result<Vec<u8>> {
        let result = self.inner.read(path);
        self.record_digest(
            path,
            result.as_ref().ok().map(|bytes| digest(bytes)),
            false,
            true,
        );
        result
    }

    fn read_shared(&self, path: &Path) -> Result<Arc<[u8]>> {
        let result = self.inner.read_shared(path);
        self.record_digest(
            path,
            result.as_ref().ok().map(|bytes| digest(bytes)),
            false,
            true,
        );
        result
    }

    fn read_public(&self, path: &Path) -> Result<Vec<u8>> {
        let result = self.inner.read_public(path);
        self.record_digest(
            path,
            result.as_ref().ok().map(|bytes| digest(bytes)),
            true,
            true,
        );
        result
    }

    fn digest(&self, path: &Path) -> Result<String> {
        let result = self.inner.digest(path);
        self.record_digest(path, result.as_ref().ok().cloned(), false, false);
        result
    }

    fn digest_unretained(&self, path: &Path) -> Result<String> {
        let result = self.inner.digest_unretained(path);
        self.record_digest(path, result.as_ref().ok().cloned(), true, false);
        result
    }

    fn children(&self, path: &Path) -> Result<Vec<Child>> {
        self.inner.children(path)
    }

    fn file_object(&self, path: &Path) -> Result<Option<String>> {
        self.inner.file_object(path)
    }

    fn open_stream(&self, path: &Path) -> Result<Box<dyn SourceStream>> {
        self.inner.open_stream(path)
    }

    fn prefetch(&self, paths: &[PathBuf]) -> Result<()> {
        self.inner.prefetch(paths)
    }

    fn hint_projections(&self, paths: &[PathBuf]) {
        self.inner.hint_projections(paths);
    }

    fn observe_input(&self, path: &Path, baseline: &ReadBaseline) -> Result<()> {
        self.inner.observe_input(path, baseline)
    }

    fn observe_inputs(&self, path: &Path, baselines: &BTreeSet<ReadBaseline>) -> Result<()> {
        self.inner.observe_inputs(path, baselines)
    }

    fn observe_pinned_input(
        &self,
        path: &Path,
        baseline: &ReadBaseline,
        pinned_digest: Option<&str>,
    ) -> Result<()> {
        self.inner
            .observe_pinned_input(path, baseline, pinned_digest)
    }
}
