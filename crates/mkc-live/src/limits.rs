//! Size and rate limits on messages sent by a project socket.

use std::collections::VecDeque;
use std::time::Duration;

use mkc_live_interface::error::{Error, Result};
use tokio::time::Instant;

/// The largest client frame the channel accepts, in bytes.
pub const MAX_CLIENT_MESSAGE_BYTES: usize = 4 * 1024;

/// The WebSocket close code for a frame that exceeds the size limit.
pub const MESSAGE_TOO_LARGE_CLOSE_CODE: u16 = 1009;

const RATE_WINDOW: Duration = Duration::from_secs(1);
const MESSAGES_PER_SECOND: usize = 120;

/// Check the size of a frame before passing its text to the hub.
pub fn check_frame_size(bytes: usize) -> Result<()> {
    if bytes > MAX_CLIENT_MESSAGE_BYTES {
        return Err(Error::FrameTooLarge { bytes });
    }
    Ok(())
}

#[derive(Default)]
pub(super) struct RateLimit {
    admitted: VecDeque<Instant>,
}

impl RateLimit {
    pub(super) fn admit(&mut self, now: Instant) -> bool {
        while self
            .admitted
            .front()
            .is_some_and(|time| now.duration_since(*time) >= RATE_WINDOW)
        {
            self.admitted.pop_front();
        }
        if self.admitted.len() == MESSAGES_PER_SECOND {
            return false;
        }
        self.admitted.push_back(now);
        true
    }
}
