//! Reject authored CSS Modules at-rules before rename-only scoping.

use cssparser::{Parser, ParserInput, Token};

use crate::error::{CssError, Result, TransformFailure};
use crate::token_sections;
use crate::token_tree::Tokens;

/// Reject `@value` at any rule level; custom property blocks are not rules.
pub(crate) fn check(path: &str, source: &str) -> Result<()> {
    let tokens = Tokens::new(source);
    let mut pending = vec![tokens.root()];
    while let Some(range) = pending.last_mut() {
        let Some(section) = token_sections::next(&tokens, range) else {
            pending.pop();
            continue;
        };
        let first = section
            .first(&tokens)
            .map(|index| &tokens.nodes[index].token);
        if matches!(first, Some(Token::AtKeyword(name)) if name.eq_ignore_ascii_case("value")) {
            let mut input = ParserInput::new(&source[..section.lead(&tokens)]);
            let mut parser = Parser::new(&mut input);
            while parser.next_including_whitespace_and_comments().is_ok() {}
            let location = parser.current_source_location();
            return Err(CssError::Transform {
                kind: TransformFailure::Modules,
                message: format!(
                    "CSS Modules @value is unsupported in {path}:{}:{}; use a CSS custom property or JavaScript constant",
                    location.line + 1,
                    location.column
                ),
            });
        }
        if let Some(body) = section.body {
            if matches!(first, Some(Token::Ident(name)) if name.starts_with("--")) {
                continue;
            }
            pending.push(body);
        }
    }
    Ok(())
}
