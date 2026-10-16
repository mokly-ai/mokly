//! Debounce resets only for accepted events and uses checked monotonic deadlines.

use std::sync::Arc;
use std::time::Duration;

use mokly_server::error::Result;
use mokly_watch::event::Batch;
use tokio::sync::mpsc;

use crate::serve_rebuild::{RebuildReporter, Serving};
use crate::serve_watch::WatchInputs;

pub(super) async fn settle(
    watch: Arc<dyn WatchInputs>,
    batch: &mut Batch,
    reporter: Arc<dyn RebuildReporter>,
    requests: &mut mpsc::Receiver<()>,
    serving: &mut Serving<'_>,
) -> Option<Result<()>> {
    let delay = watch.plan().debounce;
    let timer = tokio::time::sleep_until(deadline(delay));
    tokio::pin!(timer);
    loop {
        tokio::select! {
            result = &mut *serving => return Some(result),
            _ = &mut timer => return None,
            Some(()) = requests.recv() => {
                batch.rebuild();
                timer.as_mut().reset(deadline(delay));
            },
            () = watch.changed() => {
                if watch.drain(batch, reporter.clone()).await { timer.as_mut().reset(deadline(delay)); }
            },
        }
    }
}

fn deadline(delay: Duration) -> tokio::time::Instant {
    let now = tokio::time::Instant::now();
    now.checked_add(delay).unwrap_or(now)
}

#[cfg(test)]
#[path = "_tests_/serve_debounce_tests.rs"]
mod serve_debounce_tests;
