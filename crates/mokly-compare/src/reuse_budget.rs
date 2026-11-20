//! Atomic reservations follow retained allocations through staging and draining owners.

use std::collections::BTreeMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, Weak};

pub(crate) struct Resident {
    bound: usize,
    bytes: AtomicUsize,
    peak: AtomicUsize,
    shared: Mutex<BTreeMap<usize, Weak<Charge>>>,
}

impl Resident {
    pub(crate) fn new(bound: usize) -> Arc<Self> {
        Arc::new(Self {
            bound,
            bytes: AtomicUsize::new(0),
            peak: AtomicUsize::new(0),
            shared: Mutex::new(BTreeMap::new()),
        })
    }
    pub(crate) fn bytes(&self) -> usize {
        self.bytes.load(Ordering::Acquire)
    }
    pub(crate) fn peak(&self) -> usize {
        self.peak.load(Ordering::Acquire)
    }
    pub(crate) fn reserve(self: &Arc<Self>, bytes: usize) -> Option<Charge> {
        let previous = self
            .bytes
            .fetch_update(Ordering::AcqRel, Ordering::Acquire, |current| {
                current
                    .checked_add(bytes)
                    .filter(|next| *next <= self.bound)
            })
            .ok()?;
        self.peak.fetch_max(previous + bytes, Ordering::AcqRel);
        Some(Charge {
            resident: self.clone(),
            bytes,
            shared: None,
        })
    }
    pub(crate) fn shared(self: &Arc<Self>, identity: usize, bytes: usize) -> Option<Arc<Charge>> {
        let mut shared = self
            .shared
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if let Some(charge) = shared.get(&identity).and_then(Weak::upgrade) {
            return Some(charge);
        }
        let mut reserved = self.reserve(bytes + 320)?;
        reserved.shared = Some(identity);
        let charge = Arc::new(reserved);
        shared.insert(identity, Arc::downgrade(&charge));
        Some(charge)
    }
}

pub(crate) struct Charge {
    resident: Arc<Resident>,
    bytes: usize,
    shared: Option<usize>,
}

impl Charge {
    pub(crate) fn bytes(&self) -> usize {
        self.bytes
    }
    pub(crate) fn grow(&mut self, bytes: usize) -> bool {
        let Ok(previous) =
            self.resident
                .bytes
                .fetch_update(Ordering::AcqRel, Ordering::Acquire, |current| {
                    current
                        .checked_add(bytes)
                        .filter(|next| *next <= self.resident.bound)
                })
        else {
            return false;
        };
        self.bytes += bytes;
        self.resident
            .peak
            .fetch_max(previous + bytes, Ordering::AcqRel);
        true
    }
}
impl Drop for Charge {
    fn drop(&mut self) {
        if let Some(identity) = self.shared {
            let mut shared = self
                .resident
                .shared
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            if shared
                .get(&identity)
                .is_some_and(|charge| std::ptr::eq(charge.as_ptr(), self))
            {
                shared.remove(&identity);
            }
        }
        self.resident.bytes.fetch_sub(self.bytes, Ordering::AcqRel);
    }
}
