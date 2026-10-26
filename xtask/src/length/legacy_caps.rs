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
use super::legacy_literals::{numeric_literal, string_literal};
use super::policy::PROTOCOL_LIMIT;

/// The declaration of the table. A pattern that does not compile reads as
/// an invalid table, so the audit fails instead of crashing.
static DECLARATION: LazyLock<Option<Regex>> =
    LazyLock::new(|| Regex::new(r"(?m)^(?:export\s+)?(?:const|let|var)\s+oversizedCaps\b").ok());
/// The largest integer that a JavaScript number holds exactly.
const MAX_SAFE_INTEGER: f64 = 9_007_199_254_740_991.0;

/// The caps of the legacy table, or none when the source declares no
/// `oversizedCaps`.
pub(crate) fn parse_legacy_caps(source: &[u8], label: &str) -> Result<Option<ProtocolCaps>> {
    let text = String::from_utf8_lossy(source);
    let invalid = || Error::LegacyTable {
        label: label.to_owned(),
    };
    let declaration = DECLARATION.as_ref().ok_or_else(invalid)?;
    let Some(found) = declaration.find(&text) else {
        return Ok(None);
    };
    let mut cursor = Cursor {
        text: &text,
        index: found.end(),
        label,
    };
    cursor.skip_type_annotation()?;
    if !cursor.eat('=') {
        return Err(invalid());
    }
    let caps = cursor.initializer()?;
    if !cursor.at_statement_end() {
        return Err(invalid());
    }
    Ok(Some(caps))
}

/// A position in the declaration's source text. Lookahead never moves the
/// position; only `eat` and the explicit consumers do.
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

    /// The index of the next token after whitespace and comments.
    fn token_start(&self) -> usize {
        let mut index = self.index;
        loop {
            let rest = &self.text[index..];
            let trimmed = rest.trim_start();
            index += rest.len() - trimmed.len();
            if trimmed.starts_with("//") {
                index += trimmed.find('\n').unwrap_or(trimmed.len());
            } else if let Some(comment) = trimmed.strip_prefix("/*") {
                index += 2 + comment.find("*/").map_or(comment.len(), |end| end + 2);
            } else {
                return index;
            }
        }
    }

    /// The text from the next token on.
    fn rest(&self) -> &'a str {
        &self.text[self.token_start()..]
    }

    fn peek(&self) -> Option<char> {
        self.rest().chars().next()
    }

    /// Consume `expected` when it is the next token.
    fn eat(&mut self, expected: char) -> bool {
        let start = self.token_start();
        let found = self.text[start..].starts_with(expected);
        if found {
            self.index = start + expected.len_utf8();
        }
        found
    }

    /// Whether the statement ends here: at `;`, the end of the text, or a
    /// newline before the next token.
    fn at_statement_end(&self) -> bool {
        let next = self.token_start();
        matches!(self.text[next..].chars().next(), None | Some(';'))
            || self.text[self.index..next].contains('\n')
    }

    /// Skip `: Type`, balancing brackets, up to the `=` of the initializer.
    fn skip_type_annotation(&mut self) -> Result<()> {
        if !self.eat(':') {
            return Ok(());
        }
        let mut depth = 0_i32;
        loop {
            let start = self.token_start();
            let rest = &self.text[start..];
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
            self.index = start + if arrow { 2 } else { character.len_utf8() };
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
            self.index = self.token_start() + keyword.len();
            self.skip_suffix_type();
        }
        Ok(caps)
    }

    /// The `as` or `satisfies` keyword that comes next, if any.
    fn type_operator(&self) -> Option<&'static str> {
        let rest = self.rest();
        ["as", "satisfies"].into_iter().find(|keyword| {
            rest.strip_prefix(keyword)
                .is_some_and(|after| after.starts_with(char::is_whitespace))
        })
    }

    /// Consume the type after `as` or `satisfies` up to `;`, `)`, or a
    /// newline.
    fn skip_suffix_type(&mut self) {
        let start = self.token_start();
        let mut depth = 0_i32;
        let mut consumed = 0;
        for character in self.text[start..].chars() {
            match character {
                '<' | '(' | '[' | '{' => depth += 1,
                ')' | ';' | '\n' if depth == 0 => break,
                '>' | ')' | ']' | '}' => depth -= 1,
                _ => {}
            }
            consumed += character.len_utf8();
        }
        self.index = start + consumed;
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

    /// Consume a string literal and return its value.
    fn string_literal(&mut self) -> Option<String> {
        let start = self.token_start();
        let (value, length) = string_literal(&self.text[start..])?;
        self.index = start + length;
        Some(value)
    }

    /// Consume a numeric literal and return its value.
    fn numeric_literal(&mut self) -> Option<f64> {
        let start = self.token_start();
        let (value, length) = numeric_literal(&self.text[start..])?;
        self.index = start + length;
        Some(value)
    }
}

#[cfg(test)]
#[path = "_tests_/legacy_caps_tests.rs"]
mod legacy_caps_tests;
