//! Conservative selector broadening without changing authored global or shadow checks.

use std::result;

use cssparser_next::{ParseError, Parser, ToCss, Token};

/// A broadened selector and the closed keep-list outcome.
pub(crate) struct Scope {
    pub(crate) text: String,
    pub(crate) unresolved: bool,
    pub(crate) dynamic: bool,
    pub(crate) relational: bool,
}

pub(crate) fn broaden(source: &str) -> Scope {
    walk(&mut Parser::new(source))
}

fn walk(parser: &mut Parser<'_>) -> Scope {
    let mut scope = Scope {
        text: String::new(),
        unresolved: false,
        dynamic: false,
        relational: false,
    };
    let mut colons = 0;
    let mut previous = None;
    while let Ok(token) = parser.next_including_whitespace_and_comments().cloned() {
        if matches!(token, Token::Colon) {
            colons += 1;
            continue;
        }
        if matches!(token, Token::Comment(_)) {
            continue;
        }
        match token {
            Token::SquareBracketBlock => {
                prefix(&mut scope.text, colons);
                let start = parser.position();
                let raw: result::Result<_, ParseError<()>> = parser.parse_nested_block(|nested| {
                    consume(nested);
                    Ok(nested.slice_from(start).to_owned())
                });
                scope.text.push('[');
                if let Ok(raw) = raw {
                    scope.text.push_str(&raw);
                }
                scope.text.push(']');
                previous = Some(']');
            }
            Token::Function(name) => {
                let name = name.to_ascii_lowercase();
                let nested: result::Result<_, ParseError<()>> =
                    parser.parse_nested_block(|nested| Ok(walk(nested)));
                let nested = nested.unwrap_or(Scope {
                    text: String::new(),
                    unresolved: true,
                    dynamic: false,
                    relational: false,
                });
                scope.unresolved |= nested.unresolved
                    || matches!(name.as_str(), "host" | "host-context" | "part" | "slotted");
                scope.dynamic |= nested.dynamic;
                scope.relational |= nested.relational || (colons == 1 && name == "has");
                if ((name == "not" || name.starts_with("nth-")) && nested.dynamic)
                    || (colons == 2 && pseudo_element(&name))
                {
                    scope.dynamic = true;
                    universal_if_needed(&mut scope.text);
                } else {
                    prefix(&mut scope.text, colons);
                    scope.text.push_str(&name);
                    scope.text.push('(');
                    scope.text.push_str(&nested.text);
                    scope.text.push(')');
                }
                previous = Some(')');
            }
            Token::Ident(name) => {
                let name_lower = name.to_ascii_lowercase();
                if (colons == 0
                    && previous != Some('.')
                    && matches!(name_lower.as_str(), "html" | "body"))
                    || (colons > 0 && matches!(name_lower.as_str(), "root" | "host"))
                {
                    scope.unresolved = true;
                }
                if colons > 0 && (state(&name_lower) || pseudo_element(&name_lower)) {
                    scope.dynamic = true;
                    universal_if_needed(&mut scope.text);
                } else {
                    prefix(&mut scope.text, colons);
                    let _ = Token::Ident(name).to_css(&mut scope.text);
                }
                previous = Some('i');
            }
            token => {
                if matches!(token, Token::Delim('*')) {
                    scope.unresolved = true;
                }
                prefix(&mut scope.text, colons);
                let _ = token.to_css(&mut scope.text);
                previous = match token {
                    Token::Delim(character) => Some(character),
                    Token::WhiteSpace(_) => Some(' '),
                    _ => None,
                };
            }
        }
        colons = 0;
    }
    prefix(&mut scope.text, colons);
    scope
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

fn consume(parser: &mut Parser<'_>) {
    while let Ok(token) = parser.next_including_whitespace_and_comments().cloned() {
        if matches!(
            token,
            Token::Function(_)
                | Token::SquareBracketBlock
                | Token::ParenthesisBlock
                | Token::CurlyBracketBlock
        ) {
            let _: result::Result<_, ParseError<()>> = parser.parse_nested_block(|nested| {
                consume(nested);
                Ok(())
            });
        }
    }
}

fn state(name: &str) -> bool {
    matches!(
        name,
        "hover"
            | "active"
            | "focus"
            | "focus-visible"
            | "focus-within"
            | "visited"
            | "link"
            | "any-link"
            | "checked"
            | "indeterminate"
            | "enabled"
            | "disabled"
            | "default"
            | "valid"
            | "invalid"
            | "user-valid"
            | "user-invalid"
            | "in-range"
            | "out-of-range"
            | "required"
            | "optional"
            | "read-only"
            | "read-write"
            | "placeholder-shown"
            | "autofill"
            | "target"
            | "target-within"
            | "fullscreen"
            | "modal"
            | "open"
            | "popover-open"
            | "picture-in-picture"
            | "playing"
            | "paused"
            | "seeking"
            | "buffering"
            | "stalled"
            | "muted"
            | "volume-locked"
            | "defined"
    )
}

fn pseudo_element(name: &str) -> bool {
    matches!(
        name,
        "before"
            | "after"
            | "first-line"
            | "first-letter"
            | "selection"
            | "marker"
            | "placeholder"
            | "backdrop"
            | "file-selector-button"
            | "spelling-error"
            | "grammar-error"
            | "cue"
            | "cue-region"
            | "target-text"
            | "details-content"
    )
}
