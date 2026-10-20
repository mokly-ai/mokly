//! Reject authored CSS Modules at-rules before rename-only scoping.

use cssparser::{Parser, ParserInput, Token};

use crate::error::{CssError, Result, TransformFailure};
use crate::rename::grouping;
use crate::token_sections::{self, Grammar};
use crate::token_tree::Tokens;

/// Reject `@value` at any rule level. Custom property values are not rules.
pub(crate) fn check(path: &str, source: &str) -> Result<()> {
    let tokens = Tokens::new(source);
    let mut pending = vec![(tokens.root(), Grammar::Rules)];
    while let Some((range, grammar)) = pending.last_mut() {
        let grammar = *grammar;
        let Some(section) = token_sections::next(&tokens, range, grammar) else {
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
        if let Some(body) = section.body.clone() {
            if section.custom_property(&tokens) {
                continue;
            }
            let grouping = matches!(first, Some(Token::AtKeyword(name)) if grouping(&name.to_ascii_lowercase()));
            pending.push((body, grammar.nested(grouping)));
        }
    }
    Ok(())
}
