//! Declared controls use the core prop validator and never infer a prop type.

use std::collections::{BTreeMap, BTreeSet};

use mokly_model::catalogue::SourceLocation;
use mokly_model::controls::{ComponentControl, ControlInput};
use mokly_model::data::{DataValue, Props, round_unsafe_integer};
use mokly_model::diagnostic::{AuthoringKind, Context};
use mokly_model::prop_schema::{JsonType, Primitive, PropSchema, Types};
use mokly_model::validation::{PropValidator, accepts};
use serde_json::Number;

use crate::diagnostic::{Code, Issue};

/// Validate normalized authored limits before filling defaults from the schema.
pub(crate) fn prepare(
    schema: &PropSchema,
    controls: &BTreeMap<String, ComponentControl>,
    props: &Props,
    source: &SourceLocation,
) -> Result<BTreeMap<String, ComponentControl>, Issue> {
    let mut normalized = controls.clone();
    normalized.values_mut().for_each(normalize);
    validate(schema, &normalized, props, source)?;
    Ok(effective(schema, &normalized))
}

/// Store effective numeric bounds so every read-model consumer sees the same limits.
pub(crate) fn effective(
    schema: &PropSchema,
    controls: &BTreeMap<String, ComponentControl>,
) -> BTreeMap<String, ComponentControl> {
    let mut effective = controls.clone();
    for (name, control) in &mut effective {
        let Some(property) = schema
            .properties
            .as_ref()
            .and_then(|properties| properties.get(name))
        else {
            continue;
        };
        if let ControlInput::Number {
            minimum,
            maximum,
            step,
        } = &mut control.input
        {
            *minimum = minimum.clone().or_else(|| property.minimum.clone());
            *maximum = maximum.clone().or_else(|| property.maximum.clone());
            *step = step
                .clone()
                .or_else(|| property.multiple_of.clone())
                .or_else(|| {
                    matches!(property.types, Some(Types::Single(JsonType::Integer)))
                        .then(|| Number::from(1))
                });
        }
    }
    effective
}

/// Keep every stored control number in the same representation as its schema and props.
pub(crate) fn normalize(control: &mut ComponentControl) {
    match &mut control.input {
        ControlInput::Text { max_length } => {
            if let Some(number) = max_length {
                *number = round_unsafe_integer(number.clone());
            }
        }
        ControlInput::Number {
            minimum,
            maximum,
            step,
        } => {
            for number in [minimum, maximum, step].into_iter().flatten() {
                *number = round_unsafe_integer(number.clone());
            }
        }
        ControlInput::Select { options } => {
            for option in options {
                if let Primitive::Number(number) = &mut option.value {
                    *number = round_unsafe_integer(number.clone());
                }
            }
        }
        ControlInput::Boolean => {}
    }
}

pub(crate) fn validate(
    schema: &PropSchema,
    controls: &BTreeMap<String, ComponentControl>,
    props: &Props,
    source: &SourceLocation,
) -> Result<(), Issue> {
    for (key, control) in controls {
        let failure = || {
            Issue::new(
                Code::ComponentControls,
                format!("control {key} is incompatible with its prop schema"),
            )
            .at(source.clone())
        };
        let property = schema
            .properties
            .as_ref()
            .and_then(|properties| properties.get(key))
            .ok_or_else(failure)?;
        let mut narrowed = property.clone();
        match &control.input {
            ControlInput::Text { max_length } => {
                if !matches!(property.types, Some(Types::Single(JsonType::String)))
                    || max_length.as_ref().is_some_and(|value| {
                        value
                            .as_f64()
                            .is_none_or(|number| number < 0.0 || number.fract() != 0.0)
                            || greater(value, property.max_length.as_ref())
                    })
                {
                    return Err(failure());
                }
                narrowed.max_length = max_length.clone().or_else(|| property.max_length.clone());
            }
            ControlInput::Boolean => {
                if !matches!(property.types, Some(Types::Single(JsonType::Boolean))) {
                    return Err(failure());
                }
            }
            ControlInput::Number {
                minimum,
                maximum,
                step,
            } => {
                if !matches!(
                    property.types,
                    Some(Types::Single(JsonType::Number | JsonType::Integer))
                ) || minimum
                    .as_ref()
                    .is_some_and(|value| lesser(value, property.minimum.as_ref()))
                    || maximum
                        .as_ref()
                        .is_some_and(|value| greater(value, property.maximum.as_ref()))
                    || step.as_ref().is_some_and(|value| {
                        value
                            .as_f64()
                            .is_none_or(|number| number <= 0.0 || number.is_sign_negative())
                            || !accepts(
                                &PropSchema {
                                    types: property.types.clone(),
                                    multiple_of: property.multiple_of.clone(),
                                    ..Default::default()
                                },
                                &DataValue::Number(value.clone()),
                            )
                    })
                {
                    return Err(failure());
                }
                narrowed.minimum = minimum.clone().or_else(|| property.minimum.clone());
                narrowed.maximum = maximum.clone().or_else(|| property.maximum.clone());
                narrowed.multiple_of = step.clone().or_else(|| property.multiple_of.clone());
            }
            ControlInput::Select { options } => {
                if options.is_empty() {
                    return Err(failure());
                }
                let mut seen = BTreeSet::new();
                let context = Context {
                    entry: source.path.clone(),
                    variant: None,
                    kind: AuthoringKind::JavaScript,
                };
                let raw = match serde_json::to_value(schema) {
                    Ok(raw) => raw,
                    Err(_) => return Err(failure()),
                };
                let validator = match PropValidator::compile(&raw, &context) {
                    Ok(validator) => validator,
                    Err(_) => return Err(failure()),
                };
                for option in options {
                    let value = match serde_json::to_value(&option.value) {
                        Ok(value) => value,
                        Err(_) => return Err(failure()),
                    };
                    if option.label.is_empty() || !seen.insert(value.to_string()) {
                        return Err(failure());
                    }
                    let mut complete = props.clone();
                    let data = match serde_json::from_value(value) {
                        Ok(data) => data,
                        Err(_) => return Err(failure()),
                    };
                    complete.insert(key.clone(), data);
                    let raw = match serde_json::to_value(complete) {
                        Ok(raw) => raw,
                        Err(_) => return Err(failure()),
                    };
                    if validator.validate(&raw, &context).is_err() {
                        return Err(failure());
                    }
                }
                narrowed.enumeration =
                    Some(options.iter().map(|option| option.value.clone()).collect());
            }
        }
        let mut complete_schema = schema.clone();
        if let Some(properties) = &mut complete_schema.properties {
            properties.insert(key.clone(), narrowed);
        }
        let context = Context {
            entry: source.path.clone(),
            variant: None,
            kind: AuthoringKind::JavaScript,
        };
        let raw = match serde_json::to_value(complete_schema) {
            Ok(raw) => raw,
            Err(_) => return Err(failure()),
        };
        if PropValidator::compile(&raw, &context).is_err() {
            return Err(failure());
        }
    }
    Ok(())
}

fn greater(value: &Number, limit: Option<&Number>) -> bool {
    limit.is_some_and(|limit| value.as_f64() > limit.as_f64())
}

fn lesser(value: &Number, limit: Option<&Number>) -> bool {
    limit.is_some_and(|limit| value.as_f64() < limit.as_f64())
}
