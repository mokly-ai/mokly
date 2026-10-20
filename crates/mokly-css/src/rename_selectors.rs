//! Local and global selector edits retain authored token spelling elsewhere.

use std::ops::Range;

use cssparser::Token;

use crate::error;
use crate::error::Result;
use crate::rename::Renamer;
use crate::token_tree::{Node, Tokens};

impl Renamer<'_> {
    /// Rename local classes and IDs; return the selector's single local class.
    pub(crate) fn selector(
        &mut self,
        tokens: &Tokens<'_>,
        range: Range<usize>,
        local: bool,
    ) -> Result<Option<String>> {
        let mut pending = vec![Selector::new(range, local, None)];
        while let Some(frame) = pending.last_mut() {
            if tokens.next_significant(&mut frame.range.clone()).is_none() {
                let own = if frame.atoms.len() == 1 {
                    frame.atoms.pop().flatten()
                } else {
                    None
                };
                let wrapper = frame.wrapper;
                pending.pop();
                let Some(parent) = pending.last_mut() else {
                    return Ok(own);
                };
                parent.atoms.push(wrapper.and(own));
                if let Some(wrapper) = wrapper {
                    self.remove_wrapper(wrapper);
                }
                continue;
            }
            let Some(index) = tokens.next(&mut frame.range) else {
                continue;
            };
            let node = &tokens.nodes[index];
            match &node.token {
                Token::WhiteSpace(_) | Token::Comment(_) => {}
                Token::Delim('.') => {
                    let mut lookahead = frame.range.clone();
                    let class = tokens
                        .next_significant(&mut lookahead)
                        .map(|index| &tokens.nodes[index]);
                    let Some((Token::Ident(name), end)) =
                        class.map(|class| (&class.token, class.end))
                    else {
                        frame.atoms.push(None);
                        continue;
                    };
                    frame.range = lookahead;
                    if frame.local {
                        self.identifier(name, node.end, end, false);
                        self.defined.insert(name.to_string());
                        frame.atoms.push(Some(name.to_string()));
                    } else {
                        frame.atoms.push(None);
                    }
                }
                Token::IDHash(name) => {
                    if frame.local {
                        self.identifier(name, node.start, node.end, true);
                    }
                    frame.atoms.push(None);
                }
                Token::Comma => {
                    frame.local = frame.default_local;
                    frame.atoms.push(None);
                }
                Token::Colon => {
                    let mut lookahead = frame.range.clone();
                    let Some(next) = tokens.next_significant(&mut lookahead) else {
                        frame.atoms.push(None);
                        continue;
                    };
                    let after = &tokens.nodes[next];
                    match &after.token {
                        Token::Function(name) if *name == "global" || *name == "local" => {
                            let child = tokens.children(next);
                            if tokens.next_significant(&mut child.clone()).is_none() {
                                return Err(self.empty_wrapper(
                                    node.start,
                                    name,
                                    Wrapped::Selector,
                                ));
                            }
                            frame.range = lookahead;
                            let wrapper = Wrapper::new(node, after);
                            pending.push(Selector::new(child, *name == "local", Some(wrapper)));
                        }
                        Token::Ident(name) if *name == "global" || *name == "local" => {
                            frame.local = *name == "local";
                            frame.range = lookahead;
                            self.edits.push((node.start, after.end, String::new()));
                        }
                        Token::Function(name) if *name == "import" => {
                            return Err(self.icss(node.start, ":import"));
                        }
                        Token::Ident(name) if *name == "export" => {
                            return Err(self.icss(node.start, ":export"));
                        }
                        _ => frame.atoms.push(None),
                    }
                }
                Token::Function(_) | Token::ParenthesisBlock => {
                    let local = frame.local;
                    pending.push(Selector::new(tokens.children(index), local, None));
                }
                _ => frame.atoms.push(None),
            }
        }
        Ok(None)
    }

    /// Rename local keyframes names, including names inside `:local()`. An
    /// empty wrapper fails, as in a selector.
    pub(crate) fn keyframes(&mut self, tokens: &Tokens<'_>, range: Range<usize>) -> Result<()> {
        let mut pending = vec![Keyframes {
            range,
            local: true,
            wrapper: None,
        }];
        while let Some(frame) = pending.last_mut() {
            if tokens.next_significant(&mut frame.range.clone()).is_none() {
                if let Some(wrapper) = frame.wrapper {
                    self.remove_wrapper(wrapper);
                }
                pending.pop();
                continue;
            }
            let Some(index) = tokens.next(&mut frame.range) else {
                continue;
            };
            let node = &tokens.nodes[index];
            match &node.token {
                Token::Ident(name) if frame.local => {
                    self.identifier(name, node.start, node.end, false);
                }
                Token::QuotedString(name) if frame.local => {
                    let name = self.name(name);
                    let mut escaped = String::new();
                    let _ = cssparser::serialize_string(&name, &mut escaped);
                    self.edits.push((node.start, node.end, escaped));
                }
                Token::Colon => {
                    let Some(next) = tokens.next_significant(&mut frame.range) else {
                        continue;
                    };
                    let function = &tokens.nodes[next];
                    let Token::Function(name) = &function.token else {
                        continue;
                    };
                    if *name != "local" && *name != "global" {
                        continue;
                    }
                    let child = tokens.children(next);
                    if tokens.next_significant(&mut child.clone()).is_none() {
                        return Err(self.empty_wrapper(node.start, name, Wrapped::KeyframesName));
                    }
                    frame.local = false;
                    let wrapper = Wrapper::new(node, function);
                    if *name == "local" {
                        pending.push(Keyframes {
                            range: child,
                            local: true,
                            wrapper: Some(wrapper),
                        });
                    } else {
                        self.remove_wrapper(wrapper);
                    }
                }
                _ => {}
            }
        }
        Ok(())
    }

    /// Remove a closed wrapper's opener and closer. A wrapper still open at
    /// the end of input stays as authored, so the syntax check reports it:
    /// removing its opener would move the text after it out of the wrapper.
    fn remove_wrapper(&mut self, wrapper: Wrapper) {
        if let Some(close) = wrapper.close {
            self.edits
                .push((wrapper.start, wrapper.function_end, String::new()));
            self.edits.push((close, close + 1, String::new()));
        }
    }

    /// The catalogued failure for a `:global()` or `:local()` with no content.
    /// The words name what the wrapper must hold where it appears.
    fn empty_wrapper(&self, offset: usize, name: &str, wrapped: Wrapped) -> error::CssError {
        match wrapped {
            Wrapped::Selector => self.error(
                offset,
                &format!("CSS Modules :{name}() has no selector"),
                "add a selector inside it or remove it",
            ),
            Wrapped::KeyframesName => self.error(
                offset,
                &format!("CSS Modules :{name}() has no keyframes name"),
                "add the name inside it or remove it",
            ),
        }
    }

    fn icss(&self, offset: usize, selector: &str) -> error::CssError {
        let (line, column) = self.position(offset);
        error::CssError::Transform {
            kind: error::TransformFailure::Modules,
            message: format!(
                "CSS Modules authored ICSS rule is unsupported in {}:{line}:{column}: {selector}; use local class exports or ordinary CSS",
                self.path
            ),
        }
    }
}

/// A `:local(` or `:global(` wrapper: its colon, the end of its function
/// token, and its closing parenthesis while it has one.
#[derive(Clone, Copy)]
struct Wrapper {
    start: usize,
    function_end: usize,
    close: Option<usize>,
}

impl Wrapper {
    fn new(colon: &Node<'_>, function: &Node<'_>) -> Self {
        Self {
            start: colon.start,
            function_end: function.end,
            close: (function.after > function.body_end).then_some(function.body_end),
        }
    }
}

/// One selector level: the authored prelude or a function argument.
struct Selector {
    range: Range<usize>,
    local: bool,
    default_local: bool,
    /// A wrapper's edits follow its content's edits, as authored order requires.
    wrapper: Option<Wrapper>,
    atoms: Vec<Option<String>>,
}

impl Selector {
    fn new(range: Range<usize>, local: bool, wrapper: Option<Wrapper>) -> Self {
        Self {
            range,
            local,
            default_local: local,
            wrapper,
            atoms: Vec::new(),
        }
    }
}

/// What a `:global()` or `:local()` wrapper holds where it appears.
#[derive(Clone, Copy)]
enum Wrapped {
    /// A selector, in a selector or an `@scope` prelude.
    Selector,
    /// The name in a keyframes prelude.
    KeyframesName,
}

/// One keyframes-name level: the prelude or a `:local()` argument.
struct Keyframes {
    range: Range<usize>,
    local: bool,
    wrapper: Option<Wrapper>,
}
