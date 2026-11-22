//! After the first ready Changes of a session, idle work fills the ready rebuild record of each
//! detail with the detail that the next rebuild builds for an unchanged entry.

use std::sync::{Arc, Weak};

use async_trait::async_trait;
use tokio::sync::{oneshot, watch};

use crate::backend::Documents;
use crate::background::{Background, stopped};
use crate::detail_encoding::{DetailEncoder, EncodedDetails};
use crate::idle_chunk::{Chunk, ChunkJob, Progress};
use crate::publication::Publications;
use crate::snapshot::Snapshot;
use crate::work::Work;

/// The idle rebuild record step of one Serve session. It publishes nothing.
pub struct IdleRecords {
    publications: Arc<dyn Publications>,
    work: Arc<dyn Work>,
    encoder: Arc<dyn DetailEncoder>,
    /// The documents of the session's first publication; another value means a rebuild.
    session: Weak<dyn Documents>,
}

/// What the step does with the current snapshot.
enum Start {
    /// Fill the records of this ready Changes publication.
    Fill(Arc<Snapshot>),
    /// Wait for the next publication.
    Wait,
    /// End the step for the session.
    End,
}

/// How one pass ended.
enum Pass {
    /// The pass checked every detail, or the scheduler stopped: the step ends.
    Ended,
    /// A gate closed the pass: the step checks its start rule again.
    Interrupted,
}

impl IdleRecords {
    /// Create the step of the session whose first publication `publications` holds now.
    pub fn new(publications: Arc<dyn Publications>, work: Arc<dyn Work>) -> Self {
        Self::with_encoder(publications, work, Arc::new(EncodedDetails))
    }

    pub(crate) fn with_encoder(
        publications: Arc<dyn Publications>,
        work: Arc<dyn Work>,
        encoder: Arc<dyn DetailEncoder>,
    ) -> Self {
        let session = Arc::downgrade(&publications.current().documents);
        Self {
            publications,
            work,
            encoder,
            session,
        }
    }

    /// Start only from a ready Changes publication of the session's first generation, while
    /// Serve runs, its classification stands, and no rebuild candidate started.
    fn start(&self, stop: &watch::Receiver<bool>) -> Start {
        if stopped(stop) || !self.publications.accepts_records() {
            return Start::End;
        }
        let current = self.publications.current();
        if !std::ptr::addr_eq(self.session.as_ptr(), Arc::as_ptr(&current.documents)) {
            return Start::End;
        }
        match current
            .changes
            .as_ref()
            .map(|accepted| accepted.cancel.cancelled())
        {
            None => Start::Wait,
            Some(true) => Start::End,
            Some(false) => Start::Fill(current),
        }
    }

    /// Check every detail of `origin` in chunks on idle workers, and install the records of
    /// each chunk into the snapshot that the step read or installed last.
    async fn pass(&self, origin: Arc<Snapshot>, stop: &watch::Receiver<bool>) -> Pass {
        let mut chunk = Chunk::new(
            origin,
            self.publications.clone(),
            self.encoder.clone(),
            stop.clone(),
        );
        loop {
            let (done, back) = oneshot::channel();
            self.work.idle(Box::new(ChunkJob { chunk, done })).await;
            let Ok((next, progress)) = back.await else {
                return Pass::Ended;
            };
            chunk = next;
            if progress == Progress::Yielded {
                continue;
            }
            if progress == Progress::Closed {
                return Pass::Interrupted;
            }
            let installed = if chunk.kept == 0 {
                chunk.snapshot.clone()
            } else {
                match self
                    .publications
                    .install_records(&chunk.snapshot, chunk.records.clone())
                {
                    Some(installed) => installed,
                    None => return Pass::Interrupted,
                }
            };
            if progress == Progress::Done {
                return Pass::Ended;
            }
            chunk.next(installed);
        }
    }
}

#[async_trait]
impl Background for IdleRecords {
    async fn run(&self, mut stop: watch::Receiver<bool>) {
        let mut updates = self.publications.subscribe().updates;
        loop {
            match self.start(&stop) {
                Start::End => return,
                Start::Fill(origin) => {
                    if let Pass::Ended = self.pass(origin, &stop).await {
                        return;
                    }
                }
                Start::Wait => {
                    tokio::select! {
                        _ = stop.changed() => {},
                        _ = updates.recv() => {},
                    }
                }
            }
        }
    }
}

#[cfg(test)]
#[path = "_tests_/idle_records/mod.rs"]
mod idle_records_tests;
