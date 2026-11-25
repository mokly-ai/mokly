//! Free references in a compiled body.

use std::collections::BTreeSet;
use std::ops::Range;

use minijinja::machinery::ast::{Expr, Macro, Stmt};
use mokly_model::prop_schema::PropSchema;

use crate::source_map::SourceMap;

/// A free reference at one site in the authored body.
#[derive(Debug, PartialEq, Eq)]
pub struct FreeName {
    /// The root name followed by its statically known property keys.
    pub path: Vec<String>,
    /// Byte range in the authored body.
    pub source: Range<usize>,
}

impl FreeName {
    /// Look up each segment in the preceding schema's declared properties.
    pub fn schema_at<'a>(&self, schema: &'a PropSchema) -> Option<&'a PropSchema> {
        let (root, rest) = self.path.split_first()?;
        let root = schema.properties.as_ref()?.get(root)?;
        rest.iter()
            .try_fold(root, |schema, key| schema.properties.as_ref()?.get(key))
    }
}

/// Evidence for catalogue discovery checks.
#[derive(Debug, Default)]
pub struct Analysis {
    /// Authored source with template tags and comments blanked in place.
    pub blanked_source: String,
    /// One record for each free reference, in authored source order.
    pub free_names: Vec<FreeName>,
    /// Declared top-level props used by the template expressions.
    pub read_props: BTreeSet<String>,
}

pub(crate) fn collect(
    ast: &Stmt<'_>,
    blanked_source: String,
    schema: &PropSchema,
    map: &SourceMap,
    private: Option<&str>,
) -> Analysis {
    let mut walker = Walker {
        free_names: Vec::new(),
        scopes: vec![BTreeSet::new()],
        map,
        private,
    };
    walker.statement(ast);
    let mut free_names = walker.free_names;
    free_names.sort_by_key(|name| name.source.start);
    let read_props = free_names
        .iter()
        .filter_map(|name| name.path.first())
        .filter(|name| {
            schema
                .properties
                .as_ref()
                .is_some_and(|props| props.contains_key(*name))
        })
        .cloned()
        .collect();
    Analysis {
        blanked_source,
        free_names,
        read_props,
    }
}

pub(crate) struct Walker<'source, 'map> {
    pub(crate) free_names: Vec<FreeName>,
    pub(crate) scopes: Vec<BTreeSet<&'source str>>,
    pub(crate) map: &'map SourceMap,
    pub(crate) private: Option<&'map str>,
}

impl<'source> Walker<'source, '_> {
    fn statement(&mut self, statement: &Stmt<'source>) {
        match statement {
            Stmt::Template(stmt) => self.statements(&stmt.children),
            Stmt::EmitExpr(stmt) => self.expression(&stmt.expr),
            Stmt::ForLoop(stmt) => {
                self.expression(&stmt.iter);
                self.scoped(|walker| {
                    walker.assignment(&stmt.target);
                    if let Some(filter) = &stmt.filter_expr {
                        walker.expression(filter);
                    }
                    walker.bind("loop");
                    walker.statements(&stmt.body);
                });
                self.scoped(|walker| walker.statements(&stmt.else_body));
            }
            Stmt::IfCond(stmt) => {
                self.expression(&stmt.expr);
                let yes = self.scoped(|walker| walker.statements(&stmt.true_body));
                let no = self.scoped(|walker| walker.statements(&stmt.false_body));
                for name in yes.intersection(&no) {
                    self.bind(name);
                }
            }
            Stmt::WithBlock(stmt) => {
                self.scoped(|walker| {
                    for (target, value) in &stmt.assignments {
                        walker.expression(value);
                        walker.assignment(target);
                    }
                    walker.statements(&stmt.body);
                });
            }
            Stmt::Set(stmt) => {
                self.expression(&stmt.expr);
                self.assignment(&stmt.target);
            }
            Stmt::SetBlock(stmt) => {
                self.statements(&stmt.body);
                if let Some(filter) = &stmt.filter {
                    self.expression(filter);
                }
                self.assignment(&stmt.target);
            }
            Stmt::AutoEscape(stmt) => {
                self.expression(&stmt.enabled);
                self.statements(&stmt.body);
            }
            Stmt::FilterBlock(stmt) => {
                self.statements(&stmt.body);
                self.expression(&stmt.filter);
            }
            Stmt::Macro(stmt) => {
                self.bind(stmt.name);
                self.macro_body(stmt);
            }
            Stmt::CallBlock(stmt) => {
                self.call(&stmt.call);
                self.macro_body(&stmt.macro_decl);
            }
            Stmt::Do(stmt) => self.call(&stmt.call),
            Stmt::EmitRaw(_) | Stmt::Continue(_) | Stmt::Break(_) => {}
        }
    }

    fn statements(&mut self, statements: &[Stmt<'source>]) {
        for statement in statements {
            self.statement(statement);
        }
    }

    fn macro_body(&mut self, stmt: &Macro<'source>) {
        self.scoped(|walker| {
            walker.bind("caller");
            let mut defaults = stmt.defaults.iter().rev();
            for arg in stmt.args.iter().rev() {
                if let Some(value) = defaults.next() {
                    walker.expression(value);
                }
                walker.assignment(arg);
            }
            walker.statements(&stmt.body);
        });
    }

    fn assignment(&mut self, target: &Expr<'source>) {
        match target {
            Expr::Var(var) => self.bind(var.id),
            Expr::List(list) => {
                for item in &list.items {
                    self.assignment(item);
                }
            }
            Expr::Tuple(tuple) => {
                for item in &tuple.items {
                    self.assignment(item);
                }
            }
            Expr::GetAttr(attr) => self.expression(&attr.expr),
            _ => {}
        }
    }

    fn scoped(&mut self, visit: impl FnOnce(&mut Self)) -> BTreeSet<&'source str> {
        self.scopes.push(BTreeSet::new());
        visit(self);
        self.scopes.pop().unwrap_or_default()
    }

    fn bind(&mut self, name: &'source str) {
        if let Some(scope) = self.scopes.last_mut() {
            scope.insert(name);
        }
    }
}
