//! Traverse module rules and declarations with explicit source-range frames.

use std::collections::BTreeSet;
use std::ops::Range;

use cssparser::Token;

use crate::error::Result;
use crate::rename::{Renamer, grouping};
use crate::token_sections::{self, Grammar, Section};
use crate::token_tree::Tokens;

impl Renamer<'_> {
    /// Rename rule preludes and declarations; nested blocks use heap frames.
    pub(crate) fn rules(&mut self, tokens: &Tokens<'_>) -> Result<()> {
        let mut pending = vec![Frame {
            range: tokens.root(),
            body: None,
        }];
        while let Some(frame) = pending.last_mut() {
            let grammar = frame.grammar();
            let Some(section) = token_sections::next(tokens, &mut frame.range, grammar) else {
                pending.pop();
                continue;
            };
            let nested = match &frame.body {
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
        let (at, own) = self.prelude(tokens, &section)?;
        let body = (!at.as_deref().is_some_and(grouping)).then_some(Body { own, earlier });
        Ok(section.body.map(|range| Frame { range, body }))
    }

    /// One statement in a declaration block: a nested rule or a declaration.
    /// A custom property's `{}` values stay inside its declaration.
    fn statement(
        &mut self,
        tokens: &Tokens<'_>,
        body: &Body,
        section: Section,
    ) -> Result<Option<Frame>> {
        if let Some(range) = section.body.clone() {
            let earlier = self.defined.clone();
            let (_, own) = self.prelude(tokens, &section)?;
            return Ok(Some(Frame {
                range,
                body: Some(Body { own, earlier }),
            }));
        }
        self.declaration(
            section.text(tokens),
            section.start,
            section.end,
            section.semicolon,
            body.own.as_deref(),
            &body.earlier,
        )?;
        Ok(None)
    }

    /// Rename the names in a block-opening prelude, at any nesting level:
    /// keyframes names, `@scope` selectors, and style rule selectors. Other
    /// at-rule preludes stay as authored. Returns the lowercase at-rule name and
    /// the style rule's single local class.
    fn prelude(
        &mut self,
        tokens: &Tokens<'_>,
        section: &Section,
    ) -> Result<(Option<String>, Option<String>)> {
        let at = match section
            .first(tokens)
            .map(|index| &tokens.nodes[index].token)
        {
            Some(Token::AtKeyword(name)) => Some(name.to_ascii_lowercase()),
            _ => None,
        };
        let prelude = section.prelude.clone();
        let mut own = None;
        if at
            .as_deref()
            .is_some_and(|name| name.ends_with("keyframes"))
        {
            self.keyframes(tokens, prelude)?;
        } else if at.as_deref() == Some("scope") {
            self.selector(tokens, prelude, true)?;
        } else if at.is_none() {
            own = self.selector(tokens, prelude, true)?;
        }
        Ok((at, own))
    }
}

/// A block's remaining statements and the rule context that owns them.
struct Frame {
    range: Range<usize>,
    /// `None` for the stylesheet and grouping at-rule blocks.
    body: Option<Body>,
}

impl Frame {
    /// Rule-context blocks hold declarations; the others hold rules.
    fn grammar(&self) -> Grammar {
        if self.body.is_some() {
            Grammar::Declarations
        } else {
            Grammar::Rules
        }
    }
}

/// The owning style rule's local class and the classes defined before it.
struct Body {
    own: Option<String>,
    earlier: BTreeSet<String>,
}
