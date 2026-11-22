//! Explicit deferred attempts adapt the existing handoff scenarios to worker-first reads.

use std::sync::Arc;

use mokly_catalogue::diagnostic::Warning;
use mokly_graph::background::Completion;
use unimock::{MockFn, Unimock, matching};

use crate::background_capacity::FixedCapacity;
use crate::background_dispatch::Dispatch;
use crate::background_read::{BackgroundMissMock, BackgroundRead};
use crate::background_stage::Stages;
use crate::error::Result;

type Staged = dyn Fn(&Unimock, &str, Arc<dyn Completion>) -> Result<Vec<Warning>> + Send + Sync;
type Reader = dyn Fn(&Unimock, &str) -> Result<Option<BackgroundRead>> + Send + Sync;

pub(crate) fn dispatch(capacity: usize) -> Arc<Dispatch> {
    Dispatch::new(Stages::new(Arc::new(FixedCapacity(capacity))))
}

pub(crate) fn staged(action: Arc<Staged>) -> Arc<Reader> {
    Arc::new(move |_, route| {
        let route = route.to_owned();
        let action = action.clone();
        let miss = Unimock::new((
            BackgroundMissMock::root_eligible
                .each_call(matching!())
                .returns(true),
            BackgroundMissMock::complete
                .some_call(matching!(_))
                .answers_arc(Arc::new(move |mock, completion| {
                    action(
                        &mock,
                        &route,
                        completion.expect("an eligible miss resumes with a Stage"),
                    )
                })),
        ))
        .no_verify_in_drop();
        Ok(Some(BackgroundRead::Miss(Box::new(miss))))
    })
}
