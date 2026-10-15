//! Pure prop-reference checking for the shared HTML template language.

use std::collections::BTreeSet;

use mokly_model::prop_schema::{JsonType, PropSchema, Types};

pub(crate) fn reference<'a>(schema: &'a PropSchema, path: &str) -> Option<&'a PropSchema> {
    let mut current = schema;
    for part in path.split('.') {
        current = current.properties.as_ref()?.get(part)?;
    }
    Some(current)
}

pub(crate) fn boolean(schema: &PropSchema) -> bool {
    matches!(schema.types, Some(Types::Single(JsonType::Boolean)))
}

pub(crate) fn scalar(schema: &PropSchema) -> bool {
    match &schema.types {
        Some(Types::Single(kind)) => !matches!(kind, JsonType::Object | JsonType::Array),
        Some(Types::Union(kinds)) => kinds
            .iter()
            .all(|kind| !matches!(kind, JsonType::Object | JsonType::Array)),
        None => schema
            .any_of
            .as_ref()
            .is_none_or(|members| members.iter().all(scalar)),
    }
}

pub(crate) fn substitutions(text: &str) -> Vec<(usize, &str)> {
    let mut found = Vec::new();
    let mut offset = 0;
    while let Some(start) = text[offset..].find("{{") {
        let start = offset + start;
        let Some(end) = text[start + 2..].find("}}") else {
            break;
        };
        let end = start + 2 + end;
        found.push((start, &text[start + 2..end]));
        offset = end + 2;
    }
    found
}

pub(crate) fn use_reference(
    schema: &PropSchema,
    name: &str,
    scalar_only: bool,
    used: &mut BTreeSet<String>,
) -> Result<(), String> {
    let Some(prop) = reference(schema, name) else {
        return Err(format!("undeclared prop reference {name}"));
    };
    if scalar_only && !scalar(prop) {
        return Err(format!("prop reference {name} must name a scalar value"));
    }
    used.insert(name.split('.').next().unwrap_or(name).into());
    Ok(())
}
