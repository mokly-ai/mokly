//! A flat CSS token arena with block extents, so scanners walk nesting iteratively.
//!
//! cssparser only exposes nested blocks through recursive callbacks. The arena
//! reads one token at a time from a fresh top-level parser instead, then matches
//! block openers and closers with an explicit stack. The block structure is the
//! one cssparser builds: a closer that does not match the innermost open block is
//! an ordinary token, and blocks still open at the end of input close there.

use std::ops::Range;

use cssparser::{Parser, ParserInput, Token};

/// One token and, for a block opener, the extent of its block.
pub(crate) struct Node<'a> {
    /// The token, borrowing the source where cssparser does.
    pub(crate) token: Token<'a>,
    /// True for whitespace and comments.
    trivia: bool,
    /// Byte offset of the token.
    pub(crate) start: usize,
    /// Byte offset after the token; a block's content starts here.
    pub(crate) end: usize,
    /// Byte offset where a block's content ends: its closer, or the input end.
    pub(crate) body_end: usize,
    /// Byte offset after a block's closer, or the input end for an open block.
    pub(crate) after: usize,
    /// The index after the block's last child: its closer, or the node count.
    children_end: usize,
    /// The index of the next token at this token's own nesting level.
    next: usize,
}

/// The tokens of one source, in source order. Dropping it never recurses.
pub(crate) struct Tokens<'a> {
    pub(crate) source: &'a str,
    pub(crate) nodes: Vec<Node<'a>>,
}

impl<'a> Tokens<'a> {
    /// Tokenize `source`, including whitespace and comments.
    pub(crate) fn new(source: &'a str) -> Self {
        let mut nodes: Vec<Node<'a>> = Vec::new();
        let mut open: Vec<(usize, char)> = Vec::new();
        let mut offset = 0;
        while offset < source.len() {
            let Some((token, length)) = lex(&source[offset..]) else {
                break;
            };
            let end = offset + length;
            let index = nodes.len();
            if let Some(close) = closing(&token)
                && open.last().is_some_and(|(_, expected)| *expected == close)
                && let Some((opener, _)) = open.pop()
            {
                let node = &mut nodes[opener];
                node.body_end = offset;
                node.after = end;
                node.children_end = index;
                node.next = index + 1;
            }
            if let Some(close) = opening(&token) {
                open.push((index, close));
            }
            nodes.push(Node {
                trivia: matches!(token, Token::WhiteSpace(_) | Token::Comment(_)),
                token,
                start: offset,
                end,
                body_end: end,
                after: end,
                children_end: index + 1,
                next: index + 1,
            });
            offset = end;
        }
        let count = nodes.len();
        for (opener, _) in open {
            let node = &mut nodes[opener];
            node.body_end = source.len();
            node.after = source.len();
            node.children_end = count;
            node.next = count;
        }
        Self { source, nodes }
    }

    /// The top-level token range.
    pub(crate) fn root(&self) -> Range<usize> {
        0..self.nodes.len()
    }

    /// The child token range of a block opener.
    pub(crate) fn children(&self, index: usize) -> Range<usize> {
        index + 1..self.nodes[index].children_end
    }

    /// Take the next token at the range's level, stepping over nested blocks.
    pub(crate) fn next(&self, range: &mut Range<usize>) -> Option<usize> {
        let index = range.start;
        if index >= range.end {
            return None;
        }
        range.start = self.nodes[index].next.min(range.end);
        Some(index)
    }

    /// Take the next token that is not whitespace or a comment.
    pub(crate) fn next_significant(&self, range: &mut Range<usize>) -> Option<usize> {
        while let Some(index) = self.next(range) {
            if !self.nodes[index].trivia {
                return Some(index);
            }
        }
        None
    }

    /// The byte offset of a token index; the end of the input past the last token.
    pub(crate) fn offset(&self, index: usize) -> usize {
        self.nodes
            .get(index)
            .map_or(self.source.len(), |node| node.start)
    }

    /// The source text between a block opener and its closer.
    pub(crate) fn body(&self, index: usize) -> &'a str {
        let node = &self.nodes[index];
        &self.source[node.end..node.body_end]
    }
}

/// The closer that ends a block opened by `token`.
pub(crate) fn opening(token: &Token<'_>) -> Option<char> {
    match token {
        Token::Function(_) | Token::ParenthesisBlock => Some(')'),
        Token::CurlyBracketBlock => Some('}'),
        Token::SquareBracketBlock => Some(']'),
        _ => None,
    }
}

fn closing(token: &Token<'_>) -> Option<char> {
    match token {
        Token::CloseParenthesis => Some(')'),
        Token::CloseCurlyBracket => Some('}'),
        Token::CloseSquareBracket => Some(']'),
        _ => None,
    }
}

/// Read the first token of `source` and its byte length.
fn lex(source: &str) -> Option<(Token<'_>, usize)> {
    let mut input = ParserInput::new(source);
    let mut parser = Parser::new(&mut input);
    let token = parser
        .next_including_whitespace_and_comments()
        .ok()?
        .clone();
    Some((token, parser.position().byte_index()))
}
