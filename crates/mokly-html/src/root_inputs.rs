//! Canonical root inputs require no fragment evaluation or HTML slot expansion.

use std::borrow::Cow;
use std::collections::BTreeMap;

use mokly_model::catalogue::{EntryContent, ModelEntry};
use mokly_model::data::Props;
use mokly_model::prop_schema::PropSchema;
use mokly_model::usage::ComponentInputOwner;

use crate::composition::ComposeRequest;
use crate::context::Context;
use crate::diagnostic_code::Code;
use crate::error::{Result, invalid};
use crate::fragment::{FragmentRequest, RenderKind};
use crate::javascript_request::{self, Invocation};
use crate::relative_links;

struct Inputs<'a> {
    schema: Cow<'a, PropSchema>,
    props: Cow<'a, Props>,
    slots: &'a [String],
    ignore_enabled: bool,
}

fn inputs(entry: &ModelEntry) -> Result<Inputs<'_>> {
    let (schema, props, slots) = match &entry.content {
        EntryContent::Screen { visual, .. } => (
            Cow::Borrowed(&visual.prop_schema),
            Cow::Borrowed(&visual.props),
            &[][..],
        ),
        EntryContent::Component { visual, slots, .. } => (
            Cow::Borrowed(&visual.prop_schema),
            Cow::Borrowed(&visual.props),
            slots.as_slice(),
        ),
        EntryContent::Page => (
            Cow::Owned(PropSchema::default()),
            Cow::Owned(Props::new()),
            &[][..],
        ),
        _ => return Err(invalid(Code::HtmlElement, "entry has no HTML render")),
    };
    Ok(Inputs {
        schema,
        props,
        slots,
        ignore_enabled: true,
    })
}

pub(crate) fn parent(entry: &ModelEntry) -> &str {
    entry
        .metadata
        .variant_of
        .as_deref()
        .unwrap_or(&entry.metadata.path)
}

pub(crate) fn kind(entry: &ModelEntry) -> RenderKind {
    match entry.content {
        EntryContent::Page => RenderKind::Page,
        EntryContent::Component { .. } => RenderKind::Component,
        _ => RenderKind::Screen,
    }
}

pub(crate) fn context(request: &ComposeRequest<'_>) -> Result<Context> {
    let entry = request.entry;
    let inputs = inputs(entry)?;
    let body_metadata = entry
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
    Ok(Context {
        raw_text: false,
        link_base: relative_links::base(body_metadata),
        replay: false,
        props: inputs.props.into_owned(),
        schema: inputs.schema.into_owned(),
        source: entry.metadata.source.clone(),
        owner: ComponentInputOwner::Entry,
        slot_key: None,
        ignore: inputs.ignore_enabled,
        slots: BTreeMap::new(),
        declared_slots: inputs.slots.to_vec(),
    })
}

pub(crate) fn stored_request(view: &ComposeRequest<'_>) -> Result<Option<FragmentRequest>> {
    let path = parent(view.entry);
    if view.catalogue.templates.contains_key(path) {
        return Ok(None);
    }
    let inputs = inputs(view.entry)?;
    let slots = view
        .catalogue
        .slot_fragments
        .get(&view.entry.metadata.path)
        .into_iter()
        .flat_map(|slots| slots.keys().map(String::as_str))
        .collect();
    javascript_request::request(
        view,
        Invocation {
            path,
            kind: kind(view.entry),
            props: &inputs.props,
            ignore_enabled: inputs.ignore_enabled,
            slots,
        },
    )
    .map(Some)
}
