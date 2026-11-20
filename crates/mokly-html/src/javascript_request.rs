//! One pure request builder for fresh fragments and store-served roots.

use std::collections::BTreeMap;

use mokly_catalogue::render_sources::RenderMethod;
use mokly_model::data::Props;
use mokly_model::material::digest;

use crate::composition::ComposeRequest;
use crate::diagnostic_code::Code;
use crate::error::{Result, invalid};
use crate::fragment::{FragmentRequest, RenderKind};

pub(crate) struct Invocation<'a> {
    pub(crate) path: &'a str,
    pub(crate) kind: RenderKind,
    pub(crate) props: &'a Props,
    pub(crate) ignore_enabled: bool,
    pub(crate) slots: Vec<&'a str>,
}

pub(crate) fn request(view: &ComposeRequest<'_>, input: Invocation<'_>) -> Result<FragmentRequest> {
    let path = input.path;
    let entry = view
        .catalogue
        .model
        .entries
        .iter()
        .find(|entry| entry.metadata.path == path)
        .ok_or_else(|| {
            invalid(
                Code::HtmlElement,
                format!("unknown JavaScript definition {path}"),
            )
        })?;
    let effective = if view
        .entry
        .metadata
        .variant_of
        .as_deref()
        .unwrap_or(&view.entry.metadata.path)
        == path
    {
        view.entry
    } else {
        entry
    };
    let recipe = view
        .catalogue
        .javascript
        .entries
        .get(&effective.metadata.path);
    Ok(FragmentRequest {
        handle: recipe.map_or_else(
            || {
                format!(
                    "{}#{}",
                    entry.metadata.source.path,
                    entry.metadata.source.export.as_deref().unwrap_or("default")
                )
            },
            |source| source.handle.clone(),
        ),
        entry_path: effective.metadata.path.clone(),
        entry_title: effective.metadata.title.clone(),
        kind: if recipe.is_some_and(|source| source.method == RenderMethod::Story) {
            RenderKind::Story
        } else {
            input.kind
        },
        props: input.props.clone(),
        viewport: view.viewport,
        color_scheme: view.color_scheme,
        ignore_enabled: input.ignore_enabled,
        slots: input
            .slots
            .into_iter()
            .map(|name| {
                (
                    name.to_owned(),
                    digest(format!("mokly-placeholder:{path}:{name}").as_bytes()),
                )
            })
            .collect(),
        saved_slots: recipe.map_or_else(BTreeMap::new, |source| source.slots.clone()),
    })
}
