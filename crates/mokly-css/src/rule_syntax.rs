//! Lossless rule boundaries and canonical declaration tokens before optimization.

use std::fmt::Write;
use std::result;

use cssparser::{ParseError, Parser, ParserInput, ToCss, Token, TokenSerializationType};

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
    let mut input = ParserInput::new(source);
    let mut parser = Parser::new(&mut input);
    tokens(&mut parser, false)
}

pub(crate) fn opaque(source: &str) -> String {
    let mut input = ParserInput::new(source);
    tokens(&mut Parser::new(&mut input), true)
}

fn tokens(parser: &mut Parser<'_, '_>, opaque: bool) -> String {
    let mut text = String::new();
    let mut previous = TokenSerializationType::default();
    let mut whitespace = false;
    while let Ok(token) = parser.next_including_whitespace_and_comments().cloned() {
        if matches!(token, Token::WhiteSpace(_)) {
            whitespace = true;
            continue;
        }
        if matches!(token, Token::Comment(_)) {
            continue;
        }
        let next = token.serialization_type();
        if previous.needs_separator_when_before(next)
            || (opaque
                && whitespace
                && !text.is_empty()
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
        whitespace = false;
        match token {
            Token::Function(_)
            | Token::ParenthesisBlock
            | Token::SquareBracketBlock
            | Token::CurlyBracketBlock => {
                let close = match token {
                    Token::SquareBracketBlock => ']',
                    Token::CurlyBracketBlock => '}',
                    _ => ')',
                };
                let _ = token.to_css(&mut text);
                let nested: result::Result<_, ParseError<'_, ()>> =
                    parser.parse_nested_block(|parser| Ok(tokens(parser, opaque)));
                if let Ok(nested) = nested {
                    let _ = write!(text, "{nested}{close}");
                }
            }
            _ => {
                let _ = token.to_css(&mut text);
            }
        }
        previous = next;
    }
    text
}
