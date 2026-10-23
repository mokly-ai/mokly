//! Replace nesting tokens without changing literal strings or attribute values.

use std::result;

use cssparser_next::{ParseError, Parser, Token};

pub(crate) fn combine(selector: &str, parent: Option<&str>) -> Option<String> {
    let Some(parent) = parent else {
        return Some(selector.into());
    };
    let mut parser = Parser::new(selector);
    let mut edits = Vec::new();
    positions(&mut parser, &mut edits)?;
    let parent = format!(":is({parent})");
    if edits.is_empty() {
        return Some(format!("{parent} {selector}"));
    }
    let mut result = selector.to_owned();
    for (start, end) in edits.into_iter().rev() {
        result.get(start..end)?;
        result.replace_range(start..end, &parent);
    }
    Some(result)
}

fn positions(parser: &mut Parser<'_>, output: &mut Vec<(usize, usize)>) -> Option<()> {
    while !parser.is_exhausted() {
        let start = parser.position().byte_index();
        let token = parser
            .next_including_whitespace_and_comments()
            .ok()?
            .clone();
        match token {
            Token::Delim('&') => output.push((start, parser.position().byte_index())),
            Token::Function(_) | Token::ParenthesisBlock => {
                let parsed: result::Result<_, ParseError<()>> =
                    parser.parse_nested_block(|nested| {
                        positions(nested, output).ok_or_else(|| ParseError::custom(()))
                    });
                parsed.ok()?;
            }
            Token::SquareBracketBlock => {
                let parsed: result::Result<_, ParseError<()>> =
                    parser.parse_nested_block(|nested| {
                        while nested.next_including_whitespace_and_comments().is_ok() {}
                        Ok(())
                    });
                parsed.ok()?;
            }
            _ => {}
        }
    }
    Some(())
}
