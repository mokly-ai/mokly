//! Parse package JavaScript requests and validate their complete local inventory.

use std::collections::BTreeSet;

use mokly_graph::urls::decode_path;
use mokly_model::output::artifact::File;
use mokly_model::routes;
use oxc_allocator::Allocator;
use oxc_ast::ast::{Expression, ImportExpression};
use oxc_ast_visit::{Visit, walk};
use oxc_parser::Parser;
use oxc_span::SourceType;

use crate::error::{Error, Result};

/// Every decoded static, re-export, and literal dynamic request names an owned file.
pub fn validate(files: &[File]) -> Result<()> {
    let paths: BTreeSet<_> = files.iter().map(|file| file.path.as_str()).collect();
    for file in files
        .iter()
        .filter(|file| file.path.starts_with("mokly-viewer/") && file.path.ends_with(".js"))
    {
        let text = match std::str::from_utf8(&file.bytes) {
            Ok(text) => text,
            Err(_) => {
                return Err(Error::ModuleEncoding {
                    path: file.path.clone(),
                });
            }
        };
        let allocator = Allocator::default();
        let parsed = Parser::new(&allocator, text, SourceType::mjs()).parse();
        if let Some(diagnostic) = parsed.diagnostics.first() {
            let offset = diagnostic
                .labels
                .first()
                .map_or(0, |label| label.offset() as usize)
                .min(text.len());
            let prefix = text.get(..offset).unwrap_or("");
            let line = prefix.bytes().filter(|byte| *byte == b'\n').count() + 1;
            let column = prefix.rsplit('\n').next().unwrap_or("").chars().count() + 1;
            return Err(Error::ModuleSyntax {
                path: file.path.clone(),
                line,
                column,
            });
        }
        let mut requests = Requests(
            parsed
                .module_record
                .requested_modules
                .keys()
                .map(|value| value.to_string())
                .collect(),
        );
        requests.visit_program(&parsed.program);
        for request in requests.0 {
            let path = request.split(['?', '#']).next().unwrap_or(&request);
            let target = if path.starts_with("./")
                || path.starts_with("../")
                || (path.starts_with('/') && !path.starts_with("//"))
            {
                decode_path(path).ok().and_then(|path| {
                    if let Some(relative) = path.strip_prefix('/') {
                        if relative
                            .split('/')
                            .any(|part| matches!(part, "" | "." | ".."))
                        {
                            None
                        } else {
                            Some(relative.into())
                        }
                    } else {
                        routes::resolve(&file.path, &path)
                    }
                })
            } else {
                None
            };
            if !target
                .as_ref()
                .is_some_and(|target| paths.contains(target.as_str()))
            {
                return Err(Error::ModuleReference {
                    path: file.path.clone(),
                    request,
                });
            }
        }
    }
    Ok(())
}

#[derive(Default)]
struct Requests(Vec<String>);
impl<'a> Visit<'a> for Requests {
    fn visit_import_expression(&mut self, expression: &ImportExpression<'a>) {
        match &expression.source {
            Expression::StringLiteral(value) => self.0.push(value.value.to_string()),
            Expression::TemplateLiteral(value) if value.expressions.is_empty() => {
                if let Some(cooked) = value
                    .quasis
                    .first()
                    .and_then(|part| part.value.cooked.as_ref())
                {
                    self.0.push(cooked.to_string());
                }
            }
            _ => {}
        }
        walk::walk_import_expression(self, expression);
    }
}
