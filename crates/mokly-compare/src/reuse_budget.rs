//! Atomic reservations follow retained allocations through staging and draining owners.

use std::collections::BTreeMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, RwLock, Weak};

use crate::reuse_optional::{self, Arena, Owner};

pub(crate) struct Resident {
    bound: usize,
    bytes: AtomicUsize,
    peak: AtomicUsize,
    shared: Mutex<BTreeMap<usize, Weak<Charge>>>,
    optional: RwLock<BTreeMap<usize, Arc<Arena>>>,
    next: AtomicUsize,
    admission: RwLock<()>,
    fact_bytes: AtomicUsize,
    fact_peak: AtomicUsize,
}

impl Resident {
    pub(crate) fn new(bound: usize) -> Arc<Self> {
        Arc::new(Self {
            bound,
            bytes: AtomicUsize::new(0),
            peak: AtomicUsize::new(0),
            shared: Mutex::new(BTreeMap::new()),
            optional: RwLock::new(BTreeMap::new()),
            next: AtomicUsize::new(0),
            admission: RwLock::new(()),
            fact_bytes: AtomicUsize::new(0),
            fact_peak: AtomicUsize::new(0),
        })
    }
    pub(crate) fn bytes(&self) -> usize {
        self.bytes.load(Ordering::Acquire)
    }
    pub(crate) fn peak(&self) -> usize {
        self.peak.load(Ordering::Acquire)
    }
    pub(crate) fn reserve(self: &Arc<Self>, bytes: usize) -> Option<Charge> {
        if let Some(charge) = self.try_reserve(bytes, false) {
            return Some(charge);
        }
        let _guard = self
            .admission
            .write()
            .unwrap_or_else(|error| error.into_inner());
        if let Some(charge) = self.try_reserve(bytes, false) {
            return Some(charge);
        }
        self.reclaim();
        self.try_reserve(bytes, false)
    }
    fn reclaim(&self) {
        self.reclaim_snapshot(self.eviction_snapshot());
    }
    fn eviction_snapshot(&self) -> Vec<(usize, Arc<Arena>)> {
        self.optional
            .read()
            .unwrap_or_else(|error| error.into_inner())
            .iter()
            .map(|(id, arena)| (*id, arena.clone()))
            .collect()
    }
    fn reclaim_snapshot(&self, snapshot: Vec<(usize, Arc<Arena>)>) {
        for (_, arena) in &snapshot {
            arena.clear();
        }
        let mut arenas = self
            .optional
            .write()
            .unwrap_or_else(|error| error.into_inner());
        for (id, _) in &snapshot {
            arenas.remove(id);
        }
    }
    fn try_reserve(self: &Arc<Self>, bytes: usize, optional: bool) -> Option<Charge> {
        let previous = self
            .bytes
            .fetch_update(Ordering::AcqRel, Ordering::Acquire, |current| {
                current
                    .checked_add(bytes)
                    .filter(|next| *next <= self.bound)
            })
            .ok()?;
        self.peak.fetch_max(previous + bytes, Ordering::AcqRel);
        if optional {
            let previous = self.fact_bytes.fetch_add(bytes, Ordering::AcqRel);
            self.fact_peak.fetch_max(previous + bytes, Ordering::AcqRel);
        }
        Some(Charge {
            resident: self.clone(),
            bytes,
            owner: if optional {
                Ownership::Fact
            } else {
                Ownership::Owned
            },
        })
    }
    pub(crate) fn reserve_optional(self: &Arc<Self>, bytes: usize) -> Option<Charge> {
        let _guard = self.admission.try_read().ok()?;
        self.try_reserve(bytes, true)
    }
    pub(crate) fn register_optional(self: &Arc<Self>, bytes: usize) -> Option<Owner> {
        let _guard = self.admission.try_read().ok()?;
        let charge = self.try_reserve(bytes, true)?;
        let id = self.next.fetch_add(1, Ordering::Relaxed);
        self.optional
            .write()
            .unwrap_or_else(|error| error.into_inner())
            .insert(id, reuse_optional::arena(charge));
        Some(Owner {
            id,
            resident: Arc::downgrade(self),
        })
    }
    pub(crate) fn with_optional<T>(
        &self,
        ids: [Option<usize>; 2],
        run: impl FnOnce([Option<&Arena>; 2]) -> T,
    ) -> T {
        let arenas = self
            .optional
            .read()
            .unwrap_or_else(|error| error.into_inner());
        run(ids.map(|id| id.and_then(|id| arenas.get(&id).map(Arc::as_ref))))
    }
    pub(crate) fn remove_optional(&self, id: usize) {
        self.optional
            .write()
            .unwrap_or_else(|error| error.into_inner())
            .remove(&id);
    }
    pub(crate) fn fact_bytes(&self) -> usize {
        self.fact_bytes.load(Ordering::Acquire)
    }
    pub(crate) fn fact_peak(&self) -> usize {
        self.fact_peak.load(Ordering::Acquire)
    }
    pub(crate) fn shared(self: &Arc<Self>, identity: usize, bytes: usize) -> Option<Arc<Charge>> {
        let existing = self
            .shared
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .get(&identity)
            .and_then(Weak::upgrade);
        if let Some(charge) = existing {
            return Some(charge);
        }
        let mut reserved = self.reserve(bytes + 320)?;
        let mut shared = self
            .shared
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if let Some(charge) = shared.get(&identity).and_then(Weak::upgrade) {
            return Some(charge);
        }
        reserved.owner = Ownership::Shared(identity);
        let charge = Arc::new(reserved);
        shared.insert(identity, Arc::downgrade(&charge));
        Some(charge)
    }
}

pub(crate) struct Charge {
    resident: Arc<Resident>,
    bytes: usize,
    owner: Ownership,
}

/// The charge owns its registration without a separate classification handle.
enum Ownership {
    Owned,
    Shared(usize),
    Optional(usize),
    Fact,
}

impl Charge {
    pub(crate) fn attach_optional(&mut self, owner: Owner) {
        self.owner = Ownership::Optional(owner.into_id());
    }
    pub(crate) fn optional_id(&self) -> Option<usize> {
        if let Ownership::Optional(id) = self.owner {
            Some(id)
        } else {
            None
        }
    }

    fn is_optional(&self) -> bool {
        matches!(self.owner, Ownership::Fact)
    }
    pub(crate) fn shrink(&mut self, bytes: usize) {
        let bytes = bytes.min(self.bytes);
        self.bytes -= bytes;
        self.resident.bytes.fetch_sub(bytes, Ordering::AcqRel);
        if self.is_optional() {
            self.resident.fact_bytes.fetch_sub(bytes, Ordering::AcqRel);
        }
    }
    pub(crate) fn empty(&self) -> Self {
        Self {
            resident: self.resident.clone(),
            bytes: 0,
            owner: if self.is_optional() {
                Ownership::Fact
            } else {
                Ownership::Owned
            },
        }
    }
    pub(crate) fn bytes(&self) -> usize {
        self.bytes
    }
    pub(crate) fn grow(&mut self, bytes: usize) -> bool {
        let added = if self.is_optional() {
            self.resident.reserve_optional(bytes)
        } else {
            self.resident.reserve(bytes)
        };
        let Some(mut added) = added else {
            return false;
        };
        self.bytes += bytes;
        added.bytes = 0;
        true
    }
}
impl Drop for Charge {
    fn drop(&mut self) {
        if let Ownership::Shared(identity) = self.owner {
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
        if let Ownership::Optional(id) = self.owner {
            self.resident.remove_optional(id);
        }
        self.resident.bytes.fetch_sub(self.bytes, Ordering::AcqRel);
        if self.is_optional() {
            self.resident
                .fact_bytes
                .fetch_sub(self.bytes, Ordering::AcqRel);
        }
    }
}

#[cfg(test)]
#[path = "_tests_/optional_budget_tests.rs"]
mod optional_budget_tests;
