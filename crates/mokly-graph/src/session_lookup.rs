//! One ordinary cache/store read shared by foreground and background composition.

use std::sync::Arc;

use mokly_html::prepared_root::PreparedRoot;

use crate::cache::Artifact;
use crate::document_composition;
use crate::document_store::{ReadOutcome, StoreKey};
use crate::error::{GraphError, Result, invalid};
use crate::session::Session;
use crate::session_render::record_axes;

pub(crate) enum DocumentRead {
    Hit(Arc<Artifact>),
    Miss(Option<StoreKey>),
}

impl Session {
    pub(crate) fn raw_lookup(&self, route: &str) -> Result<DocumentRead> {
        let plan = self
            .state
            .plans
            .get(route)
            .ok_or_else(|| invalid(route, "document route is absent from this generation"))?;
        record_axes(plan);
        if let Some(artifact) = self.state.cache.get(&plan.key) {
            tracing::Span::current().record("cache_hit", true);
            return Ok(DocumentRead::Hit(artifact));
        }
        let key = self.stored_key(route);
        if let (Some(key), Some(persistence)) = (&key, &self.state.inputs.persistence)
            && let ReadOutcome::Hit(artifact) | ReadOutcome::HitWithStoreFault(artifact) =
                persistence.store.load(key)
        {
            if artifact
                .document
                .as_ref()
                .is_none_or(|document| document.story_render_failure().is_none())
            {
                self.state
                    .composer
                    .record_served(&document_composition::request(
                        self,
                        plan,
                        &self.state.catalogue.model.entries[plan.entry],
                    ));
            }
            return Ok(DocumentRead::Hit(artifact));
        }
        Ok(DocumentRead::Miss(key))
    }

    pub(crate) fn compose_miss(
        &self,
        route: &str,
        key: Option<StoreKey>,
        prepared: Option<PreparedRoot>,
    ) -> Result<Arc<Artifact>> {
        let plan = self
            .state
            .plans
            .get(route)
            .ok_or_else(|| invalid(route, "document route is absent from this generation"))?;
        let entry = &self.state.catalogue.model.entries[plan.entry];
        match document_composition::document(self, plan, entry, prepared) {
            Ok(artifact) => {
                if let Some(key) = key {
                    self.state
                        .fresh
                        .lock()
                        .unwrap_or_else(|error| error.into_inner())
                        .insert(plan.key.0.clone(), key);
                }
                Ok(artifact)
            }
            Err(source) => Err(GraphError::Document {
                entry: entry.metadata.path.clone(),
                source: Box::new(source),
            }),
        }
    }
}
