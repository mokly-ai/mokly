//! Shared checked retry deadline calculation.

use chrono::{DateTime, Duration, Utc};

/// Add an external delay without allowing an oversized value to panic a worker.
pub(crate) fn retry_deadline(now: DateTime<Utc>, delay_seconds: u64) -> DateTime<Utc> {
    i64::try_from(delay_seconds)
        .ok()
        .and_then(Duration::try_seconds)
        .and_then(|duration| now.checked_add_signed(duration))
        .unwrap_or(DateTime::<Utc>::MAX_UTC)
}
