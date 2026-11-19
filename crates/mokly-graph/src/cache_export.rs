//! Non-promoting document export and writer workspace reservations.

use std::sync::{Arc, Mutex};

use crate::cache::{Artifact, MemoryCache};
use crate::cache_state::State;
use crate::document_codec::EncodedView;
use crate::key::NodeKey;

/// Writer-side consumer that cannot keep an uncharged encoded handle.
pub trait EncodedConsumer: Send {
    /// Consume one borrowed document within its cache reservation.
    fn consume(&mut self, document: &EncodedView);
}

/// Work performed while its fixed scratch-space charge remains reserved.
pub trait CacheOperation: Send {
    /// Run outside the cache lock.
    fn run(&mut self);
}

enum Source {
    Full(Arc<Artifact>),
    Compact(Arc<EncodedView>),
}

struct Reservation<'a> {
    state: &'a Mutex<State>,
    bytes: usize,
    lease: Option<usize>,
    source: Option<Source>,
}

impl Drop for Reservation<'_> {
    fn drop(&mut self) {
        self.source = None;
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        state.exporting -= self.bytes;
        if let Some(lease) = self.lease {
            state.encoders.release(lease);
        }
    }
}

impl MemoryCache {
    pub(crate) fn export(&self, key: &NodeKey, consumer: &mut dyn EncodedConsumer) -> bool {
        let reservation = {
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            let (source, cost) = if let Some((value, cost)) = state.compact.peek(key) {
                (Source::Compact(value), cost)
            } else if let Some((value, cost)) =
                state.full.peek(key).or_else(|| state.transit.peek(key))
            {
                if value.document.is_none() {
                    return false;
                }
                (Source::Full(value), cost)
            } else {
                return false;
            };
            let Some(bytes) = cost
                .checked_mul(3)
                .filter(|bytes| *bytes <= state.headroom())
            else {
                return false;
            };
            let lease = if matches!(&source, Source::Full(_)) {
                let available = state.headroom() - bytes;
                let Some(lease) = state.encoders.take(available) else {
                    return false;
                };
                Some(lease)
            } else {
                None
            };
            state.exporting += bytes;
            Reservation {
                state: &self.state,
                bytes,
                lease,
                source: Some(source),
            }
        };
        match &reservation.source {
            Some(Source::Compact(value)) => consumer.consume(value),
            Some(Source::Full(value)) => {
                let Some(lease) = reservation.lease else {
                    return false;
                };
                let Ok(encoded) = self.encoder.encode(value, lease) else {
                    return false;
                };
                consumer.consume(&encoded);
            }
            None => return false,
        }
        true
    }

    pub(crate) fn workspace(&self, bytes: usize, operation: &mut dyn CacheOperation) -> bool {
        let _reservation = {
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            if bytes > state.headroom() {
                return false;
            }
            state.exporting += bytes;
            Reservation {
                state: &self.state,
                bytes,
                lease: None,
                source: None,
            }
        };
        operation.run();
        true
    }
}
