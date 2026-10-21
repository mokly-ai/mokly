//! Traverse module rules and declarations with explicit source-range frames.

use std::collections::BTreeSet;
use std::ops::Range;

use crate::error::Result;
use crate::rename::Renamer;
use crate::token_sections::{self, Grammar, Section, Statement};
use crate::token_tree::Tokens;

impl Renamer<'_> {
    /// Rename rule preludes and declarations; nested blocks use heap frames.
    /// The section reader says which statements are declarations and which
    /// are text that stays as authored. Every other statement renames its
    /// prelude and opens its block, with the grammar that the section reader
    /// gives that block.
    pub(crate) fn rules(&mut self, tokens: &Tokens<'_>) -> Result<()> {
        let mut pending = vec![Frame {
            range: tokens.root(),
            grammar: Grammar::Rules,
            body: Body::default(),
        }];
        while let Some(frame) = pending.last_mut() {
            let Some(section) = token_sections::next(tokens, &mut frame.range, frame.grammar)
            else {
                pending.pop();
                continue;
            };
            match section.statement {
                Statement::Declaration(_) => {
                    self.declaration(
                        section.text(tokens),
                        section.start,
                        section.end,
                        section.semicolon,
                        frame.body.own.as_deref(),
                        &frame.body.earlier,
                    )?;
                    continue;
                }
                Statement::Text(_) => continue,
                Statement::AtRule(_) | Statement::Rule => {}
            }
            let earlier = self.defined.clone();
            let own = self.prelude(tokens, &section)?;
            if let Some(block) = section.block {
                pending.push(Frame {
                    range: block.range,
                    grammar: block.grammar,
                    body: Body { own, earlier },
                });
            }
        }
        Ok(())
    }

    /// Rename the names in a statement's prelude, at any nesting level:
    /// keyframes names, `@scope` selectors, and style rule selectors. Other
    /// at-rule preludes stay as authored. Returns the style rule's single
    /// local class.
    fn prelude(&mut self, tokens: &Tokens<'_>, section: &Section) -> Result<Option<String>> {
        let prelude = section.prelude.clone();
        match &section.statement {
            Statement::AtRule(name) if name.ends_with("keyframes") => {
                self.keyframes(tokens, prelude)?;
                Ok(None)
            }
            Statement::AtRule(name) if name == "scope" => {
                self.selector(tokens, prelude, true)?;
                Ok(None)
            }
            Statement::AtRule(_) | Statement::Declaration(_) | Statement::Text(_) => Ok(None),
            Statement::Rule => self.selector(tokens, prelude, true),
        }
    }
}

/// A block's remaining statements, their grammar, and the rule that owns them.
struct Frame {
    range: Range<usize>,
    grammar: Grammar,
    /// The owning rule context; declarations in this block compose against it.
    body: Body,
}

/// The owning style rule's local class and the classes defined before it.
#[derive(Default)]
struct Body {
    own: Option<String>,
    earlier: BTreeSet<String>,
}
