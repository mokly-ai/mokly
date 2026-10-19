//! Statement boundaries at one block level: a prelude, then `{}` or `;`.

use std::ops::Range;

use cssparser::Token;

use crate::token_tree::Tokens;

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
}

/// Take the next section from `range`; `None` when only trivia remains.
pub(crate) fn next(tokens: &Tokens<'_>, range: &mut Range<usize>) -> Option<Section> {
    tokens.next_significant(&mut range.clone())?;
    let begin = range.start;
    let start = tokens.offset(begin);
    while let Some(index) = tokens.next(range) {
        let node = &tokens.nodes[index];
        let body = matches!(node.token, Token::CurlyBracketBlock);
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
