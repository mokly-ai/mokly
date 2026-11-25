//! Walk MiniJinja expressions and recover the paths of free prop reads.

use std::ops::Range;

use minijinja::machinery::ast::{Call, CallArg, Expr};

use crate::analysis::{FreeName, Walker};

impl<'source> Walker<'source, '_> {
    pub(crate) fn expression(&mut self, expr: &Expr<'source>) {
        if let Some((root, keys, range)) = access(expr) {
            self.reference(root, keys, range);
            return;
        }
        match expr {
            Expr::Var(_) | Expr::Const(_) => {}
            Expr::Slice(slice) => {
                self.expression(&slice.expr);
                for part in [&slice.start, &slice.stop, &slice.step]
                    .into_iter()
                    .flatten()
                {
                    self.expression(part);
                }
            }
            Expr::UnaryOp(op) => self.expression(&op.expr),
            Expr::BinOp(op) => {
                self.expression(&op.left);
                self.expression(&op.right);
            }
            Expr::Compare(op) => {
                self.expression(&op.expr);
                for term in &op.ops {
                    self.expression(&term.expr);
                }
            }
            Expr::IfExpr(conditional) => {
                self.expression(&conditional.true_expr);
                self.expression(&conditional.test_expr);
                if let Some(expr) = &conditional.false_expr {
                    self.expression(expr);
                }
            }
            Expr::Filter(filter) => {
                if let Some(expr) = &filter.expr {
                    self.expression(expr);
                }
                self.arguments(&filter.args);
            }
            Expr::Test(test) => {
                self.expression(&test.expr);
                self.arguments(&test.args);
            }
            Expr::GetAttr(attr) => self.expression(&attr.expr),
            Expr::GetItem(item) => {
                self.expression(&item.expr);
                self.expression(&item.subscript_expr);
            }
            Expr::Call(call) => self.call(call),
            Expr::List(list) => {
                for item in &list.items {
                    self.expression(item);
                }
            }
            Expr::Tuple(tuple) => {
                for item in &tuple.items {
                    self.expression(item);
                }
            }
            Expr::Map(map) => {
                for (key, value) in map.keys.iter().zip(&map.values) {
                    self.expression(key);
                    self.expression(value);
                }
            }
        }
    }

    pub(crate) fn call(&mut self, call: &Call<'source>) {
        self.expression(&call.expr);
        self.arguments(&call.args);
    }

    fn arguments(&mut self, arguments: &[CallArg<'source>]) {
        for arg in arguments {
            let expr = match arg {
                CallArg::Pos(expr)
                | CallArg::Kwarg(_, expr)
                | CallArg::PosSplat(expr)
                | CallArg::KwargSplat(expr) => expr,
            };
            self.expression(expr);
        }
    }

    fn reference<'a>(&mut self, root: &'a str, mut keys: Vec<&'a str>, range: Range<usize>) {
        if self.scopes.iter().rev().any(|scope| scope.contains(root)) {
            return;
        }
        if self.private == Some(root) {
            if keys.first() != Some(&"props") {
                return;
            }
            keys.remove(0);
        } else {
            keys.insert(0, root);
        }
        self.free_names.push(FreeName {
            path: keys.into_iter().map(str::to_owned).collect(),
            source: self.map.range(range),
        });
    }
}

/// A dynamic index keeps its own free reads and ends the static path.
fn access<'a, 'source>(
    expression: &'a Expr<'source>,
) -> Option<(&'source str, Vec<&'a str>, Range<usize>)> {
    let end = expression.span().end_offset as usize;
    let mut keys = Vec::new();
    let mut expr = expression;
    loop {
        match expr {
            Expr::Var(var) => {
                keys.reverse();
                return Some((var.id, keys, var.span().start_offset as usize..end));
            }
            Expr::GetAttr(attr) => {
                keys.push(attr.name);
                expr = &attr.expr;
            }
            Expr::GetItem(item) => {
                let Expr::Const(key) = &item.subscript_expr else {
                    return None;
                };
                keys.push(key.value.as_str()?);
                expr = &item.expr;
            }
            _ => return None,
        }
    }
}
