//! Cache fill coordination and lifetime byte reservations.

use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex, Weak};

use bytes::Bytes;
use tokio::sync::Notify;

use crate::cache::{CacheError, CacheKey, Core, Entry};
use crate::error::{Error as CatalogueError, Result};

enum FillState {
    Pending,
    Complete(Option<Arc<Entry>>),
}

pub(super) struct FillSignal {
    state: Mutex<FillState>,
    notify: Notify,
}

/// An asynchronous follower for the key's current fill.
#[expect(unreachable_pub, reason = "unimock exposes method output types")]
pub struct FillWaiter {
    signal: Arc<FillSignal>,
}

/// Exclusive reservation for one key's in-flight fill.
#[expect(unreachable_pub, reason = "unimock exposes method output types")]
pub struct FillReservation {
    core: Arc<Core>,
    key: CacheKey,
    signal: Arc<FillSignal>,
    reservation: Option<ByteReservation>,
    length: u64,
    completed: bool,
}

pub(super) struct ByteReservation {
    core: Weak<Core>,
    bytes: u64,
}

struct EntryOwner(Arc<Entry>);

impl AsRef<[u8]> for EntryOwner {
    fn as_ref(&self) -> &[u8] {
        &self.0.bytes
    }
}

impl Core {
    pub(super) fn reserve(self: &Arc<Self>, bytes: u64) -> Option<ByteReservation> {
        let result = self
            .used
            .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |used| {
                used.checked_add(bytes)
                    .filter(|next| *next <= self.capacity)
            });
        let previous = result.ok()?;
        self.peak.fetch_max(previous + bytes, Ordering::SeqCst);
        Some(ByteReservation {
            core: Arc::downgrade(self),
            bytes,
        })
    }
}

impl FillSignal {
    pub(super) fn new() -> Self {
        Self {
            state: Mutex::new(FillState::Pending),
            notify: Notify::new(),
        }
    }

    fn complete(&self, entry: Option<Arc<Entry>>) -> Result<()> {
        let mut state = match self.state.lock() {
            Ok(state) => state,
            Err(_) => return Err(CatalogueError::internal(CacheError::LockPoisoned)),
        };
        *state = FillState::Complete(entry);
        self.notify.notify_waiters();
        Ok(())
    }
}

impl FillWaiter {
    pub(super) fn new(signal: Arc<FillSignal>) -> Self {
        Self { signal }
    }

    pub(crate) async fn wait(self) -> Result<Option<Bytes>> {
        loop {
            let notified = self.signal.notify.notified();
            tokio::pin!(notified);
            notified.as_mut().enable();
            let outcome = {
                let state = match self.signal.state.lock() {
                    Ok(state) => state,
                    Err(_) => return Err(CatalogueError::internal(CacheError::LockPoisoned)),
                };
                match &*state {
                    FillState::Pending => None,
                    FillState::Complete(entry) => Some(entry.clone()),
                }
            };
            if let Some(entry) = outcome {
                return Ok(entry.map(accounted_bytes));
            }
            notified.as_mut().await;
        }
    }
}

impl FillReservation {
    pub(super) fn new(
        core: Arc<Core>,
        key: CacheKey,
        signal: Arc<FillSignal>,
        reservation: ByteReservation,
        length: u64,
    ) -> Self {
        Self {
            core,
            key,
            signal,
            reservation: Some(reservation),
            length,
            completed: false,
        }
    }

    pub(crate) fn complete(mut self, bytes: Bytes) -> Result<Bytes> {
        if bytes.len() as u64 != self.length {
            return Err(CatalogueError::internal(CacheError::LengthMismatch));
        }
        let entry = Arc::new(Entry {
            bytes,
            _reservation: self
                .reservation
                .take()
                .ok_or_else(|| CatalogueError::internal(CacheError::LengthMismatch))?,
        });
        {
            let mut state = self.core.state()?;
            state.fills.remove(&self.key);
            state.entries.put(self.key.clone(), entry.clone());
        }
        self.signal.complete(Some(entry.clone()))?;
        self.completed = true;
        Ok(accounted_bytes(entry))
    }
}

impl Drop for FillReservation {
    fn drop(&mut self) {
        if self.completed {
            return;
        }
        if let Ok(mut state) = self.core.state.lock()
            && state
                .fills
                .get(&self.key)
                .is_some_and(|signal| Arc::ptr_eq(signal, &self.signal))
        {
            state.fills.remove(&self.key);
        }
        let _ = self.signal.complete(None);
    }
}

impl Drop for ByteReservation {
    fn drop(&mut self) {
        if let Some(core) = self.core.upgrade() {
            core.used.fetch_sub(self.bytes, Ordering::SeqCst);
        }
    }
}

pub(super) fn accounted_bytes(entry: Arc<Entry>) -> Bytes {
    Bytes::from_owner(EntryOwner(entry))
}
