//! The legacy `oversizedCaps` table of `tests/protocol_doc_sizes.test.ts`,
//! which comparison commits from before the JSON cap table hold instead.
//!
//! The parser reads the one form that the former test used: a top-level
//! `const`, `let`, or `var` at the start of a line, an optional type
//! annotation, and an initializer that is an object literal of string keys
//! and numeric literal values, optionally inside parentheses or before `as`
//! or `satisfies`. Every other initializer or entry fails.

use std::sync::LazyLock;

use regex::Regex;

use super::caps::ProtocolCaps;
use super::error::{Error, Result};
use super::policy::PROTOCOL_LIMIT;

static DECLARATION: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?m)^(?:export\s+)?(?:const|let|var)\s+oversizedCaps\b").unwrap()
});
static NUMBER: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(concat!(
        r"^(?:0[xX][0-9a-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+",
        r"|[0-9][0-9_]*(?:\.[0-9_]*)?(?:[eE][+-]?[0-9_]+)?",
        r"|\.[0-9][0-9_]*(?:[eE][+-]?[0-9_]+)?)n?",
    ))
    .unwrap()
});
/// The largest integer that a JavaScript number holds exactly.
const MAX_SAFE_INTEGER: f64 = 9_007_199_254_740_991.0;

/// The caps of the legacy table, or none when the source declares no
/// `oversizedCaps`.
pub(crate) fn parse_legacy_caps(source: &[u8], label: &str) -> Result<Option<ProtocolCaps>> {
    let text = String::from_utf8_lossy(source);
    let Some(declaration) = DECLARATION.find(&text) else {
        return Ok(None);
    };
    let mut cursor = Cursor {
        text: &text,
        index: declaration.end(),
        label,
    };
    cursor.skip_type_annotation()?;
    if !cursor.eat('=') {
        return Err(cursor.invalid_table());
    }
    let caps = cursor.initializer()?;
    if !cursor.at_statement_end() {
        return Err(cursor.invalid_table());
    }
    Ok(Some(caps))
}

/// A position in the declaration's source text.
struct Cursor<'a> {
    text: &'a str,
    index: usize,
    label: &'a str,
}

impl<'a> Cursor<'a> {
    fn invalid_table(&self) -> Error {
        Error::LegacyTable {
            label: self.label.to_owned(),
        }
    }

    fn invalid_entry(&self) -> Error {
        Error::LegacyEntry {
            label: self.label.to_owned(),
        }
    }

    /// The text after the cursor, after whitespace and comments.
    fn rest(&mut self) -> &'a str {
        loop {
            let rest = &self.text[self.index..];
            let trimmed = rest.trim_start();
            self.index += rest.len() - trimmed.len();
            if trimmed.starts_with("//") {
                self.index += trimmed.find('\n').unwrap_or(trimmed.len());
            } else if let Some(comment) = trimmed.strip_prefix("/*") {
                self.index += 2 + comment.find("*/").map_or(comment.len(), |end| end + 2);
            } else {
                return trimmed;
            }
        }
    }

    fn peek(&mut self) -> Option<char> {
        self.rest().chars().next()
    }

    fn eat(&mut self, expected: char) -> bool {
        let found = self.peek() == Some(expected);
        if found {
            self.index += expected.len_utf8();
        }
        found
    }

    /// Whether the statement ends here: at `;`, the end of the text, or a
    /// newline before the next token.
    fn at_statement_end(&mut self) -> bool {
        let before = self.index;
        let next = self.peek();
        matches!(next, None | Some(';')) || self.text[before..self.index].contains('\n')
    }

    /// Skip `: Type`, balancing brackets, up to the `=` of the initializer.
    fn skip_type_annotation(&mut self) -> Result<()> {
        if !self.eat(':') {
            return Ok(());
        }
        let mut depth = 0_i32;
        loop {
            let rest = self.rest();
            let Some(character) = rest.chars().next() else {
                return Err(self.invalid_table());
            };
            let arrow = rest.starts_with("=>");
            match character {
                '=' if depth == 0 && !arrow => return Ok(()),
                '<' | '(' | '[' | '{' => depth += 1,
                '>' | ')' | ']' | '}' => depth -= 1,
                _ => {}
            }
            self.index += if arrow { 2 } else { character.len_utf8() };
        }
    }

    /// The object literal of the initializer inside any parentheses, with
    /// any `as` or `satisfies` suffix.
    fn initializer(&mut self) -> Result<ProtocolCaps> {
        let caps = if self.eat('(') {
            let caps = self.initializer()?;
            if !self.eat(')') {
                return Err(self.invalid_table());
            }
            caps
        } else if self.eat('{') {
            self.object_literal()?
        } else {
            return Err(self.invalid_table());
        };
        while let Some(keyword) = self.type_operator() {
            self.index += keyword.len();
            self.skip_suffix_type();
        }
        Ok(caps)
    }

    /// The `as` or `satisfies` keyword at the cursor.
    fn type_operator(&mut self) -> Option<&'static str> {
        let rest = self.rest();
        ["as", "satisfies"].into_iter().find(|keyword| {
            rest.strip_prefix(keyword)
                .is_some_and(|after| after.starts_with(char::is_whitespace))
        })
    }

    /// Skip the type after `as` or `satisfies` up to `;`, `)`, or a newline.
    fn skip_suffix_type(&mut self) {
        let mut depth = 0_i32;
        let mut consumed = 0;
        let rest = self.rest();
        for character in rest.chars() {
            match character {
                '<' | '(' | '[' | '{' => depth += 1,
                ')' | ';' | '\n' if depth == 0 => break,
                '>' | ')' | ']' | '}' => depth -= 1,
                _ => {}
            }
            consumed += character.len_utf8();
        }
        self.index += consumed;
    }

    /// `{ "name": 260, ... }` after the opening brace.
    fn object_literal(&mut self) -> Result<ProtocolCaps> {
        let mut caps = ProtocolCaps::default();
        while !self.eat('}') {
            let name = self.string_literal().ok_or_else(|| self.invalid_entry())?;
            if !self.eat(':') {
                return Err(self.invalid_entry());
            }
            let value = self.numeric_literal().ok_or_else(|| self.invalid_entry())?;
            if !matches!(self.peek(), Some(',' | '}')) {
                return Err(self.invalid_entry());
            }
            let integral = value.fract() == 0.0 && value.abs() <= MAX_SAFE_INTEGER;
            if !integral || value <= PROTOCOL_LIMIT as f64 {
                return Err(Error::LegacyValue {
                    label: self.label.to_owned(),
                    name,
                });
            }
            if caps.get(&name).is_some() {
                return Err(Error::CapTableRepeat {
                    label: self.label.to_owned(),
                    name,
                });
            }
            caps.insert(name, value as u64);
            self.eat(',');
        }
        Ok(caps)
    }

    /// A single- or double-quoted string literal with its escapes read.
    fn string_literal(&mut self) -> Option<String> {
        let rest = self.rest();
        let quote = rest
            .chars()
            .next()
            .filter(|quote| *quote == '"' || *quote == '\'')?;
        let mut characters = rest[1..].char_indices().peekable();
        let mut value = String::new();
        while let Some((offset, character)) = characters.next() {
            if character == quote {
                self.index += 1 + offset + 1;
                return Some(value);
            }
            if character != '\\' {
                value.push(character);
                continue;
            }
            let (_, escaped) = characters.next()?;
            match escaped {
                'n' => value.push('\n'),
                'r' => value.push('\r'),
                't' => value.push('\t'),
                'b' => value.push('\u{8}'),
                'f' => value.push('\u{c}'),
                'v' => value.push('\u{b}'),
                '0' => value.push('\0'),
                'x' | 'u' => {
                    let braced =
                        escaped == 'u' && characters.next_if(|(_, next)| *next == '{').is_some();
                    let mut digits = String::new();
                    while let Some((_, digit)) =
                        characters.next_if(|(_, next)| next.is_ascii_hexdigit())
                    {
                        digits.push(digit);
                        if !braced && digits.len() == if escaped == 'x' { 2 } else { 4 } {
                            break;
                        }
                    }
                    if braced && characters.next_if(|(_, next)| *next == '}').is_none() {
                        return None;
                    }
                    value.push(char::from_u32(u32::from_str_radix(&digits, 16).ok()?)?);
                }
                '\r' => {
                    characters.next_if(|(_, next)| *next == '\n');
                }
                '\n' => {}
                other => value.push(other),
            }
        }
        None
    }

    /// A numeric literal's value. A `bigint` literal is not a number.
    fn numeric_literal(&mut self) -> Option<f64> {
        let found = NUMBER.find(self.rest())?.as_str();
        if found.ends_with('n') {
            return None;
        }
        self.index += found.len();
        let digits = found.replace('_', "");
        for (prefixes, radix) in [(['x', 'X'], 16), (['o', 'O'], 8), (['b', 'B'], 2)] {
            if let Some(rest) = digits
                .strip_prefix('0')
                .and_then(|rest| rest.strip_prefix(prefixes))
            {
                return u64::from_str_radix(rest, radix)
                    .ok()
                    .map(|value| value as f64);
            }
        }
        digits.parse().ok()
    }
}

#[cfg(test)]
#[path = "_tests_/legacy_caps_tests.rs"]
mod legacy_caps_tests;
