//! Typed HTML inputs: the type of an input decides how Mokly parses it.
//!
//! Only `Template` and `SavedSlot` create [`AuthoredHtml`], so a caller that holds one of them
//! gets the authored parse from its helper. Delivered constructors accept any text.

/// How a parse reads its text.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum HtmlShape {
    /// A complete document, such as a page or a delivered file.
    Document,
    /// A fragment inside a `body` element.
    Fragment,
}

/// The source position where authored HTML starts.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct HtmlOrigin<'a> {
    /// Repository-relative source path.
    pub path: &'a str,
    /// One-based line of the first character.
    pub line: usize,
    /// One-based column of the first character.
    pub column: usize,
}

/// Catalogue-authored HTML. Its parses drop unknown ignore-wrapper attributes.
#[derive(Clone, Copy, Debug)]
pub struct AuthoredHtml<'a> {
    text: &'a str,
    shape: HtmlShape,
    origin: Option<HtmlOrigin<'a>>,
}

/// Delivered HTML. Its parses read it as a browser does and keep every attribute.
#[derive(Clone, Copy, Debug)]
pub struct DeliveredHtml<'a> {
    text: &'a str,
    shape: HtmlShape,
}

/// Authored or delivered HTML, for a parse that serves both.
#[derive(Clone, Copy, Debug)]
pub enum HtmlInput<'a> {
    /// Catalogue-authored HTML.
    Authored(AuthoredHtml<'a>),
    /// Delivered HTML.
    Delivered(DeliveredHtml<'a>),
}

impl<'a> AuthoredHtml<'a> {
    pub(crate) fn new(text: &'a str, shape: HtmlShape, origin: Option<HtmlOrigin<'a>>) -> Self {
        Self {
            text,
            shape,
            origin,
        }
    }

    /// The authored text.
    pub fn text(&self) -> &'a str {
        self.text
    }

    /// Whether the text is a document or a fragment.
    pub fn shape(&self) -> HtmlShape {
        self.shape
    }

    /// Where the text starts in its source file, when the parse records source positions.
    pub fn origin(&self) -> Option<HtmlOrigin<'a>> {
        self.origin
    }
}

impl<'a> DeliveredHtml<'a> {
    /// A complete delivered document, such as an HTML file, a `srcdoc` value, or a callback page.
    pub fn document(text: &'a str) -> Self {
        Self {
            text,
            shape: HtmlShape::Document,
        }
    }

    /// A delivered fragment, such as callback component HTML or rendered Markdown.
    pub fn fragment(text: &'a str) -> Self {
        Self {
            text,
            shape: HtmlShape::Fragment,
        }
    }

    /// The delivered text.
    pub fn text(&self) -> &'a str {
        self.text
    }

    /// Whether the text is a document or a fragment.
    pub fn shape(&self) -> HtmlShape {
        self.shape
    }
}

impl<'a> HtmlInput<'a> {
    /// The input text.
    pub fn text(&self) -> &'a str {
        match self {
            Self::Authored(html) => html.text,
            Self::Delivered(html) => html.text,
        }
    }

    /// Whether the text is a document or a fragment.
    pub fn shape(&self) -> HtmlShape {
        match self {
            Self::Authored(html) => html.shape,
            Self::Delivered(html) => html.shape,
        }
    }
}

impl<'a> From<AuthoredHtml<'a>> for HtmlInput<'a> {
    fn from(html: AuthoredHtml<'a>) -> Self {
        Self::Authored(html)
    }
}

impl<'a> From<DeliveredHtml<'a>> for HtmlInput<'a> {
    fn from(html: DeliveredHtml<'a>) -> Self {
        Self::Delivered(html)
    }
}

/// The one-based line and column of a byte offset, counted in characters.
pub(crate) fn line_and_column(source: &str, offset: usize) -> (usize, usize) {
    let end = offset.min(source.len());
    let mut line = 1;
    let mut column = 1;
    for character in source.get(..end).unwrap_or_default().chars() {
        if character == '\n' {
            line += 1;
            column = 1;
        } else {
            column += 1;
        }
    }
    (line, column)
}
