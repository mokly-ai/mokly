//! Selector parser types for the Servo selectors matcher.

use std::borrow::Borrow;
use std::fmt;
use std::hash::{Hash, Hasher};

use cssparser_next::ToCss;
use precomputed_hash::PrecomputedHash;
use selectors::parser::{NonTSPseudoClass, PseudoElement, SelectorImpl};

#[derive(Clone, Debug, Default, Eq, Hash, PartialEq)]
pub(crate) struct Atom(pub(crate) String);

impl From<&str> for Atom {
    fn from(value: &str) -> Self {
        Self(value.into())
    }
}
impl Borrow<str> for Atom {
    fn borrow(&self) -> &str {
        &self.0
    }
}
impl AsRef<str> for Atom {
    fn as_ref(&self) -> &str {
        &self.0
    }
}
impl ToCss for Atom {
    fn to_css<W: fmt::Write>(&self, output: &mut W) -> fmt::Result {
        cssparser_next::serialize_identifier(&self.0, output)
    }
}
impl PrecomputedHash for Atom {
    fn precomputed_hash(&self) -> u32 {
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        self.hash(&mut hasher);
        hasher.finish() as u32
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) enum Unsupported {}

impl ToCss for Unsupported {
    fn to_css<W: fmt::Write>(&self, _: &mut W) -> fmt::Result {
        match *self {}
    }
}
impl NonTSPseudoClass for Unsupported {
    fn is_active_or_hover(&self) -> bool {
        match *self {}
    }
    fn is_user_action_state(&self) -> bool {
        match *self {}
    }
}
impl PseudoElement for Unsupported {}

#[derive(Clone, Debug)]
pub(crate) struct Implementation;

impl SelectorImpl for Implementation {
    type ExtraMatchingData<'a> = ();
    type AttrValue = Atom;
    type Identifier = Atom;
    type LocalName = Atom;
    type NamespaceUrl = Atom;
    type NamespacePrefix = Atom;
    type BorrowedNamespaceUrl = str;
    type BorrowedLocalName = str;
    type NonTSPseudoClass = Unsupported;
    type PseudoElement = Unsupported;
}

pub(crate) struct SelectorParser;
impl<'i> selectors::parser::Parser<'i> for SelectorParser {
    type Impl = Implementation;
    type Error = selectors::parser::SelectorParseErrorKind;
    fn parse_is_and_where(&self) -> bool {
        true
    }
    fn parse_has(&self) -> bool {
        true
    }
    fn parse_nth_child_of(&self) -> bool {
        true
    }
    fn allow_forgiving_selectors(&self) -> bool {
        false
    }
}
