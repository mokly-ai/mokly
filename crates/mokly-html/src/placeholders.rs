//! Expand authenticated JavaScript slot placeholders through the same work stack.

use std::cell::RefCell;
use std::rc::Rc;
use std::sync::Arc;

use crate::composition::Engine;
use crate::context::Context;
use crate::diagnostic_code::Code;
use crate::error::{Result, invalid};
use crate::expansion::{After, Expansion, Mode, Placeholders};
use crate::tree::Node;

impl Engine<'_> {
    pub(crate) fn foreign_node(
        &mut self,
        mut node: Node,
        context: Arc<Context>,
        placeholders: Rc<RefCell<Placeholders>>,
    ) -> Result<Expansion> {
        if let Node::Element(element) = &node
            && element.name == "mokly-slot"
        {
            let name = element
                .get("name")
                .ok_or_else(|| invalid(Code::HtmlSlot, "slot placeholder has no name"))?
                .to_owned();
            if element.get("token") != placeholders.borrow().tokens.get(&name).map(String::as_str)
                || !element.children.is_empty()
            {
                return Err(invalid(
                    Code::HtmlSlot,
                    "unknown or forged slot placeholder",
                ));
            }
            let mut nested = context.as_ref().clone();
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
            let mut element = element.clone();
            element.name = "slot".into();
            let expansion = self.slot(element, Arc::new(nested))?;
            placeholders.borrow_mut().seen.insert(name);
            return Ok(expansion);
        }
        if node.children_mut().is_some() {
            let children = node.take_children();
            let mut expansion = Expansion::native(children, context);
            expansion.mode = Mode::Foreign(placeholders);
            expansion.after.push(After::Node(node));
            return Ok(expansion);
        }
        Ok(Expansion::ready(vec![node], context))
    }
}
