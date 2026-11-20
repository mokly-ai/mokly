//! One request builder for direct and prepared JavaScript roots.

use std::collections::BTreeMap;

use mokly_catalogue::render_sources::RenderMethod;
use mokly_model::material::digest;

use crate::composition::ComposeRequest;
use crate::context::Context;
use crate::diagnostic_code::Code;
use crate::error::{Result, invalid};
use crate::fragment::{FragmentRequest, RenderKind};

pub(crate) fn build(
    request: &ComposeRequest<'_>,
    path: &str,
    kind: RenderKind,
    context: &Context,
) -> Result<FragmentRequest> {
    let entry = request
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
    let effective = if request
        .entry
        .metadata
        .variant_of
        .as_deref()
        .unwrap_or(&request.entry.metadata.path)
        == path
    {
        request.entry
    } else {
        entry
    };
    let recipe = request
        .catalogue
        .javascript
        .entries
        .get(&effective.metadata.path);
    let kind = if recipe.is_some_and(|source| source.method == RenderMethod::Story) {
        RenderKind::Story
    } else {
        kind
    };
    let handle = recipe.map_or_else(
        || {
            format!(
                "{}#{}",
                entry.metadata.source.path,
                entry.metadata.source.export.as_deref().unwrap_or("default")
            )
        },
        |source| source.handle.clone(),
    );
    let tokens: BTreeMap<_, _> = context
        .slots
        .keys()
        .map(|name| {
            (
                name.clone(),
                digest(format!("mokly-placeholder:{path}:{name}").as_bytes()),
            )
        })
        .collect();
    Ok(FragmentRequest {
        handle,
        entry_path: effective.metadata.path.clone(),
        entry_title: effective.metadata.title.clone(),
        kind,
        props: context.props.clone(),
        viewport: request.viewport,
        color_scheme: request.color_scheme,
        ignore_enabled: context.ignore,
        slots: tokens.clone(),
        saved_slots: recipe.map_or_else(BTreeMap::new, |source| source.slots.clone()),
    })
}
