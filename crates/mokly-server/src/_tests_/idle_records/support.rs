//! Serve sessions after their usage pass, and an encoder that records each idle encode.

use std::sync::{Arc, Mutex};

use axum::body::to_bytes;
use mokly_graph::types::RenderGeneration;
use mokly_model::public_metadata::ChangesStatus;
use unimock::{MockFn, Unimock, matching};

use crate::changes::ChangeToken;
use crate::detail_encoding::{DetailEncoder, DetailEncoderMock, EncodedDetails};
use crate::detail_publication::PublicationKind;
use crate::evidence;
use crate::idle_records::IdleRecords;
use crate::publication::{Publications, SharedPublication};
use crate::publication_sequence::support::{accepted, generation, input, projector};
use crate::publication_support::ready;
use crate::revision_file::RevisionFile;
use crate::snapshot::{Snapshot, SnapshotFactory};
use crate::work::Workers;

/// A Serve session whose usage pass completed every view, with one worker.
pub(super) struct Session {
    count: usize,
    pub(super) shared: Arc<SharedPublication>,
    pub(super) work: Arc<Workers>,
}

/// A session whose Changes are still pending.
pub(super) fn used(count: usize) -> Session {
    let startup = projector().create(generation(count, 0), input(1)).unwrap();
    let updates: Vec<_> = startup
        .routes
        .iter()
        .map(|route| (route.route.clone(), ready()))
        .collect();
    let used = evidence::complete(&startup, &updates, &EncodedDetails)
        .unwrap()
        .unwrap();
    Session {
        count,
        shared: Arc::new(SharedPublication::new(used)),
        work: Arc::new(Workers::new(1, Arc::new(Unimock::new(())))),
    }
}

/// A session after its first ready Changes.
pub(super) fn changed(count: usize) -> Session {
    let session = used(count);
    session.publish_ready();
    session
}

impl Session {
    /// Publish a Changes status without a classification.
    pub(super) fn publish(&self, status: ChangesStatus) -> Arc<Snapshot> {
        let current = self.shared.current();
        let token = ChangeToken::default();
        assert!(
            self.shared
                .changes(&current, status, None, &token, None)
                .unwrap()
        );
        self.shared.current()
    }

    /// Publish a ready Changes classification.
    pub(super) fn publish_ready(&self) -> Arc<Snapshot> {
        let current = self.shared.current();
        let accepted = Some(accepted(self.count, 0, true));
        let token = ChangeToken::default();
        assert!(
            self.shared
                .changes(&current, ChangesStatus::Ready, accepted, &token, None)
                .unwrap()
        );
        self.shared.current()
    }

    /// The step of this session with `encoder`.
    pub(super) fn step(&self, encoder: Arc<dyn DetailEncoder>) -> IdleRecords {
        IdleRecords::with_encoder(self.shared.clone(), self.work.clone(), encoder)
    }

    /// Project a rebuild of the current snapshot from `generation`.
    pub(super) fn rebuild(&self, generation: Arc<dyn RenderGeneration>) -> Arc<Snapshot> {
        let current = self.shared.current();
        projector()
            .replace(generation, input(current.index.revision + 1), &current)
            .unwrap()
    }
}

/// The typed revision of each detail that the step encoded, in call order.
#[derive(Clone, Default)]
pub(super) struct Calls(Arc<Mutex<Vec<Option<u64>>>>);

impl Calls {
    /// An encoder that records each call, runs `hook` with the number of the call, and then
    /// encodes as the publications do.
    pub(super) fn encoder(
        &self,
        hook: impl Fn(usize) + Send + Sync + 'static,
    ) -> Arc<dyn DetailEncoder> {
        let calls = self.0.clone();
        Arc::new(Unimock::new(
            DetailEncoderMock::encode
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, detail| {
                    let number = {
                        let mut calls = calls.lock().unwrap();
                        calls.push(detail.revision);
                        calls.len()
                    };
                    hook(number);
                    EncodedDetails.encode(detail)
                })),
        ))
    }

    pub(super) fn len(&self) -> usize {
        self.0.lock().unwrap().len()
    }

    pub(super) fn revisions(&self) -> Vec<Option<u64>> {
        self.0.lock().unwrap().clone()
    }
}

/// The number of paths of `snapshot` that hold a ready rebuild record.
pub(super) fn primed(snapshot: &Snapshot) -> usize {
    snapshot
        .details
        .keys()
        .filter(|path| {
            snapshot
                .recent_details
                .record(path, PublicationKind::RebuildReady)
                .is_some()
        })
        .count()
}

/// Assert equal served bytes of every file, and equal typed details.
pub(super) async fn same_bytes(product: &Snapshot, reference: &Snapshot, case: &str) {
    assert_eq!(
        product.files.keys().collect::<Vec<_>>(),
        reference.files.keys().collect::<Vec<_>>(),
        "{case}: routes"
    );
    let body =
        |file: &RevisionFile, revision| to_bytes(file.response(revision).into_body(), usize::MAX);
    for (route, file) in &product.files {
        assert_eq!(
            body(file, product.index.revision).await.unwrap(),
            body(&reference.files[route], reference.index.revision)
                .await
                .unwrap(),
            "{case}: {route}"
        );
    }
    for path in reference.details.keys() {
        assert_eq!(
            product.detail(path),
            reference.detail(path),
            "{case}: typed detail {path}"
        );
    }
}
