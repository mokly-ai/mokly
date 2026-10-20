//! Shared plaintext activation in the foreign-content contexts of serialized tags.

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
pub(crate) struct Token(usize);

/// Region annotations are transparent; both tree walks enter and leave only elements.
#[derive(Default)]
pub(crate) struct TextMode {
    open: Vec<Frame>,
    next: usize,
    plaintext: bool,
}

impl TextMode {
    /// Whether the parser consumes every later byte as literal text.
    pub(crate) fn plaintext(&self) -> bool {
        self.plaintext
    }

    /// Advance the effective parser context for a serialized start tag.
    pub(crate) fn enter(&mut self, element: &Element) -> Token {
        let token = Token(self.next);
        self.next += 1;
        if self.plaintext {
            return token;
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
                self.open.pop();
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
        self.open.push(Frame {
            token,
            namespace,
            integration,
        });
        token
    }

    /// Leave an ancestor unless foreign-content repair already popped it.
    pub(crate) fn leave(&mut self, token: Token) {
        if self.open.last().is_some_and(|frame| frame.token == token) {
            self.open.pop();
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
