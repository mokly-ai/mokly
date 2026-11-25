//! Explicit socket time and an optional fixed wall time for authentication.

use std::future::Future;
use std::pin::Pin;
use std::sync::Mutex;
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
    scheduled: watch::Sender<Instant>,
    wall_time: Mutex<Option<DateTime<Utc>>>,
}

impl Clock {
    pub(super) fn new() -> Self {
        let start = Instant::now();
        Self {
            start,
            current: watch::Sender::new(start),
            scheduled: watch::Sender::new(start),
            wall_time: Mutex::new(None),
        }
    }

    pub(super) fn advance(&self, seconds: u64) {
        self.current
            .send_modify(|time| *time += Duration::from_secs(seconds));
    }

    /// Freeze authentication time while socket timers still advance.
    pub(super) fn hold_wall_time(&self, at: DateTime<Utc>) {
        *self.wall_time.lock().unwrap() = Some(at);
    }

    /// Wait until the socket schedules this deadline relative to its start.
    pub(super) async fn wait_for_scheduled_deadline(&self, seconds_from_start: u64) {
        let at = self.start + Duration::from_secs(seconds_from_start);
        self.scheduled
            .subscribe()
            .wait_for(|next| *next == at)
            .await
            .unwrap();
    }
}

impl LiveClock for Clock {
    fn now(&self) -> Instant {
        *self.current.borrow()
    }

    fn wait_until(&self, at: Instant) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        self.scheduled.send_replace(at);
        let mut current = self.current.subscribe();
        Box::pin(async move {
            current.wait_for(|time| *time >= at).await.unwrap();
        })
    }
}

impl Runtime for Clock {
    fn now(&self) -> DateTime<Utc> {
        if let Some(at) = *self.wall_time.lock().unwrap() {
            return at;
        }
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
