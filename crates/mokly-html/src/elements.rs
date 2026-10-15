//! Render one element and attach invocation coordinates to every failure.

use mokly_model::axes::Viewport;

use crate::composition::Engine;
use crate::context::Context;
use crate::diagnostic_code::Code;
use crate::error::{Result, invalid};
use crate::tree::{Element, Node};
use crate::{conditions, ignore_checks, relative_links};

impl Engine<'_> {
    pub(crate) fn element(&mut self, mut element: Element, context: &Context) -> Result<Vec<Node>> {
        ignore_checks::attributes(&element)?;
        let mut result = Vec::new();
        let viewport = match self.request.viewport {
            Viewport::Mobile => "mobile",
            Viewport::Desktop => "desktop",
        };
        if !conditions::visible(&mut element, context, viewport)? {
            return Ok(Vec::new());
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
            let mut nested = context.clone();
            nested.ignore = enabled;
            result.extend(self.nodes(element.children, &nested)?);
        } else if element.name == "mokly-ignore" {
            conditions::attributes(&mut element, context)?;
            result.extend(self.ignore(element, context)?);
        } else if element.name == "slot" {
            result.extend(self.slot(element, context)?);
        } else if let Some(component) = self.request.catalogue.elements.get(&element.name).cloned()
        {
            result.extend(self.component(element, &component, context)?);
        } else {
            conditions::attributes(&mut element, context)?;
            relative_links::element(&mut element, &context.link_base)?;
            element.children = if element.is_html()
                && matches!(
                    element.name.as_str(),
                    "style" | "script" | "xmp" | "iframe" | "noembed" | "noframes" | "plaintext"
                ) {
                let mut nested = context.clone();
                nested.raw_text = true;
                self.nodes(element.children, &nested)?
            } else {
                self.nodes(element.children, context)?
            };
            result.push(Node::Element(element));
        }
        Ok(result)
    }
}
