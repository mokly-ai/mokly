//! Background passes retain equal completions and skip them on a repeated pass.

use std::sync::Arc;

use tokio::sync::{broadcast::error::TryRecvError, watch};
use unimock::{MockFn, Unimock, matching};

use crate::backend::DocumentsMock;
use crate::background::UsagePass;
use crate::publication::{Publications, SharedPublication};
use crate::publication_support::{ready, unrecorded_ready};
use crate::work::WorkMock;

#[tokio::test]
async fn background_equal_usage_is_complete_without_a_revision() {
    let mock = Unimock::new((
        DocumentsMock::usage
            .each_call(matching!(_))
            .answers(&|_, _| Some(ready()))
            .n_times(2),
        WorkMock::background
            .each_call(matching!(_, _))
            .answers(&|_, _, _| Ok(Vec::new()))
            .n_times(2),
    ));
    let origin = unrecorded_ready(2, Arc::new(mock.clone()));
    let shared = Arc::new(SharedPublication::new(origin.clone()));
    let mut events = shared.subscribe();
    let (_stop, mut stop) = watch::channel(false);
    let pass = UsagePass {
        batch: 2,
        changes: None,
        publications: shared.clone(),
        work: Arc::new(mock.clone()),
        diagnostics: Arc::new(Unimock::new(())),
    };
    for _ in 0..2 {
        assert!(pass.fill(&origin, &mut stop, &mut events.updates).await);
        let current = shared.current();
        assert_eq!(current.completed.len(), 2);
        assert_eq!(current.index.revision, origin.index.revision);
        assert!(Arc::ptr_eq(&current.lease, &origin.lease));
        assert!(current.lease.valid());
        assert!(matches!(
            events.updates.try_recv(),
            Err(TryRecvError::Empty)
        ));
    }
}
