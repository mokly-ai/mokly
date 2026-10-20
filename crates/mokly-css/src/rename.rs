//! Rename-only CSS Modules edits preserve every unrelated authored byte.

use std::collections::{BTreeMap, BTreeSet};

use cssparser::{Parser, ParserInput, Token};
use mokly_model::material::digest;

use crate::error::{CssError, Result, TransformFailure};
use crate::rename_output::Scoped;
use crate::syntax;
use crate::token_tree::Tokens;

pub(crate) struct Renamer<'a> {
    pub(crate) source: &'a str,
    pub(crate) path: &'a str,
    pub(crate) prefix: String,
    pub(crate) edits: Vec<(usize, usize, String)>,
    pub(crate) exports: BTreeMap<String, String>,
    pub(crate) defined: BTreeSet<String>,
}

pub(crate) fn scope<'a>(path: &'a str, source: &'a str) -> Result<Scoped<'a>> {
    let hash = digest(path.as_bytes());
    let mut renamer = Renamer {
        source,
        path,
        prefix: format!("mokly_{}_", &hash[..12]),
        edits: Vec::new(),
        exports: BTreeMap::new(),
        defined: BTreeSet::new(),
    };
    renamer.rules(&Tokens::new(source))?;
    renamer.edits.sort_by_key(|edit| edit.0);
    Ok(Scoped {
        source,
        css: syntax::replace(path, source, renamer.edits.clone())?,
        exports: renamer.exports,
        edits: renamer.edits,
    })
}

impl Renamer<'_> {
    pub(crate) fn name(&mut self, local: &str) -> String {
        let generated = format!("{}{local}", self.prefix);
        self.exports
            .entry(local.into())
            .or_insert_with(|| generated.clone());
        generated
    }

    pub(crate) fn identifier(&mut self, local: &str, start: usize, end: usize, id: bool) {
        let generated = self.name(local);
        let mut replacement = String::new();
        if id {
            replacement.push('#');
        }
        let _ = cssparser::serialize_identifier(&generated, &mut replacement);
        self.edits.push((start, end, replacement));
    }

    pub(crate) fn declaration(
        &mut self,
        source: &str,
        offset: usize,
        end: usize,
        semicolon: bool,
        own: Option<&str>,
        earlier: &BTreeSet<String>,
    ) -> Result<()> {
        let mut input = ParserInput::new(source);
        let mut parser = Parser::new(&mut input);
        parser.skip_whitespace();
        let property_offset = offset + parser.position().byte_index();
        let Ok(property) = parser.expect_ident_cloned() else {
            return Ok(());
        };
        if parser.expect_colon().is_err() {
            return Ok(());
        }
        let property = property.to_ascii_lowercase();
        if matches!(
            property.as_str(),
            "animation" | "animation-name" | "-webkit-animation" | "-webkit-animation-name"
        ) {
            self.animation(&mut parser, offset, property.ends_with("animation-name"));
        } else if property == "composes" {
            let Some(own) = own else {
                return Err(self.error(
                    property_offset,
                    "CSS Modules composition requires a single local class",
                    "compose from a local class selector",
                ));
            };
            let mut names = Vec::new();
            let mut from = false;
            let mut global = false;
            while let Ok(token) = parser.next().cloned() {
                match token {
                    Token::Ident(name) if name == "from" => from = true,
                    Token::Ident(name) if from && name == "global" => global = true,
                    Token::QuotedString(specifier) if from => {
                        return Err(CssError::Transform {
                            kind: TransformFailure::Modules,
                            message: format!(
                                "CSS Modules cross-file composes is unsupported in {}: {specifier}; compose within this file or use a global name",
                                self.path
                            ),
                        });
                    }
                    Token::Ident(name) if !from => names.push(name.to_string()),
                    _ => {}
                }
            }
            let mut compiled = Vec::new();
            for name in names {
                if global {
                    compiled.push(name);
                } else if earlier.contains(&name) {
                    compiled.push(self.exports[&name].clone());
                } else {
                    let (line, column) = self.position(property_offset);
                    return Err(CssError::Transform {
                        kind: TransformFailure::Modules,
                        message: format!(
                            "CSS Modules composition refers to a class not yet defined in {}:{line}:{column}: {name}; define the composed class before this rule",
                            self.path
                        ),
                    });
                }
            }
            let value = self.exports.entry(own.into()).or_default();
            for name in compiled {
                value.push(' ');
                value.push_str(&name);
            }
            self.edits
                .push((property_offset, end + usize::from(semicolon), String::new()));
        }
        Ok(())
    }

    pub(crate) fn position(&self, offset: usize) -> (usize, usize) {
        let prefix = &self.source[..offset.min(self.source.len())];
        (
            prefix.bytes().filter(|c| *c == b'\n').count() + 1,
            prefix
                .rsplit('\n')
                .next()
                .map_or(1, |line| line.chars().count() + 1),
        )
    }

    pub(crate) fn error(&self, offset: usize, reason: &str, action: &str) -> CssError {
        let (line, column) = self.position(offset);
        CssError::Transform {
            kind: TransformFailure::Modules,
            message: format!("{reason} in {}:{line}:{column}; {action}", self.path),
        }
    }
}
