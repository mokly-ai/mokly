//! Graft sidecar fragments through authenticated marker and slot boundaries.

use std::collections::{BTreeMap, BTreeSet};
use std::mem;

use mokly_catalogue::render_sources::RenderMethod;
use mokly_model::axes::EntryKind;
use mokly_model::catalogue::EntryContent;
use mokly_model::material::digest;

use crate::composition::Engine;
use crate::context::Context;
use crate::diagnostic_code::Code;
use crate::error::{Result, invalid};
use crate::fragment::{FragmentRequest, RenderKind};
use crate::tree::Node;
use crate::{fragment_rebase, fragment_validation, markers, parse, relative_links, source_checks};

impl Engine<'_> {
    pub(crate) fn javascript(
        &mut self,
        path: &str,
        kind: RenderKind,
        context: &Context,
    ) -> Result<Vec<Node>> {
        let entry = self
            .request
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
        let effective = if self
            .request
            .entry
            .metadata
            .variant_of
            .as_deref()
            .unwrap_or(&self.request.entry.metadata.path)
            == path
        {
            self.request.entry
        } else {
            entry
        };
        let recipe = self
            .request
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
        let mut result = self.fragments.render(&FragmentRequest {
            handle,
            entry_path: effective.metadata.path.clone(),
            entry_title: effective.metadata.title.clone(),
            kind,
            props: context.props.clone(),
            viewport: self.request.viewport,
            color_scheme: self.request.color_scheme,
            ignore_enabled: context.ignore,
            slots: tokens.clone(),
            saved_slots: recipe.map_or_else(BTreeMap::new, |source| source.slots.clone()),
        })?;
        self.styles.extend(result.styles.clone());
        self.resources.extend(result.resources.clone());
        self.warnings.extend(result.warnings.clone());
        let page = entry.content.kind() == EntryKind::Page;
        if page {
            source_checks::page(&result.html)?;
        }
        source_checks::validate(&result.html, true)?;
        let nodes = if page {
            parse::document(&result.html)
        } else {
            parse::fragment(&result.html)
        };
        let own_component = matches!(self.request.entry.content, EntryContent::Component { .. })
            && effective.metadata.path == self.request.entry.metadata.path;
        let mut nodes = markers::attach(
            nodes,
            &result,
            self.request.catalogue,
            &mut self.ignore_ids,
            own_component.then_some(path),
        )?;
        relative_links::fragment(
            &mut nodes,
            &context.link_base,
            &result,
            &self.request.catalogue.model.entries,
        )?;
        fragment_validation::component_order(&nodes, &mut self.components);
        fragment_rebase::rebase(
            &mut nodes,
            &mut result.instances,
            &mut result.slots,
            context,
        )?;
        for instance in result.instances {
            if let Some(existing) = self.instances.get(&instance.key) {
                if !context.replay
                    || existing.props_key != instance.props_key
                    || existing.component_id != instance.component_id
                    || existing.order != instance.order
                {
                    return Err(invalid(
                        Code::BuildInvalid,
                        "duplicate fragment instance input",
                    ));
                }
            } else {
                self.instances.insert(instance.key.clone(), instance);
            }
        }
        for slot in result.slots {
            self.slots.entry(slot.key.clone()).or_insert(slot);
        }
        let mut seen = BTreeSet::new();
        let nodes = self.placeholders(nodes, context, &tokens, &mut seen)?;
        if tokens.keys().any(|name| !seen.contains(name)) {
            return Err(invalid(
                Code::HtmlSlot,
                "a supplied JavaScript slot placeholder was not rendered",
            ));
        }
        if matches!(entry.content, EntryContent::Component { .. })
            && !self.components.contains(&path.to_owned())
        {
            self.components.push(path.into());
        }
        if page {
            self.nodes(nodes, context)
        } else {
            Ok(nodes)
        }
    }

    fn placeholders(
        &mut self,
        nodes: Vec<Node>,
        context: &Context,
        tokens: &BTreeMap<String, String>,
        seen: &mut BTreeSet<String>,
    ) -> Result<Vec<Node>> {
        let mut output = Vec::new();
        for mut node in nodes {
            match &mut node {
                Node::Element(element) if element.name == "mokly-slot" => {
                    let name = element
                        .get("name")
                        .ok_or_else(|| invalid(Code::HtmlSlot, "slot placeholder has no name"))?
                        .to_owned();
                    if element.get("token") != tokens.get(&name).map(String::as_str)
                        || !element.children.is_empty()
                    {
                        return Err(invalid(
                            Code::HtmlSlot,
                            "unknown or forged slot placeholder",
                        ));
                    }
                    let mut nested = context.clone();
                    nested.ignore = match element.get("ignore-scope") {
                        Some("enabled") => true,
                        Some("disabled") => false,
                        _ => {
                            return Err(invalid(
                                Code::HtmlSlot,
                                "slot placeholder has an invalid ignore scope",
                            ));
                        }
                    };
                    let mut placeholder = element.clone();
                    placeholder.name = "slot".into();
                    output.extend(self.slot(placeholder, &nested)?);
                    seen.insert(name);
                    continue;
                }
                Node::Element(element) => {
                    element.children =
                        self.placeholders(mem::take(&mut element.children), context, tokens, seen)?
                }
                Node::Region { children, .. } => {
                    *children = self.placeholders(mem::take(children), context, tokens, seen)?
                }
                _ => {}
            }
            output.push(node);
        }
        Ok(output)
    }
}
