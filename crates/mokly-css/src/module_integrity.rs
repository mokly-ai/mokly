//! Independent token comparison admits only module names, scope wrappers, and compositions.

use std::ops::Range;

use cssparser::Token;
use mokly_model::material::digest;

use crate::error::{CssError, Result, TransformFailure};
use crate::token_sections::{self, Grammar, Statement};
use crate::token_tree::{Tokens, opening};

pub(crate) fn check(path: &str, source: &str, output: &str) -> Result<()> {
    let prefix = format!("mokly_{}_", &digest(path.as_bytes())[..12]);
    if fingerprint(source, &prefix) == fingerprint(output, &prefix) {
        return Ok(());
    }
    Err(CssError::Transform {
        kind: TransformFailure::Modules,
        message: format!(
            "CSS Modules scoping would change more than local names in {path}:1:1; move this CSS to a plain stylesheet"
        ),
    })
}

/// The tokens in authored order, without local-name prefixes, scope wrappers,
/// or compositions, so only module renames compare equal. Whitespace and
/// comments carry no CSS meaning and are left out: removing a composition
/// keeps the comments before it.
fn fingerprint(source: &str, prefix: &str) -> Vec<String> {
    let tokens = Tokens::new(source);
    let mut output = Vec::new();
    let mut pending = vec![Work::Block(tokens.root(), Grammar::Rules)];
    while let Some(work) = pending.pop() {
        match work {
            Work::Emit(text) => output.push(text.into()),
            Work::Block(mut range, grammar) => {
                let Some(section) = token_sections::next(&tokens, &mut range, grammar) else {
                    continue;
                };
                pending.push(Work::Block(range, grammar));
                if let Some(block) = section.block {
                    let names = renamed_prelude(&section.statement);
                    pending.push(Work::Emit("}"));
                    pending.push(Work::Block(block.range, block.grammar));
                    pending.push(Work::Emit("{"));
                    pending.push(Work::Tokens(section.prelude, names));
                } else {
                    let names = match &section.statement {
                        Statement::Declaration(property) if property == "composes" => continue,
                        Statement::Declaration(property) => matches!(
                            property.as_str(),
                            "animation"
                                | "animation-name"
                                | "-webkit-animation"
                                | "-webkit-animation-name"
                        ),
                        statement => renamed_prelude(statement),
                    };
                    if section.semicolon {
                        pending.push(Work::Emit(";"));
                    }
                    pending.push(Work::Tokens(section.prelude, names));
                }
            }
            Work::Tokens(mut range, names) => {
                if tokens.next_significant(&mut range.clone()).is_none() {
                    continue;
                }
                let Some(index) = tokens.next(&mut range) else {
                    continue;
                };
                let node = &tokens.nodes[index];
                let mut child = None;
                match &node.token {
                    Token::WhiteSpace(_) | Token::Comment(_) => {}
                    Token::Ident(value) | Token::IDHash(value) | Token::QuotedString(value) => {
                        let kind = match node.token {
                            Token::Ident(_) => "ident",
                            Token::IDHash(_) => "id",
                            _ => "string",
                        };
                        let value = if names {
                            value.strip_prefix(prefix).unwrap_or(value)
                        } else {
                            value
                        };
                        output.push(format!("{kind}:{value}"));
                    }
                    Token::Colon if names => {
                        let mut lookahead = range.clone();
                        match tokens
                            .next_significant(&mut lookahead)
                            .map(|index| (index, &tokens.nodes[index].token))
                        {
                            Some((_, Token::Ident(name)))
                                if matches!(name.as_ref(), "local" | "global") =>
                            {
                                range = lookahead;
                            }
                            Some((index, Token::Function(name)))
                                if matches!(name.as_ref(), "local" | "global") =>
                            {
                                range = lookahead;
                                child = Some(tokens.children(index));
                            }
                            _ => output.push(":".into()),
                        }
                    }
                    token => {
                        output.push(format!("{token:?}"));
                        if opening(token).is_some() {
                            pending.push(Work::Tokens(range, names));
                            pending.push(Work::Emit("end"));
                            pending.push(Work::Tokens(tokens.children(index), names));
                            continue;
                        }
                    }
                }
                pending.push(Work::Tokens(range, names));
                if let Some(child) = child {
                    pending.push(Work::Tokens(child, names));
                }
            }
        }
    }
    output
}

/// True where the renamer renames a prelude: a rule's selector, a keyframes
/// name, or an `@scope` prelude, with or without a block.
fn renamed_prelude(statement: &Statement) -> bool {
    match statement {
        Statement::Rule => true,
        Statement::AtRule(name) => name.ends_with("keyframes") || name == "scope",
        Statement::Declaration(_) | Statement::Text(_) => false,
    }
}

/// Pending fingerprint work, popped in authored order.
enum Work {
    /// Statements of a block and their grammar. Declarations are fingerprinted
    /// as such, so composition and animation names compare by local name.
    Block(Range<usize>, Grammar),
    /// Tokens of a range; true where local names lose the scope prefix.
    Tokens(Range<usize>, bool),
    /// A fixed marker, such as a block boundary.
    Emit(&'static str),
}
