//! Fresh batch admission for actual misses, without retaining a worker.

use std::sync::{Arc, Mutex};

use tokio::sync::{Notify, Semaphore};

use crate::background_capacity::BackgroundCapacity;

pub(crate) struct Admission {
    capacity: Arc<dyn BackgroundCapacity>,
    active: Mutex<usize>,
    turn: Semaphore,
    changed: Notify,
}

impl Admission {
    pub(crate) fn new(capacity: Arc<dyn BackgroundCapacity>) -> Arc<Self> {
        Arc::new(Self {
            capacity,
            active: Mutex::new(0),
            turn: Semaphore::new(1),
            changed: Notify::new(),
        })
    }

    pub(crate) async fn acquire(self: &Arc<Self>) -> Option<BatchPlace> {
        let _turn = self.turn.acquire().await.ok()?;
        loop {
            let changed = self.changed.notified();
            tokio::pin!(changed);
            changed.as_mut().enable();
            {
                let mut active = self
                    .active
                    .lock()
                    .unwrap_or_else(|error| error.into_inner());
                if *active < self.capacity.capacity().max(1) {
                    *active += 1;
                    return Some(BatchPlace(self.clone()));
                }
            }
            changed.await;
        }
    }
}

pub(crate) struct BatchPlace(Arc<Admission>);

impl Drop for BatchPlace {
    fn drop(&mut self) {
        *self
            .0
            .active
            .lock()
            .unwrap_or_else(|error| error.into_inner()) -= 1;
        self.0.changed.notify_waiters();
    }
}
