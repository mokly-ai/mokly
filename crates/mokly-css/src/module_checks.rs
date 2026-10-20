//! Reject authored CSS Modules at-rules before rename-only scoping.

use cssparser::{Parser, ParserInput};

use crate::error::{CssError, Result, TransformFailure};
use crate::token_sections::{self, Grammar};
use crate::token_tree::Tokens;

/// Reject `@value` at any rule level. Custom property values are not rules.
pub(crate) fn check(path: &str, source: &str) -> Result<()> {
    let tokens = Tokens::new(source);
    let mut pending = vec![(tokens.root(), Grammar::Rules)];
    while let Some((range, grammar)) = pending.last_mut() {
        let Some(section) = token_sections::next(&tokens, range, *grammar) else {
            pending.pop();
            continue;
        };
        if section.at_rule(&tokens).as_deref() == Some("value") {
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
        if !section.custom_property(&tokens)
            && let Some(block) = section.block
        {
            pending.push((block.range, block.grammar));
        }
    }
    Ok(())
}
