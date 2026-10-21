//! Shared plaintext activation in the foreign-content contexts of serialized tags.

use std::collections::BTreeMap;

use crate::tree::Element;

#[derive(Clone, Copy, Default, Eq, PartialEq)]
enum Namespace {
    #[default]
    Html,
    Svg,
    Math,
}

#[derive(Clone, Copy)]
enum Integration {
    None,
    Html,
    MathText,
    Annotation(bool),
}

struct Frame {
    token: Token,
    name: String,
    namespace: Namespace,
    integration: Integration,
}

impl Frame {
    fn html_child(&self, name: &str) -> bool {
        self.namespace == Namespace::Html
            || match self.integration {
                Integration::None => false,
                Integration::Html => true,
                Integration::MathText => !matches!(name, "mglyph" | "malignmark"),
                Integration::Annotation(html) => html || name == "svg",
            }
    }

    fn breakout_boundary(&self) -> bool {
        self.namespace == Namespace::Html
            || matches!(self.integration, Integration::Html | Integration::MathText)
    }
}

/// A serialized element can outlive its parser ancestor after foreign-content repair.
#[derive(Clone, Copy, Eq, PartialEq)]
pub(crate) struct Token {
    id: usize,
    index: usize,
    namespace: Namespace,
}

impl Token {
    /// Whether this serialized start tag enters the HTML parser namespace.
    pub(crate) fn is_html(self) -> bool {
        self.namespace == Namespace::Html
    }
}

/// Region annotations are transparent; both tree walks enter and leave only elements.
pub(crate) struct TextMode {
    open: Vec<Frame>,
    names: BTreeMap<String, Vec<usize>>,
    html: Vec<usize>,
    next: usize,
    plaintext: bool,
    allow_plaintext: bool,
}

impl Default for TextMode {
    fn default() -> Self {
        Self {
            open: Vec::new(),
            names: BTreeMap::new(),
            html: Vec::new(),
            next: 0,
            plaintext: false,
            allow_plaintext: true,
        }
    }
}

impl TextMode {
    /// Create parser context that never predicts the obsolete plaintext state.
    pub(crate) fn without_plaintext() -> Self {
        Self {
            allow_plaintext: false,
            ..Self::default()
        }
    }
    /// Whether the parser consumes every later byte as literal text.
    pub(crate) fn plaintext(&self) -> bool {
        self.plaintext
    }

    /// Advance the effective parser context for a serialized start tag.
    pub(crate) fn enter(&mut self, element: &Element) -> Token {
        let id = self.next;
        self.next += 1;
        if self.plaintext {
            return Token {
                id,
                index: self.open.len(),
                namespace: Namespace::Html,
            };
        }
        let name = element.name.to_ascii_lowercase();
        if self
            .open
            .last()
            .is_some_and(|parent| !parent.html_child(&name))
            && breakout(&name, element)
        {
            while self
                .open
                .last()
                .is_some_and(|parent| !parent.breakout_boundary())
            {
                self.pop();
            }
        }
        let namespace = match self.open.last() {
            Some(parent) if !parent.html_child(&name) => parent.namespace,
            _ => match name.as_str() {
                "svg" => Namespace::Svg,
                "math" => Namespace::Math,
                _ => Namespace::Html,
            },
        };
        self.plaintext =
            self.allow_plaintext && namespace == Namespace::Html && name == "plaintext";
        let integration = match (namespace, name.as_str()) {
            (Namespace::Svg, "foreignobject" | "desc" | "title") => Integration::Html,
            (Namespace::Math, "mi" | "mo" | "mn" | "ms" | "mtext") => Integration::MathText,
            (Namespace::Math, "annotation-xml") => {
                Integration::Annotation(element.get("encoding").is_some_and(|encoding| {
                    encoding.eq_ignore_ascii_case("text/html")
                        || encoding.eq_ignore_ascii_case("application/xhtml+xml")
                }))
            }
            _ => Integration::None,
        };
        let token = Token {
            id,
            index: self.open.len(),
            namespace,
        };
        self.names
            .entry(name.clone())
            .or_default()
            .push(token.index);
        if namespace == Namespace::Html {
            self.html.push(token.index);
        }
        self.open.push(Frame {
            token,
            name,
            namespace,
            integration,
        });
        token
    }

    /// Apply an end tag even when foreign-content repair removed its original node.
    pub(crate) fn leave(&mut self, token: Token, name: &str) {
        if self.plaintext {
            return;
        }
        if self.open.last().is_some_and(|frame| frame.token == token) {
            self.pop();
            return;
        }
        if self
            .open
            .last()
            .is_some_and(|frame| frame.namespace != Namespace::Html)
            && let Some(index) = self
                .names
                .get(&name.to_ascii_lowercase())
                .and_then(|indices| indices.last())
                .copied()
            && self.html.last().is_none_or(|html| index > *html)
        {
            self.truncate(index);
        } else if self
            .open
            .get(token.index)
            .is_some_and(|frame| frame.token == token)
        {
            self.truncate(token.index);
        }
    }

    fn truncate(&mut self, index: usize) {
        while self.open.len() > index {
            self.pop();
        }
    }

    /// Name and HTML-boundary indices avoid rescanning deep surviving ancestors.
    fn pop(&mut self) {
        if let Some(frame) = self.open.pop() {
            if let Some(indices) = self.names.get_mut(&frame.name) {
                indices.pop();
                if indices.is_empty() {
                    self.names.remove(&frame.name);
                }
            }
            if frame.namespace == Namespace::Html {
                self.html.pop();
            }
        }
    }
}

fn breakout(name: &str, element: &Element) -> bool {
    matches!(
        name,
        "b" | "big"
            | "blockquote"
            | "body"
            | "br"
            | "center"
            | "code"
            | "dd"
            | "div"
            | "dl"
            | "dt"
            | "em"
            | "embed"
            | "h1"
            | "h2"
            | "h3"
            | "h4"
            | "h5"
            | "h6"
            | "head"
            | "hr"
            | "i"
            | "img"
            | "li"
            | "listing"
            | "menu"
            | "meta"
            | "nobr"
            | "ol"
            | "p"
            | "pre"
            | "ruby"
            | "s"
            | "small"
            | "span"
            | "strong"
            | "strike"
            | "sub"
            | "sup"
            | "table"
            | "tt"
            | "u"
            | "ul"
            | "var"
    ) || (name == "font"
        && ["color", "face", "size"]
            .iter()
            .any(|name| element.get(name).is_some()))
}
