//! HTML5 tree sink over the package-owned parser arena.

use std::borrow::Cow;
use std::mem;

use html5ever::tendril::StrTendril;
use html5ever::tree_builder::{ElementFlags, NodeOrText, QuirksMode, TreeSink};
use html5ever::{Attribute, ExpandedName, QualName};

use crate::html_arena::{Arena, Handle};
use crate::tree::{self, Element, Node};

impl TreeSink for Arena {
    type Handle = Handle;
    type Output = Vec<Node>;
    type ElemName<'a> = ExpandedName<'a>;

    fn finish(self) -> Self::Output {
        self.output()
    }
    fn parse_error(&self, message: Cow<'static, str>) {
        tracing::trace!(%message, "HTML5 tree repair");
    }
    fn get_document(&self) -> Handle {
        Handle::anonymous(0)
    }
    fn elem_name<'a>(&'a self, target: &'a Handle) -> ExpandedName<'a> {
        target.name.expanded()
    }

    fn create_element(&self, name: QualName, attrs: Vec<Attribute>, flags: ElementFlags) -> Handle {
        let node = Node::Element(Element {
            style_owners: None,
            origin: None,
            navigation: None,
            source: None,
            name: name.local.to_string(),
            namespace: name.ns.to_string(),
            attributes: attrs.into_iter().map(attribute).collect(),
            children: Vec::new(),
        });
        let handle = self.create(Some(node), Some(name));
        let template = flags.template.then(|| self.create(None, None));
        let mut entries = self.entries.borrow_mut();
        entries[handle.index].template = template;
        entries[handle.index].integration = flags.mathml_annotation_xml_integration_point;
        handle
    }
    fn create_comment(&self, text: StrTendril) -> Handle {
        self.create(Some(Node::Comment(text.to_string())), None)
    }
    fn create_pi(&self, _target: StrTendril, _data: StrTendril) -> Handle {
        self.create(None, None)
    }
    fn append(&self, parent: &Handle, child: NodeOrText<Handle>) {
        let child = self.child(child);
        self.insert(parent, None, child);
    }
    fn append_based_on_parent_node(
        &self,
        element: &Handle,
        previous: &Handle,
        child: NodeOrText<Handle>,
    ) {
        let parent = self.entries.borrow()[element.index].parent.clone();
        let child = self.child(child);
        match parent {
            Some(parent) => self.insert(&parent, Some(element), child),
            None => self.insert(previous, None, child),
        }
    }
    fn append_doctype_to_document(
        &self,
        name: StrTendril,
        _public: StrTendril,
        _system: StrTendril,
    ) {
        let child = self.create(Some(Node::Doctype(name.to_string())), None);
        self.insert(&Handle::anonymous(0), None, child);
    }
    fn get_template_contents(&self, target: &Handle) -> Handle {
        self.entries.borrow()[target.index]
            .template
            .clone()
            .unwrap_or_else(|| target.clone())
    }
    fn same_node(&self, first: &Handle, second: &Handle) -> bool {
        first.index == second.index
    }
    fn set_quirks_mode(&self, _mode: QuirksMode) {}
    fn append_before_sibling(&self, sibling: &Handle, child: NodeOrText<Handle>) {
        let parent = self.entries.borrow()[sibling.index].parent.clone();
        if let Some(parent) = parent {
            let child = self.child(child);
            self.insert(&parent, Some(sibling), child);
        }
    }
    fn add_attrs_if_missing(&self, target: &Handle, attrs: Vec<Attribute>) {
        if let Some(Node::Element(element)) = &mut self.entries.borrow_mut()[target.index].node {
            for value in attrs.into_iter().map(attribute) {
                if !element
                    .attributes
                    .iter()
                    .any(|known| known.name == value.name)
                {
                    element.attributes.push(value);
                }
            }
        }
    }
    fn remove_from_parent(&self, target: &Handle) {
        Self::detach(&mut self.entries.borrow_mut(), target);
    }
    fn reparent_children(&self, node: &Handle, parent: &Handle) {
        let children = mem::take(&mut self.entries.borrow_mut()[node.index].children);
        for child in children {
            self.insert(parent, None, child);
        }
    }
    fn is_mathml_annotation_xml_integration_point(&self, handle: &Handle) -> bool {
        self.entries.borrow()[handle.index].integration
    }
}

impl Arena {
    fn child(&self, child: NodeOrText<Handle>) -> Handle {
        match child {
            NodeOrText::AppendNode(node) => node,
            NodeOrText::AppendText(text) => self.create(Some(Node::Text(text.to_string())), None),
        }
    }
}

fn attribute(value: Attribute) -> tree::Attribute {
    tree::Attribute {
        name: value.name.prefix.as_ref().map_or_else(
            || value.name.local.to_string(),
            |prefix| format!("{prefix}:{}", value.name.local),
        ),
        value: value.value.to_string(),
    }
}
