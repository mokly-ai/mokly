//! Lossless rule boundaries and canonical declaration tokens before optimization.

use std::ops::Range;
use std::result;

use cssparser::{ToCss, Token, TokenSerializationType};

use crate::token_tree::{Tokens, opening};

/// One top-level statement or block. Declaration runs retain source order.
pub(crate) struct Part<'a> {
    pub(crate) prelude: &'a str,
    pub(crate) body: Option<&'a str>,
}

pub(crate) fn parts(source: &str) -> result::Result<Vec<Part<'_>>, &'static str> {
    let bytes = source.as_bytes();
    let mut output = Vec::new();
    let mut start = 0;
    let mut index = 0;
    let mut stack = Vec::new();
    let mut body_start = None;
    while index < bytes.len() {
        match bytes[index] {
            b'/' if bytes.get(index + 1) == Some(&b'*') => {
                let Some(end) = source[index + 2..].find("*/") else {
                    return Err("unclosed comment");
                };
                index += end + 4;
                continue;
            }
            b'\'' | b'"' => {
                let quote = bytes[index];
                index += 1;
                loop {
                    match bytes.get(index) {
                        None => return Err("unclosed string"),
                        Some(b'\\') => index += 2,
                        Some(value) if *value == quote => break,
                        Some(b'\n' | b'\r') => return Err("newline in string"),
                        _ => index += 1,
                    }
                }
            }
            b'\\' => {
                index += 2;
                continue;
            }
            b'(' | b'[' => stack.push(bytes[index]),
            b'{' => {
                if stack.is_empty() {
                    body_start = Some(index);
                }
                stack.push(b'{');
            }
            b')' | b']' | b'}' => {
                let expected = match bytes[index] {
                    b')' => b'(',
                    b']' => b'[',
                    _ => b'{',
                };
                if stack.pop() != Some(expected) {
                    return Err("unmatched delimiter");
                }
                if stack.is_empty() && bytes[index] == b'}' {
                    let Some(open) = body_start.take() else {
                        return Err("unmatched block");
                    };
                    if source[start..open].trim_start().starts_with("--") {
                        index += 1;
                        continue;
                    }
                    output.push(Part {
                        prelude: &source[start..open],
                        body: Some(&source[open + 1..index]),
                    });
                    start = index + 1;
                }
            }
            b';' if stack.is_empty() => {
                output.push(Part {
                    prelude: &source[start..index],
                    body: None,
                });
                start = index + 1;
            }
            _ => {}
        }
        index += 1;
    }
    if !stack.is_empty() {
        return Err("unclosed block");
    }
    if !source[start..].trim().is_empty() {
        output.push(Part {
            prelude: &source[start..],
            body: None,
        });
    }
    Ok(output)
}

pub(crate) fn normalize(source: &str) -> String {
    tokens(source, false)
}

pub(crate) fn opaque(source: &str) -> String {
    tokens(source, true)
}

fn tokens(source: &str, opaque: bool) -> String {
    let tokens = Tokens::new(source);
    let mut text = String::new();
    let mut pending = vec![Serialization::new(tokens.root(), 0, None)];
    while let Some(frame) = pending.last_mut() {
        let Some(index) = tokens.next(&mut frame.range) else {
            if let Some(close) = frame.close {
                text.push(close);
            }
            pending.pop();
            continue;
        };
        let token = &tokens.nodes[index].token;
        if matches!(token, Token::WhiteSpace(_)) {
            frame.whitespace = true;
            continue;
        }
        if matches!(token, Token::Comment(_)) {
            continue;
        }
        let next = token.serialization_type();
        if frame.previous.needs_separator_when_before(next)
            || (opaque
                && frame.whitespace
                && text.len() > frame.start
                && !text.ends_with(['{', ';', ':', '(', '['])
                && matches!(
                    token,
                    Token::Ident(_)
                        | Token::Hash(_)
                        | Token::IDHash(_)
                        | Token::Delim('.' | '*' | '&')
                        | Token::Colon
                        | Token::SquareBracketBlock
                ))
        {
            text.push(' ');
        }
        frame.whitespace = false;
        frame.previous = next;
        let _ = token.to_css(&mut text);
        if let Some(close) = opening(token) {
            pending.push(Serialization::new(
                tokens.children(index),
                text.len(),
                Some(close),
            ));
        }
    }
    text
}

struct Serialization {
    range: Range<usize>,
    start: usize,
    close: Option<char>,
    previous: TokenSerializationType,
    whitespace: bool,
}

impl Serialization {
    fn new(range: Range<usize>, start: usize, close: Option<char>) -> Self {
        Self {
            range,
            start,
            close,
            previous: TokenSerializationType::default(),
            whitespace: false,
        }
    }
}
