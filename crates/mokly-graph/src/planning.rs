//! Compute document input hashes before any document is rendered.

use std::collections::{BTreeMap, BTreeSet};

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_html::{parse, tree};
use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::catalogue::EntryContent;
use mokly_model::routes;
use mokly_source_interface::tree::SourceTree;

use crate::delivery_inputs::DeliveryInputs;
use crate::error::{Result, invalid};
use crate::key::{NodeKey, NodeKind, key};
use crate::types::{DocumentPlan, ResourcePlan};
use crate::{error, resource_keys, routing_inputs, styles};

pub(crate) fn documents(
    config: &ResolvedConfig,
    catalogue: &PreparedCatalogue,
    tree: &dyn SourceTree,
    config_key: &NodeKey,
    resources: &BTreeMap<String, ResourcePlan>,
    delivery: &DeliveryInputs,
    matchers: &styles::Matchers,
) -> Result<BTreeMap<String, DocumentPlan>> {
    let mut sources = BTreeMap::new();
    for entry in &catalogue.model.entries {
        let path = &entry.metadata.source.path;
        if sources.contains_key(path) {
            continue;
        }
        let bytes = match tree.read_shared(&config.repo_root.join(path)) {
            Ok(bytes) => bytes,
            Err(_) => return Err(invalid(path, format!("could not read entry source {path}"))),
        };
        sources.insert(path.clone(), key(NodeKind::EntrySource, &[&bytes]));
    }
    let mut component_keys = BTreeMap::new();
    for component in catalogue.elements.values() {
        component_key(
            &component.path,
            catalogue,
            &sources,
            &mut component_keys,
            &mut BTreeSet::new(),
        )?;
    }
    let mut output = BTreeMap::new();
    for (index, entry) in catalogue.model.entries.iter().enumerate() {
        if !matches!(entry.content, EntryContent::UseCase { .. })
            && entry.metadata.path.split('/').next().is_some_and(|first| {
                first.eq_ignore_ascii_case("styles") || first.eq_ignore_ascii_case("assets")
            })
        {
            return Err(invalid(
                &entry.metadata.path,
                "styles and assets are reserved document namespaces",
            ));
        }
        let views: Vec<_> = match &entry.content {
            EntryContent::Screen { visual, .. } | EntryContent::Component { visual, .. } => {
                [Viewport::Mobile, Viewport::Desktop]
                    .into_iter()
                    .flat_map(|viewport| {
                        visual
                            .color_schemes
                            .iter()
                            .map(move |scheme| (Some(viewport), *scheme))
                    })
                    .collect()
            }
            EntryContent::Document { color_schemes, .. } => {
                color_schemes.iter().map(|scheme| (None, *scheme)).collect()
            }
            EntryContent::Page => vec![(None, ColorScheme::Light)],
            EntryContent::UseCase { .. } => Vec::new(),
        };
        let parent = entry
            .metadata
            .variant_of
            .as_ref()
            .unwrap_or(&entry.metadata.path);
        let mut components = components(&entry.metadata.path, catalogue);
        if matches!(entry.content, EntryContent::Component { .. }) {
            components.insert(parent.clone());
        }
        let routing = routing_inputs::key(entry, &components, catalogue)?;
        for (viewport, scheme) in views {
            let route = viewport.map_or_else(
                || routes::document(&entry.metadata.path, scheme),
                |viewport| routes::view(&entry.metadata.path, viewport, scheme),
            );
            let links = if viewport.is_some() {
                styles::links(&styles::LinkInput {
                    matchers,
                    config,
                    path: &entry.metadata.path,
                    route: &route,
                    scheme,
                    components: &components.iter().cloned().collect::<Vec<_>>(),
                    inputs: delivery,
                    resources,
                    module: delivery
                        .entry_modules
                        .get(parent)
                        .map_or(entry.metadata.source.path.as_str(), String::as_str),
                })?
            } else {
                Vec::new()
            };
            let mut inputs = vec![
                config_key.0.clone(),
                routing.0.clone(),
                sources[&entry.metadata.source.path].0.clone(),
                entry.metadata.path.clone(),
                format!("{viewport:?}/{scheme:?}"),
            ];
            if (!catalogue.templates.contains_key(parent)
                || components
                    .iter()
                    .any(|component| !catalogue.templates.contains_key(component)))
                && let Some(generation) = &delivery.fragment_generation
            {
                inputs.push(generation.clone());
            }
            inputs.extend(
                components
                    .iter()
                    .filter_map(|path| component_keys.get(path).map(|key| key.0.clone())),
            );
            for (path, digest) in
                resource_keys::inputs(config, catalogue, entry, &route, &components, tree)
            {
                inputs.push(format!("{path}:{digest}"));
            }
            for link in &links {
                if let Some(path) = routes::resolve(&route, link)
                    && let Some(resource) = resources.get(&path)
                {
                    inputs.push(resource.key.0.clone());
                }
            }
            let encoded = match serde_json::to_vec(entry) {
                Ok(bytes) => bytes,
                Err(source) => return Err(error::InternalError::Json { source }.into()),
            };
            let mut borrowed: Vec<_> = inputs.iter().map(|input| input.as_bytes()).collect();
            borrowed.push(&encoded);
            let document_key = key(NodeKind::Document, &borrowed);
            output.insert(
                route.clone(),
                DocumentPlan {
                    route,
                    key: document_key,
                    entry: index,
                    viewport,
                    color_scheme: scheme,
                    stylesheets: links,
                },
            );
        }
    }
    Ok(output)
}

fn components(path: &str, catalogue: &PreparedCatalogue) -> BTreeSet<String> {
    let mut found = BTreeSet::new();
    let mut stack = vec![path.to_owned()];
    while let Some(path) = stack.pop() {
        let parent = catalogue
            .model
            .entries
            .iter()
            .find(|entry| entry.metadata.path == path)
            .and_then(|entry| entry.metadata.variant_of.as_ref())
            .unwrap_or(&path);
        let bodies = catalogue
            .templates
            .get(parent)
            .map(|template| template.body.as_str())
            .into_iter()
            .chain(
                catalogue
                    .slot_fragments
                    .get(&path)
                    .into_iter()
                    .flat_map(|slots| slots.values().map(String::as_str)),
            );
        for body in bodies {
            for component in direct_components(body, catalogue) {
                if found.insert(component.clone()) {
                    stack.push(component);
                }
            }
        }
    }
    found
}

fn component_key(
    path: &str,
    catalogue: &PreparedCatalogue,
    sources: &BTreeMap<String, NodeKey>,
    keys: &mut BTreeMap<String, NodeKey>,
    visiting: &mut BTreeSet<String>,
) -> Result<NodeKey> {
    if let Some(key) = keys.get(path) {
        return Ok(key.clone());
    }
    if !visiting.insert(path.into()) {
        return Err(invalid(path, "component dependency cycle"));
    }
    let source = catalogue
        .model
        .entries
        .iter()
        .find(|entry| entry.metadata.path == path)
        .and_then(|entry| sources.get(&entry.metadata.source.path))
        .ok_or_else(|| invalid(path, "component source key is missing"))?;
    let mut inputs = vec![source.0.clone()];
    for child in catalogue
        .templates
        .get(path)
        .map(|template| direct_components(&template.body, catalogue))
        .unwrap_or_default()
    {
        if child != path {
            inputs.push(component_key(&child, catalogue, sources, keys, visiting)?.0);
        }
    }
    let result = key(
        NodeKind::HtmlComponent,
        &inputs
            .iter()
            .map(|input| input.as_bytes())
            .collect::<Vec<_>>(),
    );
    keys.insert(path.into(), result.clone());
    visiting.remove(path);
    Ok(result)
}

fn direct_components(body: &str, catalogue: &PreparedCatalogue) -> BTreeSet<String> {
    let mut found = BTreeSet::new();
    let mut nodes = parse::fragment(body);
    while let Some(node) = nodes.pop() {
        if let tree::Node::Element(element) = node {
            if let Some(component) = catalogue.elements.get(&element.name) {
                found.insert(component.path.clone());
            }
            nodes.extend(element.children);
        }
    }
    found
}
