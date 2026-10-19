//! Local and global selector edits retain authored token spelling elsewhere.

use std::ops::Range;

use cssparser::Token;

use crate::error;
use crate::error::Result;
use crate::rename::Renamer;
use crate::token_tree::Tokens;

impl Renamer<'_> {
    pub(crate) fn selector(
        &mut self,
        tokens: &Tokens<'_>,
        range: Range<usize>,
        local: bool,
    ) -> Result<Option<String>> {
        let mut pending = vec![Selector::new(range, local, false)];
        while let Some(frame) = pending.last_mut() {
            if tokens.next_significant(&mut frame.range.clone()).is_none() {
                let own = if frame.atoms.len() == 1 {
                    frame.atoms.pop().flatten()
                } else {
                    None
                };
                let wrapper = frame.wrapper;
                pending.pop();
                if let Some(parent) = pending.last_mut() {
                    parent.atoms.push(if wrapper { own } else { None });
                } else {
                    return Ok(own);
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
                    if let Some(index) = tokens.next_significant(&mut lookahead)
                        && let Token::Ident(name) = &tokens.nodes[index].token
                    {
                        frame.range = lookahead;
                        if frame.local {
                            self.identifier(name, node.end, tokens.nodes[index].end, false);
                            self.defined.insert(name.to_string());
                            frame.atoms.push(Some(name.to_string()));
                        } else {
                            frame.atoms.push(None);
                        }
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
                    match tokens
                        .next_significant(&mut lookahead)
                        .map(|index| (index, &tokens.nodes[index]))
                    {
                        Some((index, function)) if matches!(&function.token, Token::Function(name) if name == "global" || name == "local") =>
                        {
                            let Token::Function(name) = &function.token else {
                                continue;
                            };
                            let child = tokens.children(index);
                            if tokens.next_significant(&mut child.clone()).is_none() {
                                return Err(self.error(
                                    node.start,
                                    &format!("CSS Modules :{name}() has no selector"),
                                    "add a selector inside it or remove it",
                                ));
                            }
                            frame.range = lookahead;
                            self.edits.push((node.start, function.end, String::new()));
                            if function.body_end < function.after {
                                self.edits
                                    .push((function.body_end, function.after, String::new()));
                            }
                            pending.push(Selector::new(child, name == "local", true));
                        }
                        Some((_, ident)) if matches!(&ident.token, Token::Ident(name) if name == "global" || name == "local") =>
                        {
                            let Token::Ident(name) = &ident.token else {
                                continue;
                            };
                            frame.local = name == "local";
                            frame.range = lookahead;
                            self.edits.push((node.start, ident.end, String::new()));
                        }
                        Some((_, function)) if matches!(&function.token, Token::Function(name) if name == "import") =>
                        {
                            return Err(self.icss(node.start, ":import"));
                        }
                        Some((_, ident)) if matches!(&ident.token, Token::Ident(name) if name == "export") =>
                        {
                            return Err(self.icss(node.start, ":export"));
                        }
                        _ => frame.atoms.push(None),
                    }
                }
                Token::Function(_) | Token::ParenthesisBlock => {
                    let local = frame.local;
                    pending.push(Selector::new(tokens.children(index), local, false));
                }
                _ => frame.atoms.push(None),
            }
        }
        Ok(None)
    }

    pub(crate) fn keyframes(&mut self, tokens: &Tokens<'_>, range: Range<usize>) -> Result<()> {
        let mut pending = vec![(range, true)];
        while let Some((range, local)) = pending.last_mut() {
            if tokens.next_significant(&mut range.clone()).is_none() {
                pending.pop();
                continue;
            }
            let Some(index) = tokens.next(range) else {
                continue;
            };
            let node = &tokens.nodes[index];
            match &node.token {
                Token::Ident(name) if *local => self.identifier(name, node.start, node.end, false),
                Token::QuotedString(name) if *local => {
                    let name = self.name(name);
                    let mut escaped = String::new();
                    let _ = cssparser::serialize_string(&name, &mut escaped);
                    self.edits.push((node.start, node.end, escaped));
                }
                Token::Colon => {
                    if let Some(index) = tokens.next_significant(range)
                        && let Token::Function(name) = &tokens.nodes[index].token
                        && (name == "local" || name == "global")
                    {
                        let function = &tokens.nodes[index];
                        self.edits.push((node.start, function.end, String::new()));
                        if function.body_end < function.after {
                            self.edits
                                .push((function.body_end, function.after, String::new()));
                        }
                        *local = false;
                        if name == "local" {
                            pending.push((tokens.children(index), true));
                        }
                    }
                }
                _ => {}
            }
        }
        Ok(())
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

struct Selector {
    range: Range<usize>,
    local: bool,
    default_local: bool,
    wrapper: bool,
    atoms: Vec<Option<String>>,
}

impl Selector {
    fn new(range: Range<usize>, local: bool, wrapper: bool) -> Self {
        Self {
            range,
            local,
            default_local: local,
            wrapper,
            atoms: Vec::new(),
        }
    }
}
