//! A publication without a rebuild pauses the step until the next ready Changes, and the step
//! then resumes from the newest snapshot with the records of its finished chunks.

use std::sync::Arc;

use mokly_model::public_metadata::ChangesStatus;
use tokio::sync::watch;

use crate::background::Background;
use crate::publication::Publications;

use super::hold::hold;
use super::support::{Calls, changed, primed};

#[tokio::test]
async fn a_publication_without_a_rebuild_pauses_the_step_until_the_next_ready_changes() {
    let session = Arc::new(changed(40));
    let calls = Calls::default();
    let (held, hook) = hold(34, {
        let session = session.clone();
        move || {
            session.publish(ChangesStatus::Pending);
        }
    });
    let step = session.step(calls.encoder(hook));
    let (_stop, stop) = watch::channel(false);
    let mut run = step.run(stop);
    let worker = held.release(&session.work, &mut run).await;
    assert!(worker.is_some(), "the step pauses instead of ending");
    assert_eq!(
        (
            session.work.turn.available_permits(),
            calls.len(),
            primed(&session.shared.current())
        ),
        (1, 34, 32),
        "while Changes is pending, the step waits for no worker and keeps its finished chunk"
    );
    drop(worker);
    let ready = session.publish_ready();
    run.await;
    let revisions = calls.revisions();
    assert_eq!(
        revisions.len(),
        42,
        "the step encodes only the unfinished chunk again"
    );
    assert_eq!(revisions[34..], [Some(ready.index.revision); 8]);
    assert_eq!(primed(&session.shared.current()), 40);
}
