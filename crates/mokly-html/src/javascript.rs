//! Graft sidecar fragments through authenticated marker and slot boundaries.

use std::cell::RefCell;
use std::collections::BTreeSet;
use std::rc::Rc;
use std::sync::Arc;

use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_catalogue::html_input::DeliveredHtml;
use mokly_catalogue::html_tokens::ignore_warning_message;
use mokly_catalogue::numeric_warnings;
use mokly_model::axes::EntryKind;
use mokly_model::catalogue::EntryContent;
use mokly_model::wire_decode;

use crate::composition::Engine;
use crate::context::Context;
use crate::diagnostic_code::Code;
use crate::error::{Result, invalid};
use crate::expansion::{After, Expansion, Mode, Placeholders};
use crate::fragment::RenderKind;
use crate::javascript_request::{self, Invocation};
use crate::tree::Node;
use crate::{
    fragment_rebase, fragment_validation, ignore_checks, markers, parse, relative_links,
    source_checks,
};

impl Engine<'_> {
    pub(crate) fn javascript_expansion(
        &mut self,
        path: &str,
        kind: RenderKind,
        context: Arc<Context>,
    ) -> Result<Expansion> {
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
        let request = javascript_request::request(
            self.request,
            Invocation {
                path,
                kind,
                props: &context.props,
                ignore_enabled: context.ignore,
                slots: context.slots.keys().map(String::as_str).collect(),
            },
        )?;
        let tokens = request.slots.clone();
        let effective_path = request.entry_path.clone();
        let mut result = self.fragments.render(&request)?;
        self.styles.extend(result.styles.clone());
        self.resources.extend(result.resources.clone());
        self.warnings.extend(result.warnings.clone());
        let page = entry.content.kind() == EntryKind::Page;
        let html = if page {
            DeliveredHtml::document(&result.html)
        } else {
            DeliveredHtml::fragment(&result.html)
        };
        let mut nodes = parse::html(html);
        let removed = ignore_checks::filter_tree(&mut nodes);
        if page {
            let mut seen = BTreeSet::new();
            for (attribute, element) in removed {
                if seen.insert(attribute.clone()) {
                    self.warnings.push(Warning {
                        code: "html-ignore-attribute",
                        subject: WarningSubject::Entry(entry.metadata.path.clone()),
                        message: ignore_warning_message(&attribute, element.as_bytes()),
                    });
                }
            }
            source_checks::page(html)?;
        }
        source_checks::validate(html, true)?;
        let own_component = matches!(self.request.entry.content, EntryContent::Component { .. })
            && effective_path == self.request.entry.metadata.path;
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
            &context,
        );
        for instance in result.instances {
            if let Ok(props) = wire_decode::decode(&instance.props) {
                self.warnings.extend(numeric_warnings::for_invocation(
                    &props,
                    self.request.entry,
                    &instance.component_id,
                    &instance.id,
                ));
            }
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
        let placeholders = Rc::new(RefCell::new(Placeholders {
            tokens,
            seen: BTreeSet::new(),
        }));
        let mut expansion = Expansion::native(nodes, context);
        expansion.mode = Mode::Foreign(placeholders.clone());
        expansion.after.push(After::JavaScript {
            placeholders,
            component: matches!(entry.content, EntryContent::Component { .. })
                .then(|| path.to_owned()),
            page,
        });
        Ok(expansion)
    }

    pub(crate) fn javascript(
        &mut self,
        path: &str,
        kind: RenderKind,
        context: &Context,
    ) -> Result<Vec<Node>> {
        let expansion = self.javascript_expansion(path, kind, Arc::new(context.clone()))?;
        self.expand(expansion)
    }
}
