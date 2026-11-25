//! HTML formatters for expressions and whole attributes.

use minijinja::value::{StringInput, ValueKind};
use minijinja::{Error, ErrorKind, Output, State, Value, escape_formatter, filters};
use mokly_model::data::number_text;
use serde_json::Number;

use crate::context::is_absent;

pub(crate) fn format(out: &mut Output, state: &mut State, value: &Value) -> Result<(), Error> {
    if let Some(value) = scalar(value)? {
        escape_formatter(out, state, &value)?;
    }
    Ok(())
}

/// The name comes from the authored attribute. The value is always escaped as quoted data.
pub(crate) fn attribute(state: &mut State, name: &str, value: &Value) -> Result<Value, Error> {
    if value.is_undefined() {
        // MiniJinja permits the empty result of an inline if with no else.
        StringInput::new(state, value)?;
        return Ok(Value::from(""));
    }
    let text = if value.kind() == ValueKind::Bool {
        if !value.is_true() {
            return Ok(Value::from(""));
        }
        Value::from("")
    } else {
        let Some(value) = scalar(value)? else {
            return Ok(Value::from(""));
        };
        let value = if value.is_safe() {
            Value::from(value.as_str().unwrap_or_default())
        } else {
            value
        };
        if let Some(text) = value.as_str() {
            // Escaping can allocate before the VM can charge for the result.
            state.consume_fuel(text.len().div_ceil(64) as u64)?;
        }
        filters::escape(state, &value)?
    };
    Ok(Value::from_safe_string(format!("{name}=\"{text}\"")))
}

fn scalar(value: &Value) -> Result<Option<Value>, Error> {
    if value.is_none() || is_absent(value) {
        return Ok(None);
    }
    let value = match value.kind() {
        ValueKind::Bool => Value::from(if value.is_true() { "true" } else { "false" }),
        ValueKind::Number => {
            let number = Number::from_f64(f64::try_from(value.clone())?).ok_or_else(|| {
                Error::new(
                    ErrorKind::NonPrimitive,
                    "only finite numbers can be printed",
                )
            })?;
            Value::from(number_text(&number))
        }
        ValueKind::Seq | ValueKind::Map | ValueKind::Iterable => {
            return Err(Error::new(
                ErrorKind::NonPrimitive,
                "an expression that prints a value must produce a scalar",
            ));
        }
        _ => value.clone(),
    };
    Ok(Some(value))
}
