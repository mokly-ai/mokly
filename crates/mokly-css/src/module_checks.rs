//! Reject authored CSS Modules at-rules before rename-only scoping.

use crate::error::{CssError, Result, TransformFailure};
use crate::source_position::line_column;
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
            let (line, column) = line_column(source, section.lead(&tokens));
            return Err(CssError::Transform {
                kind: TransformFailure::Modules,
                message: format!(
                    "CSS Modules @value is unsupported in {path}:{line}:{column}; use a CSS custom property or JavaScript constant"
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
