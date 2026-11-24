//! Explicit test time shared by the WebSocket and authentication service.

use std::future::Future;
use std::pin::Pin;
use std::time::Duration;

use chrono::{DateTime, TimeDelta, Utc};
use mkc_api::live_clock::LiveClock;
use mkc_auth::runtime::{Runtime, SystemRuntime};
use mkc_store_interface::error::Result;
use tokio::sync::watch;
use tokio::time::Instant;
use uuid::Uuid;

pub(super) struct Clock {
    start: Instant,
    current: watch::Sender<Instant>,
}

impl Clock {
    pub(super) fn new() -> Self {
        let start = Instant::now();
        Self {
            start,
            current: watch::Sender::new(start),
        }
    }

    pub(super) fn advance(&self, seconds: u64) {
        self.current
            .send_modify(|time| *time += Duration::from_secs(seconds));
    }
}

impl LiveClock for Clock {
    fn now(&self) -> Instant {
        *self.current.borrow()
    }

    fn wait_until(&self, at: Instant) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        let mut current = self.current.subscribe();
        Box::pin(async move {
            current.wait_for(|time| *time >= at).await.unwrap();
        })
    }
}

impl Runtime for Clock {
    fn now(&self) -> DateTime<Utc> {
        let epoch: DateTime<Utc> = "2026-11-24T12:00:00Z".parse().unwrap();
        epoch + TimeDelta::from_std(self.monotonic()).unwrap()
    }

    fn monotonic(&self) -> Duration {
        LiveClock::now(self).duration_since(self.start)
    }

    fn id(&self) -> Uuid {
        SystemRuntime.id()
    }

    fn secret(&self) -> Result<String> {
        SystemRuntime.secret()
    }
}
