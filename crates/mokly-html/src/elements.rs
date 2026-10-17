//! Render one element and attach invocation coordinates to every failure.

use std::mem;
use std::sync::Arc;

use mokly_model::axes::Viewport;

use crate::composition::Engine;
use crate::context::Context;
use crate::diagnostic_code::Code;
use crate::error::{Result, invalid};
use crate::expansion::{After, Expansion};
use crate::tree::{Element, Node};
use crate::{conditions, ignore_checks, relative_links, serialize};

impl Engine<'_> {
    pub(crate) fn element(
        &mut self,
        mut element: Element,
        context: Arc<Context>,
    ) -> Result<Expansion> {
        ignore_checks::attributes(&element)?;
        let viewport = match self.request.viewport {
            Viewport::Mobile => "mobile",
            Viewport::Desktop => "desktop",
        };
        if !conditions::visible(&mut element, &context, viewport)? {
            return Ok(Expansion::ready(Vec::new(), context));
        }
        if element.name == "mokly-ignore-scope" {
            let enabled = match element.get("enabled") {
                Some("true") => true,
                Some("false") => false,
                _ => {
                    return Err(invalid(
                        Code::HtmlElement,
                        "mokly-ignore-scope enabled must be true or false",
                    ));
                }
            };
            let mut nested = context.as_ref().clone();
            nested.ignore = enabled;
            return Ok(Expansion::native(element.children, Arc::new(nested)));
        }
        if element.name == "mokly-ignore" {
            conditions::attributes(&mut element, &context)?;
            return self.ignore(element, context);
        }
        if element.name == "slot" {
            return self.slot(element, context);
        }
        if let Some(component) = self.request.catalogue.elements.get(&element.name).cloned() {
            return self.component(element, &component, &context);
        }
        conditions::attributes(&mut element, &context)?;
        relative_links::element(&mut element, &context.link_base)?;
        let context = if element.is_html() && serialize::raw_text(&element.name) {
            let mut nested = context.as_ref().clone();
            nested.raw_text = true;
            Arc::new(nested)
        } else {
            context
        };
        let mut expansion = Expansion::native(mem::take(&mut element.children), context);
        expansion.after.push(After::Node(Node::Element(element)));
        Ok(expansion)
    }
}
