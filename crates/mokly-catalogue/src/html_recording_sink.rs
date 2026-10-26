//! A tree sink that records tokens for the catalogue checks and builds no tree.

use std::borrow::Cow;
use std::cell::{Cell, RefCell};

use html5ever::tendril::StrTendril;
use html5ever::tree_builder::{ElementFlags, NodeOrText, QuirksMode, TreeSink};
use html5ever::{Attribute, ExpandedName, QualName, local_name, ns};

use crate::html_driver::DriverSink;
use crate::html_token_types::Token;
use crate::html_tokens::{ParsedToken, normalize};

/// One element or node that the tree builder created, with the facts it asks for later.
#[derive(Clone)]
pub(crate) struct RecordedHandle {
    index: usize,
    name: QualName,
    integration: bool,
}

/// Records each token in source order. The tree builder keeps its own open-element state, so
/// tree edits need no storage here.
pub(crate) struct RecordingSink {
    authored: bool,
    next: Cell<usize>,
    tokens: RefCell<Vec<ParsedToken>>,
}

impl RecordingSink {
    pub(crate) fn new(authored: bool) -> Self {
        Self {
            authored,
            next: Cell::new(1),
            tokens: RefCell::default(),
        }
    }

    fn handle(&self, name: QualName, integration: bool) -> RecordedHandle {
        let index = self.next.get();
        self.next.set(index + 1);
        RecordedHandle {
            index,
            name,
            integration,
        }
    }
}

impl DriverSink for RecordingSink {
    fn before_token(&self, token: &Token) {
        self.tokens
            .borrow_mut()
            .push(normalize(token.clone(), self.authored));
    }

    fn after_token(&self) {}
}

impl TreeSink for RecordingSink {
    type Handle = RecordedHandle;
    type Output = Vec<ParsedToken>;
    type ElemName<'a> = ExpandedName<'a>;

    fn finish(self) -> Self::Output {
        self.tokens.into_inner()
    }

    fn parse_error(&self, _message: Cow<'static, str>) {}

    fn get_document(&self) -> RecordedHandle {
        RecordedHandle {
            index: 0,
            name: QualName::new(None, ns!(html), local_name!("")),
            integration: false,
        }
    }

    fn elem_name<'a>(&'a self, target: &'a RecordedHandle) -> ExpandedName<'a> {
        target.name.expanded()
    }

    fn create_element(
        &self,
        name: QualName,
        _attrs: Vec<Attribute>,
        flags: ElementFlags,
    ) -> RecordedHandle {
        self.handle(name, flags.mathml_annotation_xml_integration_point)
    }

    fn create_comment(&self, _text: StrTendril) -> RecordedHandle {
        self.handle(self.get_document().name, false)
    }

    fn create_pi(&self, _target: StrTendril, _data: StrTendril) -> RecordedHandle {
        self.handle(self.get_document().name, false)
    }

    fn append(&self, _parent: &RecordedHandle, _child: NodeOrText<RecordedHandle>) {}

    fn append_based_on_parent_node(
        &self,
        _element: &RecordedHandle,
        _previous: &RecordedHandle,
        _child: NodeOrText<RecordedHandle>,
    ) {
    }

    fn append_doctype_to_document(
        &self,
        _name: StrTendril,
        _public: StrTendril,
        _system: StrTendril,
    ) {
    }

    fn get_template_contents(&self, target: &RecordedHandle) -> RecordedHandle {
        target.clone()
    }

    fn same_node(&self, first: &RecordedHandle, second: &RecordedHandle) -> bool {
        first.index == second.index
    }

    fn set_quirks_mode(&self, _mode: QuirksMode) {}

    fn append_before_sibling(&self, _sibling: &RecordedHandle, _child: NodeOrText<RecordedHandle>) {
    }

    fn add_attrs_if_missing(&self, _target: &RecordedHandle, _attrs: Vec<Attribute>) {}

    fn remove_from_parent(&self, _target: &RecordedHandle) {}

    fn reparent_children(&self, _node: &RecordedHandle, _parent: &RecordedHandle) {}

    fn is_mathml_annotation_xml_integration_point(&self, handle: &RecordedHandle) -> bool {
        handle.integration
    }
}
