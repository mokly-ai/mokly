//! Serve document identity and final-validation write admission.

use mokly_model::catalogue::EntryContent;

use crate::document_store::StoreKey;
use crate::planning;
use crate::session::Session;

/// One view's captured store key and final decision about a persistent read.
pub(crate) enum DocumentLookup {
    /// A possible hit keeps its ordinary worker load.
    Read(Option<StoreKey>),
    /// No later store load may replace this attempt's prepared root.
    Miss(Option<StoreKey>),
}

impl DocumentLookup {
    /// Only a frozen miss may acquire a root before worker dispatch.
    pub(crate) fn allows_preparation(&self) -> bool {
        matches!(self, Self::Miss(_))
    }

    /// Charge the key's heap allocation outside the job's inline size.
    pub(crate) fn retained_bytes(&self) -> usize {
        match self {
            Self::Read(key) | Self::Miss(key) => key.as_ref().map_or(0, |key| key.0.capacity()),
        }
    }
}

impl Session {
    /// Capture identity once and inspect the optional non-consuming miss capability.
    pub(crate) fn background_lookup(&self, route: &str) -> DocumentLookup {
        let key = self.stored_key(route);
        if let (Some(requested), Some(persistence)) = (&key, &self.state.inputs.persistence)
            && !persistence.store.try_miss(requested)
        {
            return DocumentLookup::Read(key);
        }
        DocumentLookup::Miss(key)
    }

    pub(crate) fn stored_key(&self, route: &str) -> Option<StoreKey> {
        let persistence = self.state.inputs.persistence.as_ref()?;
        let native = persistence.store.identity()?;
        let plan = &self.state.plans[route];
        let catalogue = &self.state.catalogue;
        let entry = &catalogue.model.entries[plan.entry];
        let parent = entry
            .metadata
            .variant_of
            .as_ref()
            .unwrap_or(&entry.metadata.path);
        let javascript = !matches!(entry.content, EntryContent::Document { .. })
            && (catalogue.javascript.entries.contains_key(parent)
                || !catalogue.javascript.entries.is_empty()
                    && planning::components(&entry.metadata.path, catalogue)
                        .iter()
                        .any(|path| catalogue.javascript.entries.contains_key(path)));
        let extra = if javascript {
            persistence.javascript.as_deref()?
        } else {
            ""
        };
        Some(StoreKey::new(
            &plan.key,
            &format!("{}:{native}{extra}", native.len()),
        ))
    }

    pub(crate) fn offer_document(&self, route: &str) {
        let key = self
            .state
            .fresh
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .remove(&self.state.plans[route].key.0);
        if let (Some(key), Some(persistence)) = (key, &self.state.inputs.persistence) {
            persistence
                .store
                .offer(key, self.state.plans[route].key.clone());
        }
    }
}
