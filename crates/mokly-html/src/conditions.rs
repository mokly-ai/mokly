//! Conditions and escaped substitution shared by screens and components.

use std::mem;

use mokly_model::data::DataValue;
use mokly_model::prop_schema::{JsonType, Types};

use crate::context::Context;
use crate::diagnostic_code::Code;
use crate::error::{Result, invalid};
use crate::props::{schema_at, substitute, value_at};
use crate::tree::Element;

pub(crate) fn visible(element: &mut Element, context: &Context, viewport: &str) -> Result<bool> {
    if let Some(value) = element.take("mokly-viewport") {
        if !matches!(value.as_str(), "mobile" | "desktop") {
            return Err(invalid(
                Code::HtmlAttribute,
                "mokly-viewport must be mobile or desktop",
            ));
        }
        if value != viewport {
            return Ok(false);
        }
    }
    if let Some(value) = element.take("mokly-if") {
        let name = value.strip_prefix('$').ok_or_else(|| {
            invalid(
                Code::HtmlProps,
                "mokly-if must name a declared boolean prop",
            )
        })?;
        let schema = schema_at(&context.schema, name)
            .ok_or_else(|| invalid(Code::HtmlProps, format!("undeclared prop reference {name}")))?;
        if !matches!(schema.types, Some(Types::Single(JsonType::Boolean))) {
            return Err(invalid(
                Code::HtmlProps,
                format!("mokly-if {value:?} must name a declared boolean prop"),
            ));
        }
        if !matches!(
            value_at(&context.props, name),
            Some(DataValue::Boolean(true))
        ) {
            return Ok(false);
        }
    }
    Ok(true)
}

pub(crate) fn attributes(element: &mut Element, context: &Context) -> Result<()> {
    let mut attributes = Vec::new();
    for mut attribute in mem::take(&mut element.attributes) {
        if let Some(value) = attribute_value(&attribute.value, context)? {
            attribute.value = value;
            attributes.push(attribute);
        }
    }
    element.attributes = attributes;
    Ok(())
}

pub(crate) fn attribute_value(value: &str, context: &Context) -> Result<Option<String>> {
    if let Some(name) = value
        .strip_prefix("{{")
        .and_then(|value| value.strip_suffix("}}"))
        && !name.contains("{{")
    {
        let name = name.trim_ascii();
        if schema_at(&context.schema, name).is_none() {
            return Err(invalid(
                Code::HtmlProps,
                format!("undeclared prop reference {name}"),
            ));
        }
        match value_at(&context.props, name) {
            None | Some(DataValue::Boolean(false)) => return Ok(None),
            Some(DataValue::Boolean(true)) => return Ok(Some(String::new())),
            _ => {}
        }
    }
    Ok(Some(substitute(value, &context.schema, &context.props)?))
}

pub(crate) fn reserved(value: Option<String>, context: &Context) -> Result<Option<String>> {
    match value {
        Some(value) => attribute_value(&value, context),
        None => Ok(None),
    }
}
