//! Depth-first rule collection keeps traversal frames on the heap.

use std::vec::IntoIter;

use crate::rule_collection::selectors;
use crate::rule_syntax::{Part, normalize, opaque, parts};
use crate::rules::{AtRule, Condition, ConditionKind, Rule};
use crate::syntax;

/// Append every rule of `source` with its conditions, in depth-first order.
pub(crate) fn walk(source: &str, output: &mut Vec<Rule>) -> Result<(), String> {
    let mut pending = vec![Frame::new(source, Vec::new(), None, None)?];
    while let Some(frame) = pending.last_mut() {
        let Some(section) = frame.sections.next() else {
            flush(
                &mut frame.declarations,
                &frame.conditions,
                frame.parent.as_deref(),
                frame.after_nested,
                output,
            );
            if frame.empty == Some(output.len()) {
                push(
                    frame.parent.clone().unwrap_or_default(),
                    String::new(),
                    &frame.conditions,
                    None,
                    output,
                );
            }
            pending.pop();
            continue;
        };
        let prelude = section.prelude.trim();
        let normalized = normalize(prelude);
        if normalized.is_empty() {
            continue;
        }
        if section.body.is_none() && !normalized.starts_with('@') && frame.parent.is_some() {
            frame.declarations.push(normalized);
            continue;
        }
        flush(
            &mut frame.declarations,
            &frame.conditions,
            frame.parent.as_deref(),
            frame.after_nested,
            output,
        );
        frame.after_nested = frame.parent.is_some();
        if let Some(at) = normalized.strip_prefix('@') {
            let name_end = at
                .find(|c: char| c.is_ascii_whitespace() || matches!(c, '(' | '"' | '\''))
                .unwrap_or(at.len());
            let name = at[..name_end].to_ascii_lowercase();
            let rest = at[name_end..].trim().to_owned();
            if let Some(body) = section.body
                && matches!(name.as_str(), "media" | "container" | "supports" | "layer")
                && !normalize(body).is_empty()
            {
                let mut nested = frame.conditions.clone();
                let parent = if let Some(parent) = &frame.parent {
                    nested.push(Condition {
                        kind: ConditionKind::NestingParent,
                        prelude: parent.join(", "),
                    });
                    Some(vec!["&".into()])
                } else {
                    None
                };
                nested.push(Condition {
                    kind: match name.as_str() {
                        "media" => ConditionKind::Media,
                        "container" => ConditionKind::Container,
                        "supports" => ConditionKind::Supports,
                        _ => ConditionKind::Layer,
                    },
                    prelude: rest,
                });
                pending.push(Frame::new(body, nested, parent, None)?);
            } else {
                push(
                    Vec::new(),
                    section.body.map_or_else(String::new, opaque),
                    &frame.conditions,
                    Some(AtRule {
                        name,
                        prelude: rest,
                    }),
                    output,
                );
            }
        } else if let Some(body) = section.body {
            let selectors = selectors(prelude, frame.parent.is_some())?;
            let mut nested = frame.conditions.clone();
            if let Some(parent) = &frame.parent {
                nested.push(Condition {
                    kind: ConditionKind::NestingParent,
                    prelude: parent.join(", "),
                });
            }
            pending.push(Frame::new(
                body,
                nested,
                Some(selectors),
                Some(output.len()),
            )?);
        } else {
            return Err("expected a rule block".into());
        }
    }
    Ok(())
}

/// One block: its remaining statements and the context its rules inherit.
struct Frame<'a> {
    sections: IntoIter<Part<'a>>,
    conditions: Vec<Condition>,
    /// The enclosing style rule's selectors; `None` outside style rules.
    parent: Option<Vec<String>>,
    /// Declarations waiting for the next nested rule or the block end.
    declarations: Vec<String>,
    after_nested: bool,
    /// For a style rule, the output length when its block opened. The rule is
    /// recorded on its own only when its block adds no rule.
    empty: Option<usize>,
}

impl<'a> Frame<'a> {
    fn new(
        source: &'a str,
        conditions: Vec<Condition>,
        parent: Option<Vec<String>>,
        empty: Option<usize>,
    ) -> Result<Self, String> {
        Ok(Self {
            sections: parts(source)?.into_iter(),
            conditions,
            parent,
            declarations: Vec::new(),
            after_nested: false,
            empty,
        })
    }
}

fn flush(
    declarations: &mut Vec<String>,
    conditions: &[Condition],
    parent: Option<&[String]>,
    after_nested: bool,
    output: &mut Vec<Rule>,
) {
    if declarations.is_empty() {
        return;
    }
    let mut conditions = conditions.to_vec();
    let selectors = if after_nested {
        conditions.push(Condition {
            kind: ConditionKind::NestingParent,
            prelude: parent.unwrap_or_default().join(", "),
        });
        vec!["&".into()]
    } else {
        parent.unwrap_or_default().to_vec()
    };
    let declarations = std::mem::take(declarations).join(";");
    push(selectors, declarations, &conditions, None, output);
}

fn push(
    selectors: Vec<String>,
    declarations: String,
    conditions: &[Condition],
    at_rule: Option<AtRule>,
    output: &mut Vec<Rule>,
) {
    let custom = parts(&declarations)
        .unwrap_or_default()
        .iter()
        .filter_map(|part| {
            let declaration = normalize(part.prelude);
            declaration.starts_with("--").then_some(declaration)
        })
        .collect();
    let mut references: Vec<_> = syntax::references(&declarations)
        .into_iter()
        .map(|reference| reference.value)
        .collect();
    for condition in conditions {
        references.extend(
            syntax::references(&condition.prelude)
                .into_iter()
                .map(|reference| reference.value),
        );
    }
    if let Some(at_rule) = &at_rule {
        references.extend(
            syntax::references(&format!("@{} {};", at_rule.name, at_rule.prelude))
                .into_iter()
                .map(|reference| reference.value),
        );
    }
    output.push(Rule {
        ordinal: output.len(),
        selectors,
        declarations,
        conditions: conditions.to_vec(),
        at_rule,
        custom,
        references,
    });
}
