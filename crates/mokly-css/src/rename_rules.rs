//! Traverse module rules and declarations with explicit source-range frames.

use std::collections::BTreeSet;
use std::ops::Range;

use cssparser::Token;

use crate::error::Result;
use crate::rename::{Renamer, grouping};
use crate::token_sections;
use crate::token_tree::Tokens;

impl Renamer<'_> {
    pub(crate) fn rules(&mut self, tokens: &Tokens<'_>) -> Result<()> {
        let mut pending = vec![Frame {
            range: tokens.root(),
            declaration: None,
        }];
        while let Some(frame) = pending.last_mut() {
            let Some(section) = token_sections::next(tokens, &mut frame.range) else {
                pending.pop();
                continue;
            };
            if let Some((own, earlier)) = &frame.declaration {
                if let Some(body) = section.body.clone()
                    && !section.text(tokens).trim_start().starts_with("--")
                {
                    let earlier = self.defined.clone();
                    let own = self.selector(tokens, section.prelude, true)?;
                    pending.push(Frame {
                        range: body,
                        declaration: Some((own, earlier)),
                    });
                } else {
                    self.declaration(
                        section.text(tokens),
                        section.start,
                        section.end,
                        section.semicolon,
                        own.as_deref(),
                        earlier,
                    )?;
                }
                continue;
            }
            let earlier = self.defined.clone();
            let at = match section
                .first(tokens)
                .map(|index| &tokens.nodes[index].token)
            {
                Some(Token::AtKeyword(name)) => Some(name.to_ascii_lowercase()),
                _ => None,
            };
            if at.as_deref() == Some("value") {
                return Err(self.error(
                    section.start,
                    "CSS Modules @value is unsupported",
                    "use a CSS custom property or JavaScript constant",
                ));
            }
            let mut own = None;
            if at
                .as_deref()
                .is_some_and(|name| name.ends_with("keyframes"))
            {
                self.keyframes(tokens, section.prelude)?;
            } else if at.as_deref() == Some("scope") {
                self.selector(tokens, section.prelude, true)?;
            } else if at.is_none() {
                own = self.selector(tokens, section.prelude, true)?;
            }
            if let Some(body) = section.body {
                pending.push(Frame {
                    range: body,
                    declaration: if at.as_deref().is_some_and(grouping) {
                        None
                    } else {
                        Some((own, earlier))
                    },
                });
            }
        }
        Ok(())
    }
}

struct Frame {
    range: Range<usize>,
    declaration: Option<(Option<String>, BTreeSet<String>)>,
}
