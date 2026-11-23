//! Link-check inputs of one logical target, read without its destination documents.

use mokly_model::catalogue::EntryContent;

use crate::comparison_proof::{ContentIdentity, content_identity};
use crate::session::Session;

impl Session {
    /// Identify every input that a link check of this target reads from other views: the
    /// destination entry, the first screen of a use case, and the route and document key of
    /// each view that the check reads. The document keys identify the destination anchors.
    /// The resolution follows the destination step of the complete link checks exactly.
    pub(crate) fn link_identity(&self, target: &str) -> Option<ContentIdentity> {
        let entries = &self.state.catalogue.model.entries;
        let index = &self.state.link_index;
        let destination = index.entry(entries, target);
        let screen = destination.and_then(|entry| match &entries[entry].content {
            EntryContent::UseCase { steps } => {
                let path = steps
                    .first()
                    .map_or(target, |step| step.screen_path.as_str());
                index.entry(entries, path)
            }
            _ => Some(entry),
        });
        let views: Vec<_> = screen
            .map(|entry| {
                index
                    .views(&self.state.plans, entries, entry)
                    .map(|(_, plan)| (plan.route.as_str(), plan.key.0.as_str()))
                    .collect()
            })
            .unwrap_or_default();
        let resolved = screen.map(|entry| entries[entry].metadata.path.as_str());
        let encoded = serde_json::to_vec(&(destination.is_some(), resolved, views)).ok()?;
        Some(content_identity(&encoded))
    }
}
