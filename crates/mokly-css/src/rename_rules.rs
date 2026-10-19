//! Traverse module rules and declarations with explicit source-range frames.

use std::collections::BTreeSet;
use std::ops::Range;

use cssparser::Token;

use crate::error::Result;
use crate::rename::{Renamer, grouping};
use crate::token_sections::{self, Section};
use crate::token_tree::Tokens;

impl Renamer<'_> {
    /// Rename rule preludes and declarations; nested blocks use heap frames.
    pub(crate) fn rules(&mut self, tokens: &Tokens<'_>) -> Result<()> {
        let mut pending = vec![Frame {
            range: tokens.root(),
            body: None,
        }];
        while let Some(frame) = pending.last_mut() {
            let Some(section) = token_sections::next(tokens, &mut frame.range) else {
                pending.pop();
                continue;
            };
            let nested = match &mut frame.body {
                Some(body) => self.statement(tokens, body, section)?,
                None => self.rule(tokens, section)?,
            };
            pending.extend(nested);
        }
        Ok(())
    }

    /// One top-level or grouping rule: rename its prelude and open its block.
    fn rule(&mut self, tokens: &Tokens<'_>, section: Section) -> Result<Option<Frame>> {
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
        let body = (!at.as_deref().is_some_and(grouping)).then_some(Body {
            own,
            earlier,
            unread: None,
        });
        Ok(section.body.map(|range| Frame { range, body }))
    }

    /// One statement in a style rule's block: a nested rule or a declaration.
    fn statement(
        &mut self,
        tokens: &Tokens<'_>,
        body: &mut Body,
        section: Section,
    ) -> Result<Option<Frame>> {
        let start = body.unread.take().unwrap_or(section.start);
        let text = &tokens.source[start..section.end];
        let custom = text.trim_start().starts_with("--");
        if let Some(range) = section.body {
            if !custom {
                let earlier = self.defined.clone();
                let own = self.selector(tokens, section.prelude, true)?;
                return Ok(Some(Frame {
                    range,
                    body: Some(Body {
                        own,
                        earlier,
                        unread: None,
                    }),
                }));
            }
            body.unread = Some(tokens.offset(range.start));
        }
        self.declaration(
            text,
            start,
            section.end,
            section.semicolon,
            body.own.as_deref(),
            &body.earlier,
        )?;
        Ok(None)
    }
}

/// A block's remaining statements and the rule context that owns them.
struct Frame {
    range: Range<usize>,
    /// `None` for the stylesheet and grouping at-rule blocks.
    body: Option<Body>,
}

/// The owning style rule's local class and the classes defined before it.
struct Body {
    own: Option<String>,
    earlier: BTreeSet<String>,
    /// A custom property's unread `{}` value starts the next statement's text,
    /// as the authored-order scanner has always read it.
    unread: Option<usize>,
}
