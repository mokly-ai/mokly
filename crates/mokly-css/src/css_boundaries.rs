//! Ignore CSS's top-level HTML boundary tokens without touching nested or quoted text.

use cssparser::{Parser, ParserInput, Token};

pub(crate) fn strip(source: &str) -> String {
    let mut input = ParserInput::new(source);
    let mut parser = Parser::new(&mut input);
    let mut edits = Vec::new();
    while !parser.is_exhausted() {
        let start = parser.position().byte_index();
        let Ok(token) = parser.next_including_whitespace_and_comments().cloned() else {
            break;
        };
        match token {
            Token::CDO | Token::CDC => edits.push((start, parser.position().byte_index())),
            _ => {}
        }
    }
    let mut output = source.to_owned();
    for (start, end) in edits.into_iter().rev() {
        if output.get(start..end).is_some() {
            output.replace_range(start..end, "");
        }
    }
    output
}
