//! Five-attempt request policy, bounded backoff, expiry and cancellation.

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use crate::completion::retryable;
use crate::error::{Error, Result};
use crate::http::{Body, Http, Request, Response, Step};
use crate::runtime::{Cancellation, Clock, Timer};
use crate::settings::Settings;

/// Collaborators borrowed by one attempt sequence.
pub(crate) struct Requests<'a> {
    pub http: &'a dyn Http,
    pub clock: &'a dyn Clock,
    pub settings: &'a Settings,
    pub cancellation: &'a dyn Cancellation,
}

impl Requests<'_> {
    pub(crate) async fn send(
        &self,
        original: &Request,
        expiry: Option<i64>,
        attempted: Option<&AtomicBool>,
    ) -> Result<Response> {
        self.settings.receiver_url(original.url.as_str())?;
        for attempt in 0..5 {
            if self.cancellation.is_cancelled() {
                return Err(Error::Cancelled);
            }
            let remaining = self.remaining(expiry)?;
            let mut request = original.clone();
            request.timeout = Duration::from_millis(remaining.min(120_000));
            if let Some(attempted) = attempted {
                attempted.store(true, Ordering::SeqCst);
            }
            let result = tokio::select! {
                biased;
                result = self.http.send(&request, &self.settings.token) => result,
                () = self.cancellation.cancelled() => return Err(Error::Cancelled),
            };
            let retry_after = match result {
                Ok(response) => {
                    let unreadable_plan = request.step == Step::Plan
                        && response.status == 200
                        && matches!(response.body, Body::Unreadable);
                    if !retryable(response.status) && !unreadable_plan {
                        return Ok(response);
                    }
                    response.retry_after
                }
                Err(_) => None,
            };
            self.remaining(expiry)?;
            if attempt == 4 {
                return Err(Error::Transport);
            }
            let jitter_max = 1_000_u64 << attempt;
            let delay = retry_after
                .as_deref()
                .and_then(retry_after_seconds)
                .map_or_else(|| self.clock.jitter(jitter_max), |seconds| seconds * 1000);
            if delay >= self.remaining(expiry)? {
                return Err(Error::Replan);
            }
            tokio::select! {
                biased;
                () = self.cancellation.cancelled() => return Err(Error::Cancelled),
                () = self.clock.sleep(Timer::Backoff, Duration::from_millis(delay)) => {}
            }
        }
        Err(Error::Transport)
    }

    fn remaining(&self, expiry: Option<i64>) -> Result<u64> {
        match expiry {
            None => Ok(u64::MAX),
            Some(expiry) => {
                let remaining = expiry.saturating_sub(self.clock.now());
                if remaining <= 0 {
                    Err(Error::Replan)
                } else {
                    Ok(remaining as u64)
                }
            }
        }
    }
}

pub(crate) fn retry_after_seconds(value: &str) -> Option<u64> {
    if value.is_empty() || !value.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    value.parse::<u64>().ok().filter(|seconds| *seconds <= 60)
}
