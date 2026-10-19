//! Direct-child rule and declaration boundaries over the flat token arena.

use std::ops::Range;

use cssparser::Token;

use crate::token_tree::Tokens;

pub(crate) struct Section {
    pub(crate) prelude: Range<usize>,
    pub(crate) start: usize,
    pub(crate) end: usize,
    pub(crate) body: Option<Range<usize>>,
    pub(crate) semicolon: bool,
}

impl Section {
    pub(crate) fn text<'a>(&self, tokens: &Tokens<'a>) -> &'a str {
        &tokens.source[self.start..self.end]
    }

    pub(crate) fn first(&self, tokens: &Tokens<'_>) -> Option<usize> {
        tokens.next_significant(&mut self.prelude.clone())
    }
}

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
