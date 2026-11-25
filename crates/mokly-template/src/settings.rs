//! Configure MiniJinja's template language and render limits.

use minijinja::syntax::SyntaxConfig;
use minijinja::value::{Rest, ValueKind};
use minijinja::{AutoEscape, Environment, Error, State, UndefinedBehavior, Value, filters};

use crate::context::is_absent;
use crate::format::format;

const RENDER_FUEL: u64 = 250_000;
const RECURSION_LIMIT: usize = 128;

pub(crate) fn environment() -> Environment<'static> {
    let mut environment = Environment::new();
    environment.set_undefined_behavior(UndefinedBehavior::SemiStrict);
    environment.set_auto_escape_callback(|_| AutoEscape::Html);
    environment.set_formatter(format);
    environment.set_fuel(Some(RENDER_FUEL));
    environment.set_recursion_limit(RECURSION_LIMIT);
    environment.set_debug(true);
    environment.set_syntax(
        SyntaxConfig::builder()
            .keep_trailing_newline(true)
            .build()
            .unwrap_or_default(),
    );
    environment.remove_filter("safe");
    environment.remove_test("safe");
    environment.add_test("defined", |value: &Value| !undefined(value));
    environment.add_test("undefined", undefined);
    environment.add_filter("default", default);
    environment.add_filter("d", default);
    environment.add_filter("plural", plural);
    environment
}

fn undefined(value: &Value) -> bool {
    value.is_undefined() || is_absent(value)
}

fn default(state: &State, value: &Value, args: Rest<Value>) -> Result<Value, Error> {
    if is_absent(value) {
        filters::default(state, &Value::UNDEFINED, args)
    } else {
        filters::default(state, value, args)
    }
}

fn plural(value: &Value, one: &str, other: &str) -> Value {
    Value::from(
        if value.kind() == ValueKind::Number && *value == Value::from(1) {
            one
        } else {
            other
        },
    )
}
