//! Minimal publication script that stops after one complete usage publication.

use std::sync::{Arc, Mutex};

use tokio::sync::{broadcast, watch};
use unimock::{MockFn, Unimock, matching};

use crate::background::UsagePass;
use crate::background_capacity::FixedCapacity;
use crate::publication::PublicationsMock;
use crate::publication_event::{PublicationEvent, Subscription};
use crate::snapshot::Snapshot;
use crate::work::Work;

pub(super) struct Script {
    _mock: Unimock,
    pub(super) stop: Arc<watch::Sender<bool>>,
    pub(super) current: Arc<Mutex<Arc<Snapshot>>>,
    pub(super) updates: broadcast::Sender<PublicationEvent>,
    pub(super) published: Arc<Mutex<Vec<Vec<String>>>>,
}

pub(super) fn pass(
    origin: Arc<Snapshot>,
    capacity: usize,
    work: Arc<dyn Work>,
) -> (Script, UsagePass, watch::Receiver<bool>) {
    let current = Arc::new(Mutex::new(origin));
    let (updates, receiver) = broadcast::channel(16);
    let (stop, stopping) = watch::channel(false);
    let stop = Arc::new(stop);
    let published = Arc::new(Mutex::new(Vec::new()));
    let mock = Unimock::new((
        PublicationsMock::current
            .each_call(matching!())
            .answers_arc(Arc::new({
                let current = current.clone();
                move |_| current.lock().unwrap().clone()
            })),
        PublicationsMock::subscribe
            .some_call(matching!())
            .returns(Subscription {
                current: PublicationEvent {
                    revision: 1,
                    deployment_id: "process".into(),
                },
                updates: receiver,
            }),
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
    .no_verify_in_drop();
    let pass = UsagePass {
        capacity: Arc::new(FixedCapacity(capacity)),
        changes: None,
        publications: Arc::new(mock.clone()),
        work,
        diagnostics: Arc::new(Unimock::new(())),
    };
    (
        Script {
            _mock: mock,
            stop,
            current,
            updates,
            published,
        },
        pass,
        stopping,
    )
}
