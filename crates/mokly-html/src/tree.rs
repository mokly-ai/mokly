//! Owned, thread-safe HTML5 trees with explicit composition regions.

use mokly_model::catalogue::SourceLocation;
use mokly_model::usage::ComponentInputOwner;

use crate::links::Reference;

/// One parsed attribute, in authored order.
#[derive(Clone, Debug, PartialEq)]
pub struct Attribute {
    /// Qualified attribute name, including a namespace prefix when present.
    pub name: String,
    /// Decoded attribute value.
    pub value: String,
}

/// An element after the HTML5 tree builder has placed it.
#[derive(Clone, Debug)]
pub struct Element {
    /// Private invocation-site token for repeated placements; excluded from identity keys.
    pub origin: Option<String>,
    /// Package-written logical destination, absent on consumer-authored metadata.
    pub navigation: Option<Reference>,
    /// Authored invocation coordinate, absent on implied or package-owned elements.
    pub source: Option<SourceLocation>,
    /// Local tag name; HTML names are lowercase.
    pub name: String,
    /// Namespace URI, preserved for SVG and MathML.
    pub namespace: String,
    /// Ordered, decoded attributes.
    pub attributes: Vec<Attribute>,
    /// Parsed or composed children.
    pub children: Vec<Node>,
}

impl Element {
    /// Read one attribute without changing its position.
    pub fn get(&self, name: &str) -> Option<&str> {
        self.attributes
            .iter()
            .find(|a| a.name == name)
            .map(|a| a.value.as_str())
    }

    /// Set an attribute, keeping its original position when present.
    pub fn set(&mut self, name: &str, value: impl Into<String>) {
        if let Some(attribute) = self.attributes.iter_mut().find(|a| a.name == name) {
            attribute.value = value.into();
        } else {
            self.attributes.push(Attribute {
                name: name.into(),
                value: value.into(),
            });
        }
    }

    /// Remove and return an attribute value.
    pub fn take(&mut self, name: &str) -> Option<String> {
        let index = self.attributes.iter().position(|a| a.name == name)?;
        Some(self.attributes.remove(index).value)
    }

    /// True only in the HTML namespace.
    pub fn is_html(&self) -> bool {
        self.namespace == "http://www.w3.org/1999/xhtml"
    }
}

/// An annotation around a sequence of siblings with one physical parent.
#[derive(Clone, Debug)]
pub struct Region {
    /// Document-order inspection id, allocated after composition.
    pub id: String,
    /// Annotation payload. No comment offsets are stored.
    pub kind: RegionKind,
}

/// Ownership and material-ignore information attached by composition.
#[derive(Clone, Debug)]
pub enum RegionKind {
    /// A component on its own page; serialized without markers.
    Root {
        /// Component parent path.
        path: String,
    },
    /// One logical instance; repeated placements can share its key.
    Instance {
        /// Registered component parent path.
        path: String,
        /// Logical input identity.
        key: String,
        /// Validated local input id.
        local_id: String,
        /// Canonical data-props digest.
        props_key: String,
    },
    /// A supplied slot keeps its original input owner.
    Slot {
        /// Logical slot key.
        key: String,
        /// Receiving instance key.
        instance_key: String,
        /// Declared name.
        name: String,
        /// Supplier's input owner.
        owner: ComponentInputOwner,
    },
    /// An active ignore region; scopes have already resolved.
    Ignore {
        /// Authored pairing id.
        id: String,
        /// Optional material key.
        material_key: Option<String>,
    },
}

/// Parsed node. Region nodes contain annotations, never source markers.
#[derive(Clone, Debug)]
pub enum Node {
    /// HTML5 element.
    Element(Element),
    /// Decoded text, including raw-text content.
    Text(String),
    /// Ordinary comment.
    Comment(String),
    /// Document doctype.
    Doctype(String),
    /// Annotated sibling range.
    Region {
        /// Ownership or ignore annotation.
        region: Region,
        /// Annotated children.
        children: Vec<Node>,
    },
}

/// Construct a package-owned HTML element.
pub fn element(name: &str, attributes: &[(&str, &str)], children: Vec<Node>) -> Node {
    Node::Element(Element {
        origin: None,
        navigation: None,
        source: None,
        name: name.into(),
        namespace: "http://www.w3.org/1999/xhtml".into(),
        attributes: attributes
            .iter()
            .map(|(name, value)| Attribute {
                name: (*name).into(),
                value: (*value).into(),
            })
            .collect(),
        children,
    })
}
