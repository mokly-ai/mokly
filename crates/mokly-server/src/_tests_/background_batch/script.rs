//! A scripted publication and recorded diagnostics for batch scheduling tests.

use std::sync::{Arc, Mutex};

use tokio::sync::{broadcast, watch};
use unimock::{MockFn, Unimock, matching};

use crate::background::UsagePass;
use crate::diagnostics::{Diagnostics, DiagnosticsMock};
use crate::publication::{PublicationEvent, PublicationsMock, Subscription};
use crate::snapshot::Snapshot;
use crate::work::Work;

/// A publication whose current snapshot the test replaces, and the passes' completions.
pub(super) struct Script {
    _mock: Unimock,
    pub(super) current: Arc<Mutex<Arc<Snapshot>>>,
    pub(super) updates: broadcast::Sender<PublicationEvent>,
    pub(super) published: Arc<Mutex<Vec<Vec<String>>>>,
    pub(super) stop: Arc<watch::Sender<bool>>,
}

impl Script {
    /// Replace the current snapshot and announce the new revision.
    pub(super) fn replace(&self, next: Arc<Snapshot>) {
        *self.current.lock().unwrap() = next;
        assert!(
            self.updates
                .send(PublicationEvent {
                    revision: 2,
                    deployment_id: "process".into(),
                })
                .is_ok()
        );
    }
}

/// A pass over `origin` with the given batch. With `publishes`, its first completion
/// stops Serve; without it, a completion fails the test. The script comes first, so
/// its original mock drops after the pass's clone.
pub(super) fn pass(
    origin: Arc<Snapshot>,
    batch: usize,
    work: Arc<dyn Work>,
    diagnostics: Arc<dyn Diagnostics>,
    publishes: bool,
) -> (Script, UsagePass, watch::Receiver<bool>) {
    let current = Arc::new(Mutex::new(origin));
    let (updates, receiver) = broadcast::channel(64);
    let (stop, stopping) = watch::channel(false);
    let stop = Arc::new(stop);
    let published = Arc::new(Mutex::new(Vec::new()));
    let reads = (
        PublicationsMock::current
            .each_call(matching!())
            .answers_arc(Arc::new({
                let current = current.clone();
                move |_| current.lock().unwrap().clone()
            })),
        PublicationsMock::subscribe
            .next_call(matching!())
            .returns(Subscription {
                current: PublicationEvent {
                    revision: 1,
                    deployment_id: "process".into(),
                },
                updates: receiver,
            }),
    );
    let mock = if publishes {
        Unimock::new((
            reads,
            PublicationsMock::completed_many
                .each_call(matching!(_, _))
                .answers_arc(Arc::new({
                    let published = published.clone();
                    let stop = stop.clone();
                    move |_, _, routes| {
                        published.lock().unwrap().push(routes.to_vec());
                        stop.send_replace(true);
                        Ok(())
                    }
                })),
        ))
    } else {
        Unimock::new(reads)
    };
    let pass = UsagePass {
        batch,
        changes: None,
        publications: Arc::new(mock.clone()),
        work,
        diagnostics,
    };
    let script = Script {
        _mock: mock,
        current,
        updates,
        published,
        stop,
    };
    (script, pass, stopping)
}

/// Diagnostics that record each reported failure's text. The tests assert the record,
/// so the mock also allows no report at all.
pub(super) fn reports() -> (Arc<dyn Diagnostics>, Arc<Mutex<Vec<String>>>) {
    let reports = Arc::new(Mutex::new(Vec::new()));
    (recording(reports.clone(), ""), reports)
}

/// Diagnostics that append each failure's text, after a prefix, to a shared record.
pub(super) fn recording(
    record: Arc<Mutex<Vec<String>>>,
    prefix: &'static str,
) -> Arc<dyn Diagnostics> {
    let diagnostics = Unimock::new(DiagnosticsMock::failed.each_call(matching!(_)).answers_arc(
        Arc::new(move |_, error| record.lock().unwrap().push(format!("{prefix}{error}"))),
    ))
    .no_verify_in_drop();
    Arc::new(diagnostics)
}
