//! Shared root input state before templates or JavaScript build a tree.

use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_model::catalogue::{EntryContent, ModelEntry};

use crate::composition::ComposeRequest;
use crate::context::Context;
use crate::error::Result;
use crate::fragment::RenderKind;
use crate::{root_inputs, slots};

pub(crate) struct Start {
    pub(crate) parent: String,
    pub(crate) kind: RenderKind,
    pub(crate) context: Context,
}

impl Start {
    pub(crate) fn eligible(catalogue: &PreparedCatalogue, entry: &ModelEntry) -> bool {
        let parent = entry
            .metadata
            .variant_of
            .as_deref()
            .unwrap_or(&entry.metadata.path);
        matches!(
            entry.content,
            EntryContent::Screen { .. } | EntryContent::Component { .. } | EntryContent::Page
        ) && !catalogue.templates.contains_key(parent)
            && catalogue
                .slot_fragments
                .get(&entry.metadata.path)
                .is_none_or(|slots| slots.is_empty())
    }

    pub(crate) fn new(request: &ComposeRequest<'_>) -> Result<Self> {
        let mut context = root_inputs::context(request)?;
        slots::saved(request, &mut context)?;
        Ok(Self {
            parent: root_inputs::parent(request.entry).to_owned(),
            kind: root_inputs::kind(request.entry),
            context,
        })
    }
}
