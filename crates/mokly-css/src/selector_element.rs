//! Read-only element adapter for Servo matching over a composed-document arena.

use selectors::attr::{AttrSelectorOperation, CaseSensitivity, NamespaceConstraint};
use selectors::bloom::BloomFilter;
use selectors::matching::{ElementSelectorFlags, MatchingContext};
use selectors::{Element, OpaqueElement};

use crate::match_tree::{MatchElement, MatchTree};
use crate::selector_impl::{Atom, Implementation, Unsupported};

#[derive(Clone, Debug)]
pub(crate) struct Cursor<'a> {
    pub(crate) tree: &'a MatchTree,
    pub(crate) index: usize,
}

impl Cursor<'_> {
    fn node(&self) -> &MatchElement {
        &self.tree.elements[self.index]
    }
    fn at(&self, index: usize) -> Self {
        Self {
            tree: self.tree,
            index,
        }
    }
    fn sibling(&self, direction: isize) -> Option<Self> {
        let parent = self.node().parent?;
        let siblings = &self.tree.elements[parent].children;
        let position = siblings.iter().position(|index| *index == self.index)?;
        let position = position.checked_add_signed(direction)?;
        siblings.get(position).map(|index| self.at(*index))
    }
}

impl Element for Cursor<'_> {
    type Impl = Implementation;
    fn opaque(&self) -> OpaqueElement {
        OpaqueElement::new(self.node())
    }
    fn parent_element(&self) -> Option<Self> {
        self.node().parent.map(|index| self.at(index))
    }
    fn parent_node_is_shadow_root(&self) -> bool {
        false
    }
    fn containing_shadow_host(&self) -> Option<Self> {
        None
    }
    fn is_pseudo_element(&self) -> bool {
        false
    }
    fn prev_sibling_element(&self) -> Option<Self> {
        self.sibling(-1)
    }
    fn next_sibling_element(&self) -> Option<Self> {
        self.sibling(1)
    }
    fn first_element_child(&self) -> Option<Self> {
        self.node().children.first().map(|index| self.at(*index))
    }
    fn is_html_element_in_html_document(&self) -> bool {
        self.node().namespace == "http://www.w3.org/1999/xhtml"
    }
    fn has_local_name(&self, name: &str) -> bool {
        self.node().name == name
    }
    fn has_namespace(&self, namespace: &str) -> bool {
        self.node().namespace == namespace
    }
    fn is_same_type(&self, other: &Self) -> bool {
        self.node().name == other.node().name && self.node().namespace == other.node().namespace
    }
    fn attr_matches(
        &self,
        namespace: &NamespaceConstraint<&Atom>,
        name: &Atom,
        operation: &AttrSelectorOperation<&Atom>,
    ) -> bool {
        if matches!(namespace, NamespaceConstraint::Specific(value) if !value.0.is_empty()) {
            return false;
        }
        self.node()
            .attributes
            .get(&name.0)
            .is_some_and(|value| operation.eval_str(value))
    }
    fn match_non_ts_pseudo_class(
        &self,
        value: &Unsupported,
        _: &mut MatchingContext<Implementation>,
    ) -> bool {
        match *value {}
    }
    fn match_pseudo_element(
        &self,
        value: &Unsupported,
        _: &mut MatchingContext<Implementation>,
    ) -> bool {
        match *value {}
    }
    fn apply_selector_flags(&self, _: ElementSelectorFlags) {}
    fn is_link(&self) -> bool {
        matches!(self.node().name.as_str(), "a" | "area" | "link")
            && self.node().attributes.contains_key("href")
    }
    fn is_html_slot_element(&self) -> bool {
        self.node().name == "slot" && self.is_html_element_in_html_document()
    }
    fn has_id(&self, id: &Atom, sensitivity: CaseSensitivity) -> bool {
        self.node()
            .attributes
            .get("id")
            .is_some_and(|value| sensitivity.eq(value.as_bytes(), id.0.as_bytes()))
    }
    fn has_class(&self, class: &Atom, sensitivity: CaseSensitivity) -> bool {
        self.node().attributes.get("class").is_some_and(|value| {
            value
                .split_ascii_whitespace()
                .any(|value| sensitivity.eq(value.as_bytes(), class.0.as_bytes()))
        })
    }
    fn has_custom_state(&self, _: &Atom) -> bool {
        false
    }
    fn imported_part(&self, _: &Atom) -> Option<Atom> {
        None
    }
    fn is_part(&self, _: &Atom) -> bool {
        false
    }
    fn is_empty(&self) -> bool {
        self.node().children.is_empty() && !self.node().text
    }
    fn is_root(&self) -> bool {
        self.node().parent.is_none() && self.node().name == "html"
    }
    fn add_element_unique_hashes(&self, _: &mut BloomFilter) -> bool {
        false
    }
}
