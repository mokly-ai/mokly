//! Statement boundaries at one block level: a prelude, then `{}` or `;`.

use std::ops::Range;

use cssparser::Token;

use crate::token_tree::Tokens;

/// How the statements of one block end, as lightningcss reads them.
#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) enum Grammar {
    /// The stylesheet and grouping at-rules: a statement ends at its `{}`
    /// block or at `;`.
    Rules,
    /// Style rules, declaration at-rules, and rules nested in them: a custom
    /// property runs through its `{}` blocks to the next `;`. Every other
    /// statement ends as in [`Grammar::Rules`].
    Declarations,
}

impl Grammar {
    /// The grammar of a block that a statement opens. `grouping` is true for
    /// a grouping at-rule; inside declarations, every nested block declares.
    pub(crate) fn nested(self, grouping: bool) -> Self {
        if self == Self::Declarations || !grouping {
            Self::Declarations
        } else {
            Self::Rules
        }
    }
}

/// One rule or declaration at a block's own level.
pub(crate) struct Section {
    /// Tokens before the `{` or `;`, including leading whitespace.
    pub(crate) prelude: Range<usize>,
    /// Byte offset of the first prelude token, which can be whitespace.
    pub(crate) start: usize,
    /// Byte offset of the `{` or `;`, or the end of the enclosing block.
    pub(crate) end: usize,
    /// The child tokens of the `{}` block that ends the section.
    pub(crate) body: Option<Range<usize>>,
    /// True when a `;` ends the section.
    pub(crate) semicolon: bool,
}

impl Section {
    /// The index of the first prelude token that is not whitespace or a comment.
    pub(crate) fn first(&self, tokens: &Tokens<'_>) -> Option<usize> {
        tokens.next_significant(&mut self.prelude.clone())
    }

    /// The byte offset of the first significant token, where diagnostics point.
    pub(crate) fn lead(&self, tokens: &Tokens<'_>) -> usize {
        self.first(tokens)
            .map_or(self.start, |index| tokens.nodes[index].start)
    }

    /// True when the statement starts with a dashed ident and a colon.
    pub(crate) fn custom_property(&self, tokens: &Tokens<'_>) -> bool {
        custom_property(tokens, self.prelude.clone())
    }

    /// The source text from the section start to its `{`, `;`, or block end.
    pub(crate) fn text<'a>(&self, tokens: &Tokens<'a>) -> &'a str {
        &tokens.source[self.start..self.end]
    }
}

/// Take the next section from `range`; `None` when only trivia remains.
pub(crate) fn next(
    tokens: &Tokens<'_>,
    range: &mut Range<usize>,
    grammar: Grammar,
) -> Option<Section> {
    tokens.next_significant(&mut range.clone())?;
    let begin = range.start;
    let start = tokens.offset(begin);
    let custom = grammar == Grammar::Declarations && custom_property(tokens, range.clone());
    while let Some(index) = tokens.next(range) {
        let node = &tokens.nodes[index];
        let body = !custom && matches!(node.token, Token::CurlyBracketBlock);
        let semicolon = matches!(node.token, Token::Semicolon);
        if body || semicolon {
            return Some(Section {
                prelude: begin..index,
                start,
                end: node.start,
                body: body.then(|| tokens.children(index)),
                semicolon,
            });
        }
    }
    Some(Section {
        prelude: begin..range.end,
        start,
        end: tokens.offset(range.end),
        body: None,
        semicolon: false,
    })
}

/// True when the statement starts with a dashed ident and a colon.
fn custom_property(tokens: &Tokens<'_>, mut range: Range<usize>) -> bool {
    let mut significant = || {
        tokens
            .next_significant(&mut range)
            .map(|index| &tokens.nodes[index].token)
    };
    matches!(significant(), Some(Token::Ident(name)) if name.starts_with("--"))
        && matches!(significant(), Some(Token::Colon))
}
