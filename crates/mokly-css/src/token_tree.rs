//! Flat CSS tokens retain matched block ranges without recursive parser callbacks.

use std::ops::Range;

use cssparser::{Parser, ParserInput, Token};

/// One token and its complete, possibly implicitly closed, block extent.
pub(crate) struct Node<T> {
    pub(crate) token: T,
    trivia: bool,
    pub(crate) start: usize,
    pub(crate) end: usize,
    pub(crate) body_end: usize,
    pub(crate) after: usize,
    children_end: usize,
    next: usize,
}

/// A tokenizer-backed arena; dropping it never follows authored nesting.
pub(crate) struct Tokens<'a, T = Token<'a>> {
    pub(crate) source: &'a str,
    pub(crate) nodes: Vec<Node<T>>,
}

impl<'a> Tokens<'a> {
    pub(crate) fn new(source: &'a str) -> Self {
        Self::read(source, lex)
    }
}

pub(crate) struct Lexeme<T> {
    pub(crate) token: T,
    pub(crate) bytes: usize,
    pub(crate) trivia: bool,
    pub(crate) open: Option<char>,
    pub(crate) close: Option<char>,
}

impl<'a, T> Tokens<'a, T> {
    pub(crate) fn read(source: &'a str, lex: fn(&'a str) -> Option<Lexeme<T>>) -> Self {
        let mut nodes: Vec<Node<T>> = Vec::new();
        let mut blocks: Vec<(usize, char)> = Vec::new();
        let mut offset = 0;
        while offset < source.len() {
            let Some(lexeme) = lex(&source[offset..]) else {
                break;
            };
            let end = offset + lexeme.bytes;
            let index = nodes.len();
            if let Some(close) = lexeme.close
                && blocks
                    .last()
                    .is_some_and(|(_, expected)| *expected == close)
                && let Some((open, _)) = blocks.pop()
            {
                nodes[open].body_end = offset;
                nodes[open].after = end;
                nodes[open].children_end = index;
                nodes[open].next = index + 1;
            }
            if let Some(close) = lexeme.open {
                blocks.push((index, close));
            }
            nodes.push(Node {
                token: lexeme.token,
                trivia: lexeme.trivia,
                start: offset,
                end,
                body_end: end,
                after: end,
                children_end: index + 1,
                next: index + 1,
            });
            offset = end;
        }
        for (open, _) in blocks {
            nodes[open].body_end = source.len();
            nodes[open].after = source.len();
            nodes[open].children_end = nodes.len();
            nodes[open].next = nodes.len();
        }
        Self { source, nodes }
    }

    pub(crate) fn root(&self) -> Range<usize> {
        0..self.nodes.len()
    }

    pub(crate) fn children(&self, index: usize) -> Range<usize> {
        index + 1..self.nodes[index].children_end
    }

    pub(crate) fn next(&self, range: &mut Range<usize>) -> Option<usize> {
        let index = range.start;
        if index >= range.end {
            return None;
        }
        range.start = self.nodes[index].next.min(range.end);
        Some(index)
    }

    pub(crate) fn next_significant(&self, range: &mut Range<usize>) -> Option<usize> {
        while let Some(index) = self.next(range) {
            if !self.nodes[index].trivia {
                return Some(index);
            }
        }
        None
    }

    pub(crate) fn offset(&self, index: usize) -> usize {
        self.nodes
            .get(index)
            .map_or(self.source.len(), |node| node.start)
    }

    pub(crate) fn body(&self, index: usize) -> &'a str {
        let node = &self.nodes[index];
        &self.source[node.end..node.body_end]
    }
}

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

fn lex(source: &str) -> Option<Lexeme<Token<'_>>> {
    let mut input = ParserInput::new(source);
    let mut parser = Parser::new(&mut input);
    let token = parser
        .next_including_whitespace_and_comments()
        .ok()?
        .clone();
    Some(Lexeme {
        bytes: parser.position().byte_index(),
        trivia: matches!(token, Token::WhiteSpace(_) | Token::Comment(_)),
        open: opening(&token),
        close: closing(&token),
        token,
    })
}
