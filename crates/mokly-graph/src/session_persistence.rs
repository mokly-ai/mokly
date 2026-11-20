//! Serve document identity and final-validation write admission.

use mokly_model::catalogue::EntryContent;

use crate::document_store::StoreKey;
use crate::planning;
use crate::session::Session;

impl Session {
    /// Probe the complete persistent identity without restoring the indexed document.
    pub(crate) fn has_stored_document(&self, route: &str) -> bool {
        self.state
            .inputs
            .persistence
            .as_ref()
            .is_some_and(|persistence| {
                self.stored_key(route)
                    .is_some_and(|key| persistence.store.contains(&key))
            })
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
