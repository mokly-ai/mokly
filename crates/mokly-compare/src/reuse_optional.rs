//! Optional arenas are borrowed under the registry guard and hold no escaping owners.

use std::sync::{Arc, RwLock, Weak};

use crate::reuse_budget::{Charge, Resident};
use crate::validation_facts::Data;

pub(crate) struct Arena {
    pub(crate) data: RwLock<Option<Data>>,
    _charge: Charge,
}

impl Arena {
    pub(crate) fn new(charge: Charge) -> Self {
        let data_charge = charge.empty();
        Self {
            _charge: charge,
            data: RwLock::new(Some(Data::new(data_charge))),
        }
    }
    pub(crate) fn clear(&self) {
        self.data
            .write()
            .unwrap_or_else(|error| error.into_inner())
            .take();
    }
}

pub(crate) struct Owner {
    pub(crate) id: usize,
    pub(crate) resident: Weak<Resident>,
}

impl Owner {
    pub(crate) fn into_id(mut self) -> usize {
        self.resident = Weak::new();
        self.id
    }
}

impl Drop for Owner {
    fn drop(&mut self) {
        if let Some(resident) = self.resident.upgrade() {
            resident.remove_optional(self.id);
        }
    }
}

pub(crate) fn arena(charge: Charge) -> Arc<Arena> {
    Arc::new(Arena::new(charge))
}
