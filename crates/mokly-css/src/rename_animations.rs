//! Rename animation names without changing shorthand keywords or other tokens.

use cssparser::{Parser, Token};

use crate::rename::Renamer;

#[derive(Default)]
struct Shorthand {
    timing: bool,
    direction: bool,
    fill: bool,
    play: bool,
    iterations: bool,
}

impl Renamer<'_> {
    pub(crate) fn animation(
        &mut self,
        parser: &mut Parser<'_, '_>,
        offset: usize,
        names_only: bool,
    ) {
        let mut shorthand = Shorthand::default();
        while !parser.is_exhausted() {
            parser.skip_whitespace();
            let start = offset + parser.position().byte_index();
            let Ok(token) = parser.next_including_whitespace_and_comments().cloned() else {
                break;
            };
            let end = offset + parser.position().byte_index();
            match token {
                Token::Delim('!') => break,
                Token::Comma => shorthand = Shorthand::default(),
                Token::Number { .. } => shorthand.iterations = true,
                Token::Ident(name) => {
                    let keyword = name.to_ascii_lowercase();
                    let reserved = (!names_only && keyword == "auto")
                        || matches!(
                            keyword.as_str(),
                            "none" | "initial" | "inherit" | "unset" | "revert" | "revert-layer"
                        );
                    let consumed = if names_only {
                        false
                    } else {
                        shorthand.keyword(&keyword)
                    };
                    if !reserved && !consumed {
                        self.identifier(&name, start, end, false);
                    }
                }
                Token::QuotedString(name) => {
                    let generated = self.name(&name);
                    let mut text = String::new();
                    let _ = cssparser::serialize_string(&generated, &mut text);
                    self.edits.push((start, end, text));
                }
                Token::Function(name)
                    if matches!(name.as_ref(), "cubic-bezier" | "steps" | "linear") =>
                {
                    shorthand.timing = true;
                }
                _ => {}
            }
        }
    }
}

impl Shorthand {
    fn keyword(&mut self, name: &str) -> bool {
        let field = if matches!(
            name,
            "linear" | "ease" | "ease-in" | "ease-out" | "ease-in-out" | "step-start" | "step-end"
        ) {
            &mut self.timing
        } else if matches!(
            name,
            "normal" | "reverse" | "alternate" | "alternate-reverse"
        ) {
            &mut self.direction
        } else if matches!(name, "none" | "forwards" | "backwards" | "both") {
            &mut self.fill
        } else if matches!(name, "running" | "paused") {
            &mut self.play
        } else if name == "infinite" {
            &mut self.iterations
        } else {
            return false;
        };
        if *field {
            false
        } else {
            *field = true;
            true
        }
    }
}
