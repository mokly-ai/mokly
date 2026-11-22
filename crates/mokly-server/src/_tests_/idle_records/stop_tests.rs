//! A rebuild candidate, a cancellation, a shutdown, and a rebuild end the step at its next
//! detail, and the step keeps the records of its finished chunks.

use std::sync::{Arc, Mutex};

use tokio::sync::watch;

use crate::background::Background;
use crate::publication::{PublicationWriter, Publications};
use crate::publication_sequence::support::generation;

use super::hold::hold;
use super::support::{Calls, changed, primed};

#[tokio::test]
async fn the_step_ends_on_a_candidate_a_cancellation_and_a_shutdown() {
    for case in ["candidate", "cancellation", "shutdown"] {
        let session = Arc::new(changed(40));
        let ready = session.shared.current();
        let calls = Calls::default();
        let (stop, stopping) = watch::channel(false);
        let (held, hook) = hold(34, {
            let session = session.clone();
            let ready = ready.clone();
            move || match case {
                "candidate" => session.shared.candidate(),
                "cancellation" => ready.changes.as_ref().unwrap().cancel.cancel(),
                _ => stop.send(true).unwrap(),
            }
        });
        let step = session.step(calls.encoder(hook));
        let mut run = step.run(stopping);
        let worker = held.release(&session.work, &mut run).await;
        let current = session.shared.current();
        assert_eq!(
            (
                worker.is_none(),
                calls.len(),
                primed(&current),
                current.index.revision
            ),
            (true, 34, 32, ready.index.revision),
            "{case}: the step ended, its encodes, the paths of its finished chunk, and the revision"
        );
    }
}

#[tokio::test]
async fn a_rebuild_ends_the_step_for_the_session() {
    let session = Arc::new(changed(40));
    let calls = Calls::default();
    let rebuilt = session.rebuild(generation(40, 1));
    let replaced = Arc::new(Mutex::new(false));
    let (held, hook) = hold(34, {
        let session = session.clone();
        let rebuilt = rebuilt.clone();
        let replaced = replaced.clone();
        move || *replaced.lock().unwrap() = session.shared.replace(rebuilt.clone())
    });
    let step = session.step(calls.encoder(hook));
    let (_stop, stop) = watch::channel(false);
    let mut run = step.run(stop);
    let worker = held.release(&session.work, &mut run).await;
    assert!(
        *replaced.lock().unwrap(),
        "the rebuild is published at the held encode"
    );
    assert_eq!((worker.is_none(), calls.len()), (true, 34));
    assert!(
        Arc::ptr_eq(&session.shared.current(), &rebuilt),
        "the step installs nothing into the rebuild"
    );
}
