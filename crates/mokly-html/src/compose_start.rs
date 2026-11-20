//! Shared root input state before templates or JavaScript build a tree.

use std::collections::BTreeMap;

use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_model::catalogue::{EntryContent, ModelEntry};
use mokly_model::data::Props;
use mokly_model::prop_schema::PropSchema;
use mokly_model::usage::ComponentInputOwner;

use crate::composition::ComposeRequest;
use crate::context::Context;
use crate::diagnostic_code::Code;
use crate::error::{Result, invalid};
use crate::fragment::RenderKind;
use crate::{relative_links, slots};

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
        let entry = request.entry;
        let (schema, props, declared_slots, kind) = match &entry.content {
            EntryContent::Screen { visual, .. } => (
                visual.prop_schema.clone(),
                visual.props.clone(),
                Vec::new(),
                RenderKind::Screen,
            ),
            EntryContent::Component { visual, slots, .. } => (
                visual.prop_schema.clone(),
                visual.props.clone(),
                slots.clone(),
                RenderKind::Component,
            ),
            EntryContent::Page => (
                PropSchema::default(),
                Props::new(),
                Vec::new(),
                RenderKind::Page,
            ),
            _ => return Err(invalid(Code::HtmlElement, "entry has no HTML render")),
        };
        let parent = entry
            .metadata
            .variant_of
            .as_deref()
            .unwrap_or(&entry.metadata.path)
            .to_owned();
        let metadata = entry
            .metadata
            .variant_of
            .as_ref()
            .and_then(|parent| {
                request
                    .catalogue
                    .model
                    .entries
                    .iter()
                    .find(|entry| &entry.metadata.path == parent)
            })
            .map_or(&entry.metadata, |entry| &entry.metadata);
        let mut context = Context {
            raw_text: false,
            link_base: relative_links::base(metadata),
            replay: false,
            props,
            schema,
            source: entry.metadata.source.clone(),
            owner: ComponentInputOwner::Entry,
            slot_key: None,
            ignore: true,
            slots: BTreeMap::new(),
            declared_slots,
        };
        slots::saved(request, &mut context)?;
        Ok(Self {
            parent,
            kind,
            context,
        })
    }
}
