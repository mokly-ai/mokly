//! Conservative selector broadening with heap frames and the existing parser allowance.

use std::ops::Range;

use cssparser_next::{ToCss, Token};

use crate::selector_states::{pseudo_element, state};
use crate::selector_tokens::{NESTED_BLOCK_LIMIT, tokenize};

/// A broadened selector and the closed keep-list outcome.
#[derive(Default)]
pub(crate) struct Scope {
    pub(crate) text: String,
    pub(crate) unresolved: bool,
    pub(crate) dynamic: bool,
}

pub(crate) fn broaden(source: &str) -> Scope {
    let tokens = tokenize(source);
    let mut pending = vec![Frame::new(tokens.root(), None)];
    while !pending.is_empty() {
        let depth = pending.len() - 1;
        let frame = &mut pending[depth];
        let Some(index) = tokens.next(&mut frame.range) else {
            let Some(mut frame) = pending.pop() else {
                break;
            };
            prefix(&mut frame.scope.text, frame.colons);
            if let Some((name, colons)) = frame.call
                && let Some(parent) = pending.last_mut()
            {
                function(&mut parent.scope, &name, colons, frame.scope);
            } else {
                return frame.scope;
            }
            continue;
        };
        let token = &tokens.nodes[index].token;
        if matches!(token, Token::Colon) {
            frame.colons += 1;
            continue;
        }
        if matches!(token, Token::Comment(_)) {
            continue;
        }
        match token {
            Token::SquareBracketBlock => {
                prefix(&mut frame.scope.text, frame.colons);
                frame.scope.text.push('[');
                if depth < NESTED_BLOCK_LIMIT {
                    frame.scope.text.push_str(tokens.body(index));
                } else {
                    frame.scope.unresolved = true;
                }
                frame.scope.text.push(']');
                frame.previous = Some(']');
            }
            Token::Function(name) => {
                let name = name.to_ascii_lowercase();
                let colons = frame.colons;
                frame.colons = 0;
                frame.previous = Some(')');
                if depth < NESTED_BLOCK_LIMIT {
                    pending.push(Frame::new(tokens.children(index), Some((name, colons))));
                } else {
                    function(
                        &mut frame.scope,
                        &name,
                        colons,
                        Scope {
                            unresolved: true,
                            ..Default::default()
                        },
                    );
                }
                continue;
            }
            Token::Ident(name) => {
                let name_lower = name.to_ascii_lowercase();
                if (frame.colons == 0
                    && frame.previous != Some('.')
                    && matches!(name_lower.as_str(), "html" | "body"))
                    || (frame.colons > 0 && matches!(name_lower.as_str(), "root" | "host"))
                {
                    frame.scope.unresolved = true;
                }
                if frame.colons > 0 && (state(&name_lower) || pseudo_element(&name_lower)) {
                    frame.scope.dynamic = true;
                    universal_if_needed(&mut frame.scope.text);
                } else {
                    prefix(&mut frame.scope.text, frame.colons);
                    let _ = token.to_css(&mut frame.scope.text);
                }
                frame.previous = Some('i');
            }
            token => {
                if matches!(token, Token::Delim('*')) {
                    frame.scope.unresolved = true;
                }
                prefix(&mut frame.scope.text, frame.colons);
                let _ = token.to_css(&mut frame.scope.text);
                frame.previous = match token {
                    Token::Delim(c) => Some(*c),
                    Token::WhiteSpace(_) => Some(' '),
                    _ => None,
                };
            }
        }
        frame.colons = 0;
    }
    Scope::default()
}

struct Frame {
    range: Range<usize>,
    scope: Scope,
    colons: usize,
    previous: Option<char>,
    call: Option<(String, usize)>,
}

impl Frame {
    fn new(range: Range<usize>, call: Option<(String, usize)>) -> Self {
        Self {
            range,
            scope: Scope::default(),
            colons: 0,
            previous: None,
            call,
        }
    }
}

fn function(scope: &mut Scope, name: &str, colons: usize, nested: Scope) {
    scope.unresolved |=
        nested.unresolved || matches!(name, "host" | "host-context" | "part" | "slotted");
    scope.dynamic |= nested.dynamic;
    if ((name == "not" || name.starts_with("nth-")) && nested.dynamic)
        || (colons == 2 && pseudo_element(name))
    {
        scope.dynamic = true;
        universal_if_needed(&mut scope.text);
    } else {
        prefix(&mut scope.text, colons);
        scope.text.push_str(name);
        scope.text.push('(');
        scope.text.push_str(&nested.text);
        scope.text.push(')');
    }
}

fn prefix(text: &mut String, count: usize) {
    for _ in 0..count {
        text.push(':');
    }
}

fn universal_if_needed(text: &mut String) {
    if text.is_empty() || text.ends_with([' ', '>', '+', '~', ',', '(']) {
        text.push('*');
    }
}
