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
}

/// Region annotations are transparent; both tree walks enter and leave only elements.
#[derive(Default)]
pub(crate) struct TextMode {
    open: Vec<Frame>,
    names: BTreeMap<String, Vec<usize>>,
    html: Vec<usize>,
    noscript: usize,
    next: usize,
    plaintext: bool,
}

impl TextMode {
    /// Whether the parser consumes every later byte as literal text.
    pub(crate) fn plaintext(&self) -> bool {
        self.plaintext
    }

    /// Raw text cannot end an HTML noscript in a scripting-enabled browser.
    /// Include the last nine bytes so adjacent raw writes cannot split the tag.
    pub(crate) fn write_raw(&self, value: &str, output: &mut String) {
        let mut start = output.len().saturating_sub("</noscript".len() - 1);
        while !output.is_char_boundary(start) {
            start += 1;
        }
        output.push_str(value);
        if self.noscript == 0 {
            return;
        }
        let mut escaped = String::new();
        let mut from = start;
        for (offset, _) in output[start..].match_indices('<') {
            let at = start + offset;
            if output[at..]
                .get(.."</noscript".len())
                .is_some_and(|prefix| prefix.eq_ignore_ascii_case("</noscript"))
            {
                escaped.push_str(&output[from..at]);
                escaped.push_str("&lt;");
                from = at + 1;
            }
        }
        if from != start {
            escaped.push_str(&output[from..]);
            output.truncate(start);
            output.push_str(&escaped);
        }
    }

    /// Advance the effective parser context for a serialized start tag.
    pub(crate) fn enter(&mut self, element: &Element) -> Token {
        let id = self.next;
        self.next += 1;
        if self.plaintext {
            return Token {
                id,
                index: self.open.len(),
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
        self.plaintext = namespace == Namespace::Html && name == "plaintext";
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
        };
        self.names
            .entry(name.clone())
            .or_default()
            .push(token.index);
        if namespace == Namespace::Html {
            self.html.push(token.index);
            if name == "noscript" {
                self.noscript += 1;
            }
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
                if frame.name == "noscript" {
                    self.noscript -= 1;
                }
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
