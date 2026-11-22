//! One chunk of the idle rebuild record step, which a worker runs on a blocking thread.

use std::collections::VecDeque;
use std::sync::Arc;

use mokly_model::projection;
use mokly_model::public_detail::EntryDetailV4;
use tokio::sync::{oneshot, watch};

use crate::background::stopped;
use crate::changes::ChangeCancellation;
use crate::detail_encoding::DetailEncoder;
use crate::detail_publication::{PublicationKind, RecentDetails};
use crate::publication::Publications;
use crate::replacement;
use crate::snapshot::Snapshot;
use crate::work_idle::IdleJob;

/// The details that one chunk checks before the step installs the records that it kept.
/// It bounds the encodes that a stop discards and the snapshot copies of one pass.
const CHUNK: usize = 32;

/// Where a chunk stopped.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Progress {
    /// A foreground request became active; the chunk continues when Serve is idle again.
    Yielded,
    /// A stop, a cancellation, a rebuild candidate, or a newer snapshot ended the chunk.
    Closed,
    /// The chunk checked its details, and more details remain.
    Full,
    /// The chunk checked the last detail.
    Done,
}

/// The work of one pass from one snapshot: the details left and the records kept.
pub(crate) struct Chunk {
    /// The snapshot that the step read or installed last.
    pub(crate) snapshot: Arc<Snapshot>,
    /// The records of `snapshot` with the records that this chunk kept.
    pub(crate) records: RecentDetails,
    /// The number of records that this chunk kept.
    pub(crate) kept: usize,
    /// The rebuild details not checked yet, built on the first run.
    details: Option<VecDeque<EntryDetailV4>>,
    checked: usize,
    publications: Arc<dyn Publications>,
    encoder: Arc<dyn DetailEncoder>,
    /// The classification of the ready Changes that this pass started from.
    cancel: Option<Arc<dyn ChangeCancellation>>,
    stop: watch::Receiver<bool>,
}

impl Chunk {
    pub(crate) fn new(
        snapshot: Arc<Snapshot>,
        publications: Arc<dyn Publications>,
        encoder: Arc<dyn DetailEncoder>,
        stop: watch::Receiver<bool>,
    ) -> Self {
        Self {
            records: snapshot.recent_details.clone(),
            cancel: snapshot
                .changes
                .as_ref()
                .map(|accepted| accepted.cancel.clone()),
            snapshot,
            kept: 0,
            details: None,
            checked: 0,
            publications,
            encoder,
            stop,
        }
    }

    /// Start the next chunk from `snapshot`, which holds the records kept so far.
    pub(crate) fn next(&mut self, snapshot: Arc<Snapshot>) {
        self.snapshot = snapshot;
        self.kept = 0;
        self.checked = 0;
    }

    fn run(&mut self, idle: &dyn Fn() -> bool) -> Progress {
        while self.checked < CHUNK {
            if !self.open() {
                return Progress::Closed;
            }
            if !idle() {
                return Progress::Yielded;
            }
            let details = self.details.get_or_insert_with(|| rebuilt(&self.snapshot));
            let Some(mut detail) = details.pop_front() else {
                return Progress::Done;
            };
            self.checked += 1;
            if PublicationKind::rebuild(&detail) != PublicationKind::RebuildReady
                || self.records.holds(&detail)
            {
                continue;
            }
            match self.encoder.encode(&mut detail) {
                Ok(file) => {
                    self.records.prime(Arc::new(detail), file);
                    self.kept += 1;
                }
                Err(error) => tracing::debug!(%error, "an idle rebuild record was not encoded"),
            }
        }
        if self.details.as_ref().is_some_and(VecDeque::is_empty) {
            Progress::Done
        } else {
            Progress::Full
        }
    }

    /// Whether Serve runs, the classification stands, records are accepted, and the snapshot
    /// is still current.
    fn open(&self) -> bool {
        !stopped(&self.stop)
            && !self
                .cancel
                .as_ref()
                .is_some_and(|cancel| cancel.cancelled())
            && self.publications.accepts_records()
            && Arc::ptr_eq(&self.publications.current(), &self.snapshot)
    }
}

/// The details that a rebuild of the snapshot's own generation builds for its unchanged
/// entries: each projected pending detail with the ready usage of each view, and no workspace.
fn rebuilt(snapshot: &Snapshot) -> VecDeque<EntryDetailV4> {
    let mut details =
        projection::pending_details(&snapshot.model, &snapshot.index, &snapshot.view_keys);
    replacement::copy_usage(&mut details, &snapshot.document_keys, snapshot);
    details.into_values().collect()
}

/// A chunk on its way to a worker. It sends itself back with its progress when it ends.
pub(crate) struct ChunkJob {
    pub(crate) chunk: Chunk,
    pub(crate) done: oneshot::Sender<(Chunk, Progress)>,
}

impl IdleJob for ChunkJob {
    fn run(self: Box<Self>, idle: &dyn Fn() -> bool) {
        let ChunkJob { mut chunk, done } = *self;
        let progress = chunk.run(idle);
        let _ = done.send((chunk, progress));
    }
}
