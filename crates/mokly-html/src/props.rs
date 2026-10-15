//! Shared scalar coercion and template substitution for every HTML body.

use std::iter;

use mokly_model::data::{DataValue, Props, number_text};
use mokly_model::diagnostic::{AuthoringKind, Context};
use mokly_model::prop_schema::{JsonType, Primitive, PropSchema, Types};
use mokly_model::validation::{PropValidator, accepts};

use crate::error::{HtmlError, Result, invalid, json};
use crate::serialize;

/// Look up a declared dotted property in a schema.
pub fn schema_at<'a>(schema: &'a PropSchema, path: &str) -> Option<&'a PropSchema> {
    path.split('.').try_fold(schema, |current, part| {
        current.properties.as_ref()?.get(part)
    })
}

/// Read a dotted value; absence is distinct from JSON null.
pub fn value_at<'a>(props: &'a Props, path: &str) -> Option<&'a DataValue> {
    let mut parts = path.split('.');
    let mut value = props.get(parts.next()?)?;
    for part in parts {
        let DataValue::Object(object) = value else {
            return None;
        };
        value = object.get(part)?;
    }
    Some(value)
}

/// Coerce one literal component attribute in schema member order.
pub fn coerce(schema: &PropSchema, text: &str) -> Option<DataValue> {
    if let Some(choices) = &schema.enumeration {
        return choice(choices.iter(), text);
    }
    if let Some(value) = &schema.constant {
        return choice(iter::once(value), text);
    }
    if let Some(choices) = &schema.one_of {
        return choice(choices.iter().map(|member| &member.value), text);
    }
    if let Some(members) = &schema.any_of {
        return members
            .iter()
            .find_map(|member| coerce(member, text).filter(|value| accepts(schema, value)));
    }
    match &schema.types {
        Some(Types::Single(kind)) => scalar(kind, text).filter(|value| accepts(schema, value)),
        Some(Types::Union(kinds)) => kinds
            .iter()
            .find_map(|kind| scalar(kind, text).filter(|value| accepts(schema, value))),
        None => None,
    }
}

fn scalar(kind: &JsonType, text: &str) -> Option<DataValue> {
    match kind {
        JsonType::String => Some(DataValue::String(text.into())),
        JsonType::Boolean => match text {
            "" | "true" => Some(DataValue::Boolean(true)),
            "false" => Some(DataValue::Boolean(false)),
            _ => None,
        },
        JsonType::Null if text == "null" => Some(DataValue::Null),
        JsonType::Number | JsonType::Integer => {
            let value = serde_json::from_str::<serde_json::Number>(text).ok()?;
            if matches!(kind, JsonType::Integer)
                && !value.as_f64().is_some_and(|number| number.fract() == 0.0)
            {
                return None;
            }
            Some(DataValue::Number(value))
        }
        _ => None,
    }
}

fn choice<'a>(choices: impl Iterator<Item = &'a Primitive>, text: &str) -> Option<DataValue> {
    let mut found = choices.filter_map(|primitive| {
        let value = match primitive {
            Primitive::Null => DataValue::Null,
            Primitive::String(value) => DataValue::String(value.clone()),
            Primitive::Number(value) => DataValue::Number(value.clone()),
            Primitive::Boolean(value) => DataValue::Boolean(*value),
        };
        (display(&value) == text).then_some(value)
    });
    let value = found.next()?;
    found.next().is_none().then_some(value)
}

/// Render a scalar without HTML escaping; the tree serializer escapes once.
pub fn display(value: &DataValue) -> String {
    match value {
        DataValue::Null => "null".into(),
        DataValue::Boolean(value) => value.to_string(),
        DataValue::String(value) => value.clone(),
        DataValue::Number(value) => number_text(value),
        _ => String::new(),
    }
}

/// Substitute scalar references with optional ASCII whitespace inside the braces.
pub fn substitute(text: &str, schema: &PropSchema, props: &Props) -> Result<String> {
    substitute_inner(text, schema, props, false)
}

pub(crate) fn substitute_raw(text: &str, schema: &PropSchema, props: &Props) -> Result<String> {
    substitute_inner(text, schema, props, true)
}

fn substitute_inner(
    text: &str,
    schema: &PropSchema,
    props: &Props,
    escaped: bool,
) -> Result<String> {
    let mut result = String::new();
    let mut rest = text;
    while let Some(start) = rest.find("{{") {
        let Some(end) = rest[start + 2..].find("}}") else {
            break;
        };
        let end = start + 2 + end;
        let name = rest[start + 2..end].trim_ascii();
        let Some(prop) = schema_at(schema, name) else {
            return Err(invalid(
                "html-props",
                format!("undeclared prop reference {name}"),
            ));
        };
        if !is_scalar(prop) {
            return Err(invalid(
                "html-props",
                format!("prop reference {name} must name a scalar value"),
            ));
        }
        result.push_str(&rest[..start]);
        if let Some(value) = value_at(props, name) {
            let value = display(value);
            result.push_str(&if escaped {
                serialize::escape(&value)
            } else {
                value
            });
        }
        rest = &rest[end + 2..];
    }
    result.push_str(rest);
    Ok(result)
}

fn is_scalar(schema: &PropSchema) -> bool {
    match &schema.types {
        Some(Types::Single(kind)) => !matches!(kind, JsonType::Object | JsonType::Array),
        Some(Types::Union(kinds)) => kinds
            .iter()
            .all(|kind| !matches!(kind, JsonType::Object | JsonType::Array)),
        None => schema
            .any_of
            .as_ref()
            .is_none_or(|members| members.iter().all(is_scalar)),
    }
}

/// Validate complete invocation props with the shared bounded validator.
pub fn validate(schema: &PropSchema, props: &Props, entry: &str) -> Result<()> {
    validate_for(schema, props, entry, AuthoringKind::Html)
}

pub(crate) fn validate_for(
    schema: &PropSchema,
    props: &Props,
    entry: &str,
    kind: AuthoringKind,
) -> Result<()> {
    let context = Context {
        entry: entry.into(),
        variant: None,
        kind,
    };
    let validator = match PropValidator::compile(&json(schema)?, &context) {
        Ok(value) => value,
        Err(source) => return Err(HtmlError::Props { source }),
    };
    match validator.validate(&json(props)?, &context) {
        Ok(()) => Ok(()),
        Err(source) => Err(HtmlError::Props { source }),
    }
}

/// Map an HTML attribute name into its camelCase prop key.
pub fn camel_case(name: &str) -> String {
    let mut uppercase = false;
    let mut result = String::new();
    for character in name.chars() {
        if character == '-' {
            uppercase = true;
        } else if uppercase {
            result.extend(character.to_uppercase());
            uppercase = false;
        } else {
            result.push(character);
        }
    }
    result
}
